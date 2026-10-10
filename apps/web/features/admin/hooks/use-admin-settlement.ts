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
  const originKey = `${params.disputeId}:${params.verifiedWallet}:${params.activeWalletAddress ?? ""}`;
  const originKeyRef = useRef(originKey);
  const mountedRef = useRef(true);
  const executingRef = useRef(false);
  const attemptRef = useRef<TAdminSettlementAttemptContext | null>(null);
  const [phase, setPhase] = useState<TAdminSettlementPhase>("idle");
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<TAdminSettlementAttemptContext | null>(null);

  originKeyRef.current = originKey;

  useEffect(() => {
    mountedRef.current = true;
    originKeyRef.current = originKey;
    executingRef.current = false;
    attemptRef.current = null;
    setPhase("idle");
    setIsExecuting(false);
    setError(null);
    setSuccess(null);
    setRefreshError(null);
    setAttempt(null);

    return () => {
      mountedRef.current = false;
      executingRef.current = false;
    };
  }, [originKey]);

  const isCurrent = useCallback((): boolean => {
    return mountedRef.current && originKeyRef.current === originKey;
  }, [originKey]);

  const updatePhase = useCallback(
    (nextPhase: TAdminSettlementPhase) => {
      if (isCurrent()) {
        setPhase(nextPhase);
      }
    },
    [isCurrent],
  );

  const updateAttempt = useCallback(
    (nextAttempt: TAdminSettlementAttemptContext | null) => {
      attemptRef.current = nextAttempt;
      if (isCurrent()) {
        setAttempt(nextAttempt);
      }
    },
    [isCurrent],
  );

  const refreshAfterStateChange = useCallback(async () => {
    if (!isCurrent()) {
      return;
    }

    const [queueResult, detailResult] = await Promise.allSettled([
      params.invalidateAdminDisputeQueue(),
      params.loadDetail(),
    ]);
    if (!isCurrent()) {
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
  }, [isCurrent, params.invalidateAdminDisputeQueue, params.loadDetail]);

  const finishOutcome = useCallback(
    async (outcome: TAdminResolutionOutcomeResponse, transactionHash: string | null) => {
      if (!isCurrent()) {
        return;
      }

      updatePhase(outcome.status);
      setError(outcome.status === "succeeded" ? null : getOutcomeMessage(outcome));
      setSuccess(outcome.status === "succeeded" ? getOutcomeMessage(outcome) : null);
      if (outcome.status !== "pending") {
        updateAttempt(null);
      } else if (attemptRef.current && transactionHash) {
        updateAttempt({ ...attemptRef.current, transactionHash });
      }
      await refreshAfterStateChange();
    },
    [isCurrent, refreshAfterStateChange, updateAttempt, updatePhase],
  );

  const reconcileOperation = useCallback(
    async (operationId: string): Promise<TAdminResolutionOutcomeResponse | null> => {
      updatePhase("reconciling");
      const response = await postAdminResolution(params.disputeId, {
        phase: "reconcile",
        operationId,
      });
      const outcome = assertSettlementOutcome(response);
      await finishOutcome(outcome, attemptRef.current?.transactionHash ?? null);
      return outcome;
    },
    [finishOutcome, params.disputeId, updatePhase],
  );

  const reconcile = useCallback(
    async (operationId: string, transactionHash?: string | null) => {
      if (executingRef.current || !isCurrent()) {
        return;
      }

      executingRef.current = true;
      setIsExecuting(true);
      setError(null);
      setSuccess(null);
      updateAttempt({
        operationId,
        transactionHash: transactionHash ?? attemptRef.current?.transactionHash ?? null,
        transactionValidUntil: attemptRef.current?.transactionValidUntil ?? null,
      });
      try {
        await reconcileOperation(operationId);
      } catch (nextError) {
        params.handleProtectedApiError(nextError);
        if (isCurrent()) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Settlement reconciliation could not be completed. Retry reconciliation.",
          );
          updatePhase("reconciling");
        }
      } finally {
        executingRef.current = false;
        if (isCurrent()) {
          setIsExecuting(false);
        }
      }
    },
    [isCurrent, params, reconcileOperation, updateAttempt, updatePhase],
  );

  const resolve = useCallback(async () => {
    if (executingRef.current || !isCurrent()) {
      return;
    }

    if (attemptRef.current) {
      setError("Settlement requires reconciliation before another attempt can start.");
      updatePhase("reconciling");
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
    if (params.freelancerShareBps === null) {
      setError("Enter a valid freelancer share before settling.");
      return;
    }
    const signTransaction = params.signTransaction;
    if (!signTransaction) {
      setError("External wallet signing is not available.");
      return;
    }

    executingRef.current = true;
    setIsExecuting(true);
    setError(null);
    setSuccess(null);
    setRefreshError(null);
    updatePhase("preparing");

    const operationId = createSettlementOperationId(detail.dispute._id);
    updateAttempt({ operationId, transactionHash: null, transactionValidUntil: null });
    let startRequestConfirmed = false;
    let failureRecorded = false;

    const reportFailureBeforeSubmission = async (message: string): Promise<boolean> => {
      try {
        const failureResponse = await postAdminResolution(params.disputeId, {
          phase: "failed",
          operationId,
          errorMessage: message,
        });
        if (!("phase" in failureResponse) || failureResponse.phase !== "failed") {
          throw new Error("Settlement failure was not recorded.");
        }
        updatePhase("failed");
        updateAttempt(null);
        await refreshAfterStateChange();
        return true;
      } catch (failureError) {
        params.handleProtectedApiError(failureError);
        return false;
      }
    };

    const reconcileAfterUncertainExecution = async (
      message: string,
    ): Promise<TAdminResolutionOutcomeResponse | null> => {
      try {
        return await reconcileOperation(operationId);
      } catch (reconcileError) {
        params.handleProtectedApiError(reconcileError);
        if (isCurrent()) {
          updatePhase("reconciling");
          setError(`${message} Reconcile the saved transaction before trying again.`);
        }
        return null;
      }
    };

    try {
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
      if (!isCurrent()) {
        return;
      }
      if (!isOnChainDisputeAdmin) {
        throw new Error("The connected wallet is not an active on-chain dispute admin.");
      }

      const sanitizedResolutionNote = params.resolutionNote.trim();
      startRequestConfirmed = true;
      const startedResponse = await postAdminResolution(params.disputeId, {
        phase: "started",
        status: params.resolutionStatus,
        freelancerShareBps: params.freelancerShareBps,
        operationId,
        ...(sanitizedResolutionNote ? { resolutionNote: sanitizedResolutionNote } : {}),
      });
      if (!isCurrent()) {
        return;
      }
      if (!("phase" in startedResponse) || startedResponse.phase !== "started") {
        throw new Error("Settlement start was not recorded.");
      }

      const resolutionHash = await toBytesN32Hash(
        `dispute:${detail.dispute._id}:status:${params.resolutionStatus}:bps:${params.freelancerShareBps}:note:${sanitizedResolutionNote}`,
      );

      if (!isCurrent()) {
        return;
      }

      await resolveDisputeOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: connectedWallet,
        signTransaction: (xdr, options) => {
          if (!isCurrent()) {
            throw new Error(
              "Settlement context changed before signing. Reconcile the saved attempt.",
            );
          }
          return signTransaction(xdr, options);
        },
        walletType: "external_wallet",
        operationId,
        disputeAdmin: connectedWallet,
        escrowId: detail.dispute.onChainEscrowId,
        freelancerShareBps: params.freelancerShareBps,
        resolutionHash,
        onPhase: (nextPhase: TStellarExecutionPhase) => {
          const phaseMap: Record<TStellarExecutionPhase, TAdminSettlementPhase> = {
            simulation: "simulation",
            signing: "signing",
            submission: "submission",
            confirmation: "confirmation",
          };
          updatePhase(phaseMap[nextPhase]);
        },
        onSigned: async ({ transactionHash, transactionValidUntil }) => {
          if (!isCurrent()) {
            throw new Error(
              "Settlement context changed before submission. Reconcile the saved attempt.",
            );
          }
          updateAttempt({ operationId, transactionHash, transactionValidUntil });
          updatePhase("recording_signed_identity");
          const signedResponse = await postAdminResolution(params.disputeId, {
            phase: "signed",
            operationId,
            transactionHash,
            transactionValidUntil,
          });
          if (!isCurrent()) {
            throw new Error(
              "Settlement context changed before submission. Reconcile the saved attempt.",
            );
          }
          if (!("phase" in signedResponse) || signedResponse.phase !== "signed") {
            throw new Error("Signed transaction identity was not recorded.");
          }
        },
      });

      if (!isCurrent()) {
        return;
      }
      updatePhase("recording_final");
      const finalResponse = await postAdminResolution(params.disputeId, {
        phase: "succeeded",
        operationId,
      });
      const finalOutcome = assertSettlementOutcome(finalResponse);
      await finishOutcome(finalOutcome, readAttemptContext(attemptRef)?.transactionHash ?? null);
    } catch (nextError) {
      // Preserve the saved operation for recovery by its verified administrator.
      // Never continue bookkeeping under a different wallet or case.
      if (!isCurrent()) {
        return;
      }
      params.handleProtectedApiError(nextError);
      const normalizedError = normalizeStellarError(nextError);
      const currentAttempt = readAttemptContext(attemptRef);
      const transactionHash =
        currentAttempt?.transactionHash ?? getTransactionHashFromError(nextError);
      if (transactionHash && !currentAttempt?.transactionHash) {
        updateAttempt({
          operationId,
          transactionHash,
          transactionValidUntil: null,
        });
      }

      const hasKnownTransaction = Boolean(transactionHash);
      if (hasKnownTransaction || isPendingStellarTransactionError(nextError)) {
        const outcome = await reconcileAfterUncertainExecution(normalizedError);
        if (outcome) {
          return;
        }
      } else if (startRequestConfirmed) {
        failureRecorded = await reportFailureBeforeSubmission(normalizedError);
        if (!failureRecorded && isCurrent()) {
          setError(
            `${normalizedError} Settlement failure could not be recorded. Reconcile before retrying.`,
          );
          updatePhase("reconciling");
        }
      }

      if (isCurrent() && !hasKnownTransaction) {
        if (!failureRecorded && startRequestConfirmed) {
          setError(
            `${normalizedError} Settlement failure could not be recorded. Reconcile before retrying.`,
          );
          updatePhase("reconciling");
        } else {
          setError(normalizedError);
        }
        if (!startRequestConfirmed) {
          updateAttempt(null);
          updatePhase("failed");
        }
      }

      if (isCurrent() && hasKnownTransaction) {
        setError(`${normalizedError} Reconcile the saved transaction before trying again.`);
      }
      if (isCurrent() && !hasKnownTransaction && startRequestConfirmed && !failureRecorded) {
        await refreshAfterStateChange();
      }
    } finally {
      if (isCurrent()) {
        executingRef.current = false;
        setIsExecuting(false);
      }
    }
  }, [
    finishOutcome,
    isCurrent,
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
