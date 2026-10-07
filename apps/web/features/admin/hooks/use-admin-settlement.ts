"use client";

import { getRequiredAdminContractConfig } from "@/core/config/stellar-contracts";
import { isDisputeAdminOnChain, resolveDisputeOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import {
  isPendingStellarTransactionError,
  normalizeStellarError,
} from "@/core/stellar/transaction";
import { postAdminResolution } from "@/features/admin/lib/admin-api";
import { resolveSettlementTerms } from "@/features/admin/lib/settlement-validation";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  TSignedTransactionSubmitter,
  TStellarExecutionPhase,
} from "@/core/stellar/transaction";
import type { TWalletExecutionMode } from "@/core/stellar/transactionExecutor";
import type {
  IAdminDisputeDetail,
  TAdminResolutionOutcomeResponse,
  TAdminResolutionResponse,
  TAdminResolutionStatus,
} from "@/features/admin/types";

export type TAdminSettlementPhase =
  | "idle"
  | "preparing"
  | "simulation"
  | "signing"
  | "recording_signed_identity"
  | "submission"
  | "confirmation"
  | "recording_final"
  | "reconciling"
  | "pending"
  | "succeeded"
  | "failed";

export type TAdminSettlementAttemptContext = {
  readonly operationId: string;
  readonly transactionHash: string | null;
  readonly transactionValidUntil: number | null;
};

export interface IUseAdminSettlementParams {
  readonly disputeId: string;
  readonly detail: IAdminDisputeDetail | null;
  readonly verifiedWallet: string;
  readonly activeWalletAddress: string | null;
  readonly activeWalletType: TWalletExecutionMode | null;
  readonly connectedWalletAddress: string | null;
  readonly isWalletConnected: boolean;
  readonly isTestnet: boolean;
  readonly canWriteContracts: boolean | undefined;
  readonly signTransaction?: TSignedTransactionSubmitter;
  readonly resolutionStatus: TAdminResolutionStatus;
  readonly freelancerShareBps: number | null;
  readonly resolutionNote: string;
  readonly canSettle: boolean;
  readonly blockingReason: string | null;
  readonly loadDetail: () => Promise<void>;
  readonly invalidateAdminDisputeQueue: () => Promise<void>;
  readonly handleProtectedApiError: (error: unknown) => void;
}

export interface IUseAdminSettlementResult {
  readonly phase: TAdminSettlementPhase;
  readonly phaseLabel: string;
  readonly isExecuting: boolean;
  readonly blocksNewAttempt: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly refreshError: string | null;
  readonly attempt: TAdminSettlementAttemptContext | null;
  readonly transactionExplorerUrl: string | null;
  readonly resolve: () => Promise<void>;
  readonly reconcile: (operationId: string, transactionHash?: string | null) => Promise<void>;
  readonly clearRefreshError: () => void;
}

type TSettlementExecutionToken = {
  readonly generation: number;
  readonly operationId: string;
};

const PHASE_LABELS: Record<TAdminSettlementPhase, string> = {
  idle: "Settlement ready",
  preparing: "Preparing settlement",
  simulation: "Simulating transaction",
  signing: "Waiting for wallet signature",
  recording_signed_identity: "Recording signed transaction",
  submission: "Submitting transaction",
  confirmation: "Waiting for Stellar confirmation",
  recording_final: "Recording verified settlement",
  reconciling: "Reconciling saved transaction",
  pending: "Settlement pending reconciliation",
  succeeded: "Settlement succeeded",
  failed: "Settlement failed",
};

function createSettlementOperationId(disputeId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `resolve_dispute:${disputeId}:${uniqueId}`;
}

function getTransactionHashFromError(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("txHash" in error)) {
    return null;
  }

  const transactionHash = error.txHash;
  return typeof transactionHash === "string" && transactionHash.trim()
    ? transactionHash.trim().toLowerCase()
    : null;
}

function readAttemptContext(ref: {
  readonly current: TAdminSettlementAttemptContext | null;
}): TAdminSettlementAttemptContext | null {
  return ref.current;
}

function assertWalletExecutionReady(params: {
  readonly address: string | null;
  readonly isConnected: boolean;
  readonly isTestnet: boolean;
  readonly network: string;
  readonly canWriteContracts: boolean | undefined;
}): void {
  if (!params.address || !params.isConnected) {
    throw new Error("Connect a Stellar wallet to continue.");
  }
  if ((params.network === "testnet") !== params.isTestnet) {
    throw new Error(`Switch wallet network to Stellar ${params.network}.`);
  }
  if (params.canWriteContracts === false) {
    throw new Error("Current wallet cannot sign escrow contract actions.");
  }
}

function assertSettlementOutcome(
  response: TAdminResolutionResponse,
): TAdminResolutionOutcomeResponse {
  if ("status" in response) {
    return response;
  }

  throw new Error("Settlement recording did not return a verified outcome.");
}

function getOutcomeMessage(outcome: TAdminResolutionOutcomeResponse): string {
  if (outcome.status === "succeeded") {
    return "Dispute settlement was verified on Stellar and recorded.";
  }
  if (outcome.status === "pending") {
    return "Settlement is unresolved. Reconcile the saved transaction before trying again.";
  }
  return "Settlement failed on Stellar and was recorded as failed. A new settlement can be started after refresh.";
}

export function useAdminSettlement(params: IUseAdminSettlementParams): IUseAdminSettlementResult {
  const executionContextKey = JSON.stringify([
    params.disputeId,
    params.verifiedWallet,
    params.activeWalletAddress,
    params.connectedWalletAddress,
    params.activeWalletType,
    params.isWalletConnected,
    params.isTestnet,
    params.canWriteContracts,
    Boolean(params.signTransaction),
  ]);
  const contextKeyRef = useRef(executionContextKey);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const executionRef = useRef<TSettlementExecutionToken | null>(null);
  const attemptRef = useRef<TAdminSettlementAttemptContext | null>(null);
  const [phase, setPhase] = useState<TAdminSettlementPhase>("idle");
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<TAdminSettlementAttemptContext | null>(null);

  if (contextKeyRef.current !== executionContextKey) {
    contextKeyRef.current = executionContextKey;
    generationRef.current += 1;
    executionRef.current = null;
    attemptRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      executionRef.current = null;
      attemptRef.current = null;
    };
  }, []);

  useEffect(() => {
    setPhase("idle");
    setIsExecuting(false);
    setError(null);
    setSuccess(null);
    setRefreshError(null);
    setAttempt(null);
  }, [executionContextKey]);

  const isCurrent = useCallback((): boolean => {
    return mountedRef.current && contextKeyRef.current === executionContextKey;
  }, [executionContextKey]);

  const isExecutionCurrent = useCallback(
    (token: TSettlementExecutionToken): boolean => {
      return (
        isCurrent() && generationRef.current === token.generation && executionRef.current === token
      );
    },
    [isCurrent],
  );

  const assertExecutionCurrent = useCallback(
    (token: TSettlementExecutionToken): void => {
      if (!isExecutionCurrent(token)) {
        throw new Error("Settlement execution context changed; stopping the obsolete attempt.");
      }
    },
    [isExecutionCurrent],
  );

  const updatePhase = useCallback(
    (nextPhase: TAdminSettlementPhase, token?: TSettlementExecutionToken) => {
      if (token ? isExecutionCurrent(token) : isCurrent()) {
        setPhase(nextPhase);
      }
    },
    [isCurrent, isExecutionCurrent],
  );

  const updateAttempt = useCallback(
    (nextAttempt: TAdminSettlementAttemptContext | null, token?: TSettlementExecutionToken) => {
      if (token && !isExecutionCurrent(token)) {
        return;
      }

      attemptRef.current = nextAttempt;
      if (token ? isExecutionCurrent(token) : isCurrent()) {
        setAttempt(nextAttempt);
      }
    },
    [isCurrent, isExecutionCurrent],
  );

  const refreshAfterStateChange = useCallback(
    async (token: TSettlementExecutionToken) => {
      if (!isExecutionCurrent(token)) {
        return;
      }

      const [queueResult, detailResult] = await Promise.allSettled([
        params.invalidateAdminDisputeQueue(),
        params.loadDetail(),
      ]);
      if (!isExecutionCurrent(token)) {
        return;
      }

      if (detailResult.status === "rejected") {
        setRefreshError(
          "Settlement state changed, but the dispute detail could not be refreshed. Retry the read; settlement will not be repeated.",
        );
      } else if (queueResult.status === "rejected") {
        setRefreshError(
          "Settlement state changed, but the dispute queue could not be refreshed. Retry the read; settlement will not be repeated.",
        );
      } else {
        setRefreshError(null);
      }
    },
    [isExecutionCurrent, params.invalidateAdminDisputeQueue, params.loadDetail],
  );

  const finishOutcome = useCallback(
    async (
      outcome: TAdminResolutionOutcomeResponse,
      transactionHash: string | null,
      token: TSettlementExecutionToken,
    ) => {
      if (!isExecutionCurrent(token)) {
        return;
      }

      updatePhase(outcome.status, token);
      setError(outcome.status === "succeeded" ? null : getOutcomeMessage(outcome));
      setSuccess(outcome.status === "succeeded" ? getOutcomeMessage(outcome) : null);
      if (outcome.status !== "pending") {
        updateAttempt(null, token);
      } else if (attemptRef.current && transactionHash) {
        updateAttempt({ ...attemptRef.current, transactionHash }, token);
      }
      await refreshAfterStateChange(token);
    },
    [isExecutionCurrent, refreshAfterStateChange, updateAttempt, updatePhase],
  );

  const reconcileOperation = useCallback(
    async (
      operationId: string,
      token: TSettlementExecutionToken,
    ): Promise<TAdminResolutionOutcomeResponse | null> => {
      assertExecutionCurrent(token);
      updatePhase("reconciling", token);
      const response = await postAdminResolution(params.disputeId, {
        phase: "reconcile",
        operationId,
      });
      assertExecutionCurrent(token);
      const outcome = assertSettlementOutcome(response);
      await finishOutcome(outcome, attemptRef.current?.transactionHash ?? null, token);
      return outcome;
    },
    [assertExecutionCurrent, finishOutcome, params.disputeId, updatePhase],
  );

  const reconcile = useCallback(
    async (operationId: string, transactionHash?: string | null) => {
      if (executionRef.current || !isCurrent()) {
        return;
      }

      const token: TSettlementExecutionToken = {
        generation: generationRef.current,
        operationId,
      };
      executionRef.current = token;
      setIsExecuting(true);
      setError(null);
      setSuccess(null);
      updateAttempt(
        {
          operationId,
          transactionHash: transactionHash ?? attemptRef.current?.transactionHash ?? null,
          transactionValidUntil: attemptRef.current?.transactionValidUntil ?? null,
        },
        token,
      );
      try {
        await reconcileOperation(operationId, token);
      } catch (nextError) {
        if (isExecutionCurrent(token)) {
          params.handleProtectedApiError(nextError);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Settlement reconciliation could not be completed. Retry reconciliation.",
          );
          updatePhase("reconciling", token);
        }
      } finally {
        if (executionRef.current === token) {
          executionRef.current = null;
          if (isCurrent()) {
            setIsExecuting(false);
          }
        }
      }
    },
    [isCurrent, isExecutionCurrent, params, reconcileOperation, updateAttempt, updatePhase],
  );

  const resolve = useCallback(async () => {
    if (executionRef.current || !isCurrent()) {
      return;
    }

    if (attemptRef.current) {
      setError("Settlement requires reconciliation before another attempt can start.");
      updatePhase("reconciling");
      return;
    }

    let freelancerShareBps: number;
    try {
      freelancerShareBps = resolveSettlementTerms(
        params.resolutionStatus,
        params.freelancerShareBps,
      );
    } catch (termsError) {
      if (isCurrent()) {
        setError(termsError instanceof Error ? termsError.message : "Invalid settlement terms.");
      }
      return;
    }

    const detail = params.detail;
    const activeWalletAddress = params.activeWalletAddress;
    if (!detail || !detail.dispute.onChainEscrowId || !activeWalletAddress) {
      if (isCurrent()) {
        setError(params.blockingReason ?? "Missing dispute or wallet context for settlement.");
      }
      return;
    }
    if (!params.canSettle) {
      setError(params.blockingReason ?? "Settlement is unavailable for this case.");
      return;
    }
    if (params.activeWalletType !== "external_wallet") {
      setError("Connect a signing-capable external Stellar wallet to settle.");
      return;
    }
    if (!params.signTransaction) {
      setError("External wallet signing is not available.");
      return;
    }
    const signTransactionSubmitter = params.signTransaction;

    const operationId = createSettlementOperationId(detail.dispute._id);
    const token: TSettlementExecutionToken = {
      generation: generationRef.current,
      operationId,
    };
    executionRef.current = token;
    setIsExecuting(true);
    setError(null);
    setSuccess(null);
    setRefreshError(null);
    updatePhase("preparing", token);
    updateAttempt({ operationId, transactionHash: null, transactionValidUntil: null }, token);

    let startRequestConfirmed = false;
    let failureRecorded = false;

    const reportFailureBeforeSubmission = async (message: string): Promise<boolean> => {
      if (!isExecutionCurrent(token)) {
        return false;
      }

      try {
        const failureResponse = await postAdminResolution(params.disputeId, {
          phase: "failed",
          operationId,
          errorMessage: message,
        });
        if (!isExecutionCurrent(token)) {
          return false;
        }
        if (!("phase" in failureResponse) || failureResponse.phase !== "failed") {
          throw new Error("Settlement failure was not recorded.");
        }
        updatePhase("failed", token);
        updateAttempt(null, token);
        await refreshAfterStateChange(token);
        return true;
      } catch (failureError) {
        if (isExecutionCurrent(token)) {
          params.handleProtectedApiError(failureError);
        }
        return false;
      }
    };

    const reconcileAfterUncertainExecution = async (
      message: string,
    ): Promise<TAdminResolutionOutcomeResponse | null> => {
      if (!isExecutionCurrent(token)) {
        return null;
      }

      try {
        return await reconcileOperation(operationId, token);
      } catch (reconcileError) {
        if (isExecutionCurrent(token)) {
          params.handleProtectedApiError(reconcileError);
          updatePhase("reconciling", token);
          setError(`${message} Reconcile the saved transaction before trying again.`);
        }
        return null;
      }
    };

    try {
      assertExecutionCurrent(token);
      const config = getRequiredAdminContractConfig();
      assertWalletExecutionReady({
        address: params.connectedWalletAddress,
        isConnected: params.isWalletConnected,
        isTestnet: params.isTestnet,
        network: config.network,
        canWriteContracts: params.canWriteContracts,
      });

      const connectedWallet = activeWalletAddress.trim().toUpperCase();
      if (connectedWallet !== params.verifiedWallet.trim().toUpperCase()) {
        throw new Error("The connected wallet changed after this admin session was verified.");
      }
      if (
        connectedWallet === detail.dispute.clientWallet.trim().toUpperCase() ||
        connectedWallet === detail.dispute.freelancerWallet.trim().toUpperCase()
      ) {
        throw new Error("A dispute participant cannot settle their own case.");
      }
      if (detail.dispute.assignedAdminWallet?.trim().toUpperCase() !== connectedWallet) {
        throw new Error("Claim or receive assignment to this case before starting settlement.");
      }

      const isOnChainDisputeAdmin = await isDisputeAdminOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress,
        disputeAdmin: connectedWallet,
      });
      assertExecutionCurrent(token);
      if (!isOnChainDisputeAdmin) {
        throw new Error("The connected wallet is not an active on-chain dispute admin.");
      }

      const sanitizedResolutionNote = params.resolutionNote.trim();
      startRequestConfirmed = true;
      const startedResponse = await postAdminResolution(params.disputeId, {
        phase: "started",
        status: params.resolutionStatus,
        freelancerShareBps,
        operationId,
        ...(sanitizedResolutionNote ? { resolutionNote: sanitizedResolutionNote } : {}),
      });
      assertExecutionCurrent(token);
      if (!("phase" in startedResponse) || startedResponse.phase !== "started") {
        throw new Error("Settlement start was not recorded.");
      }

      const resolutionHash = await toBytesN32Hash(
        `dispute:${detail.dispute._id}:status:${params.resolutionStatus}:bps:${freelancerShareBps}:note:${sanitizedResolutionNote}`,
      );
      assertExecutionCurrent(token);

      const signTransaction = async (
        xdr: string,
        options?: { requiresServerSession?: boolean },
      ): Promise<string> => {
        assertExecutionCurrent(token);
        const signedXdr = await signTransactionSubmitter(xdr, options);
        assertExecutionCurrent(token);
        return signedXdr;
      };

      await resolveDisputeOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: connectedWallet,
        signTransaction,
        walletType: "external_wallet",
        operationId,
        disputeAdmin: connectedWallet,
        escrowId: detail.dispute.onChainEscrowId,
        freelancerShareBps,
        resolutionHash,
        onPhase: (nextPhase: TStellarExecutionPhase) => {
          const phaseMap: Record<TStellarExecutionPhase, TAdminSettlementPhase> = {
            simulation: "simulation",
            signing: "signing",
            submission: "submission",
            confirmation: "confirmation",
          };
          updatePhase(phaseMap[nextPhase], token);
        },
        onSigned: async ({ transactionHash, transactionValidUntil }) => {
          assertExecutionCurrent(token);
          updateAttempt({ operationId, transactionHash, transactionValidUntil }, token);
          updatePhase("recording_signed_identity", token);
          const signedResponse = await postAdminResolution(params.disputeId, {
            phase: "signed",
            operationId,
            transactionHash,
            transactionValidUntil,
          });
          assertExecutionCurrent(token);
          if (!("phase" in signedResponse) || signedResponse.phase !== "signed") {
            throw new Error("Signed transaction identity was not recorded.");
          }
        },
      });

      assertExecutionCurrent(token);
      updatePhase("recording_final", token);
      const finalResponse = await postAdminResolution(params.disputeId, {
        phase: "succeeded",
        operationId,
      });
      assertExecutionCurrent(token);
      const finalOutcome = assertSettlementOutcome(finalResponse);
      await finishOutcome(
        finalOutcome,
        readAttemptContext(attemptRef)?.transactionHash ?? null,
        token,
      );
    } catch (nextError) {
      if (!isExecutionCurrent(token)) {
        return;
      }

      params.handleProtectedApiError(nextError);
      const normalizedError = normalizeStellarError(nextError);
      const currentAttempt = readAttemptContext(attemptRef);
      const transactionHash =
        currentAttempt?.transactionHash ?? getTransactionHashFromError(nextError);
      if (transactionHash && !currentAttempt?.transactionHash) {
        updateAttempt(
          {
            operationId,
            transactionHash,
            transactionValidUntil: null,
          },
          token,
        );
      }

      const hasKnownTransaction = Boolean(transactionHash);
      if (hasKnownTransaction || isPendingStellarTransactionError(nextError)) {
        const outcome = await reconcileAfterUncertainExecution(normalizedError);
        if (outcome) {
          return;
        }
      } else if (startRequestConfirmed) {
        failureRecorded = await reportFailureBeforeSubmission(normalizedError);
        if (!failureRecorded && isExecutionCurrent(token)) {
          setError(
            `${normalizedError} Settlement failure could not be recorded. Reconcile before retrying.`,
          );
          updatePhase("reconciling", token);
        }
      }

      if (isExecutionCurrent(token) && !hasKnownTransaction) {
        if (!failureRecorded && startRequestConfirmed) {
          setError(
            `${normalizedError} Settlement failure could not be recorded. Reconcile before retrying.`,
          );
          updatePhase("reconciling", token);
        } else {
          setError(normalizedError);
        }
        if (!startRequestConfirmed) {
          updateAttempt(null, token);
          updatePhase("failed", token);
        }
      }

      if (isExecutionCurrent(token) && hasKnownTransaction) {
        setError(`${normalizedError} Reconcile the saved transaction before trying again.`);
      }
      if (
        isExecutionCurrent(token) &&
        !hasKnownTransaction &&
        startRequestConfirmed &&
        !failureRecorded
      ) {
        await refreshAfterStateChange(token);
      }
    } finally {
      if (executionRef.current === token) {
        executionRef.current = null;
        if (isCurrent()) {
          setIsExecuting(false);
        }
      }
    }
  }, [
    assertExecutionCurrent,
    finishOutcome,
    isCurrent,
    isExecutionCurrent,
    params,
    refreshAfterStateChange,
    reconcileOperation,
    updateAttempt,
    updatePhase,
  ]);

  const clearRefreshError = useCallback(() => {
    if (isCurrent()) {
      setRefreshError(null);
    }
  }, [isCurrent]);

  return {
    phase,
    phaseLabel: PHASE_LABELS[phase],
    isExecuting,
    blocksNewAttempt: isExecuting || phase === "reconciling" || phase === "pending",
    error,
    success,
    refreshError,
    attempt,
    transactionExplorerUrl: attempt?.transactionHash
      ? getTxExplorerUrl(attempt.transactionHash)
      : null,
    resolve,
    reconcile,
    clearRefreshError,
  };
}
