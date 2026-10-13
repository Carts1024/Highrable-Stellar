"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { markDisputedOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { getWalletNetworkMismatchMessage, isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AttachmentList } from "@/features/attachments/components";
import { showWarningToast } from "@/features/common";
import { AgreementReferenceCard } from "@/features/work-agreements/components";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import type { TDisputeReasonCategory } from "../types";
import type { TLocalMarkOutcome } from "./dispute-marking-status";
import type { TParticipantMarkRecordingContext } from "./participant-marking";
import type { TConvexId } from "@repo/convex-client";

import { formatDisputeDate, getDisputeReasonLabel, isTerminalDisputeStatus } from "../lib";
import { DisputeMarkingStatus, getDisputeMarkingPresentation } from "./dispute-marking-status";
import { DisputeParticipantActions } from "./dispute-participant-actions";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "./dispute-status-badge";
import { ParticipantDisputeTimeline } from "./dispute-timeline";
import {
  createParticipantMarkingScopeKey,
  getParticipantTransactionHash,
  isParticipantOutcomeUncertain,
} from "./participant-marking";

function createClientRequestId(escrowId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `mark_disputed:retry:${escrowId}:${uniqueId}`;
}

export function DisputeDetailPanel({ disputeId }: { readonly disputeId: string }) {
  const { address, walletState, signTransaction } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const markStarted = useMutation(api.disputes.markDisputeOnChainStarted);
  const markSucceeded = useMutation(api.disputes.markDisputeOnChainSucceeded);
  const markFailed = useMutation(api.disputes.markDisputeOnChainFailed);
  const updateEscrowStatus = useMutation(api.escrows.updateEscrowStatus);
  const updateMilestoneEscrowStatus = useMutation(api.milestones.updateMilestoneEscrowStatus);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);
  const permission = useQuery(
    api.disputes.canViewDispute,
    walletIdentity.walletAddress
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const dispute = useQuery(
    api.disputes.getDispute,
    walletIdentity.walletAddress && permission?.allowed
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const agreementContext = useQuery(
    api.work_agreements.getAgreementContextForDispute,
    walletIdentity.walletAddress && permission?.allowed
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const executionContextKey = createParticipantMarkingScopeKey({
    caseId: disputeId,
    parentId: disputeId,
    escrowId: dispute?.onChainEscrowId ?? "",
    walletAddress: walletIdentity.walletAddress,
    walletType: walletIdentity.walletType,
    connectedWalletAddress: address,
    isConnected: walletIdentity.isConnected && walletState.isConnected,
    network: walletState.network,
    isTestnet: walletState.isTestnet,
    canWriteContracts: walletState.canWriteContracts,
    hasSigner: Boolean(signTransaction),
    permission: permission?.allowed,
  });
  type TExecutionToken = { readonly generation: number; readonly operationId: string };
  type TScopedLocalMarkOutcome = TLocalMarkOutcome & { readonly scopeKey: string };
  const contextKeyRef = useRef(executionContextKey);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const executionRef = useRef<TExecutionToken | null>(null);
  const retryInFlight = useRef(false);
  const [retryPhase, setRetryPhase] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [localOutcome, setLocalOutcome] = useState<TScopedLocalMarkOutcome | null>(null);

  if (contextKeyRef.current !== executionContextKey) {
    contextKeyRef.current = executionContextKey;
    generationRef.current += 1;
    executionRef.current = null;
    retryInFlight.current = false;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      executionRef.current = null;
      retryInFlight.current = false;
    };
  }, []);

  useEffect(() => {
    setRetryPhase(null);
    setRetryError(null);
    setLocalOutcome(null);
  }, [executionContextKey]);

  const isCurrent = (): boolean =>
    mountedRef.current && contextKeyRef.current === executionContextKey;
  const isExecutionCurrent = (token: TExecutionToken): boolean =>
    isCurrent() && generationRef.current === token.generation && executionRef.current === token;
  const assertExecutionCurrent = (token: TExecutionToken): void => {
    if (!isExecutionCurrent(token)) {
      throw new Error("Dispute marking context changed; stopping the obsolete attempt.");
    }
  };
  const visibleLocalOutcome =
    localOutcome?.scopeKey === executionContextKey && localOutcome.disputeId === dispute?._id
      ? localOutcome
      : null;

  const recordConfirmedMark = async (
    recordingContext: TParticipantMarkRecordingContext,
    token: TExecutionToken,
  ): Promise<boolean> => {
    if (!isExecutionCurrent(token)) return false;
    setRetryPhase("Recording confirmed transaction...");
    try {
      assertExecutionCurrent(token);
      await markSucceeded({
        disputeId: recordingContext.disputeId as TConvexId<"disputes">,
        actorWallet: recordingContext.actorWallet,
        actorWalletType: recordingContext.actorWalletType,
        transactionHash: recordingContext.transactionHash,
        stellarExpertUrl: getTxExplorerUrl(recordingContext.transactionHash),
      });
      assertExecutionCurrent(token);
      await updateTransactionStatus({
        clientRequestId: recordingContext.clientRequestId,
        txHash: recordingContext.transactionHash,
        status: "success",
      });
      assertExecutionCurrent(token);
      if (recordingContext.milestoneId) {
        await updateMilestoneEscrowStatus({
          milestoneId: recordingContext.milestoneId as TConvexId<"milestones">,
          escrowId: recordingContext.onChainEscrowId,
          status: "disputed",
          txHash: recordingContext.transactionHash,
          txType: "mark_disputed",
        });
      } else {
        await updateEscrowStatus({
          escrowId: recordingContext.onChainEscrowId,
          status: "disputed",
          txHash: recordingContext.transactionHash,
          txType: "mark_disputed",
        });
      }
      assertExecutionCurrent(token);
      setLocalOutcome(null);
      setRetryError(null);
      return true;
    } catch (error) {
      if (!isExecutionCurrent(token)) return false;
      setLocalOutcome({
        kind: "confirmed_sync_pending",
        disputeId: recordingContext.disputeId,
        transactionHash: recordingContext.transactionHash,
        recordingContext,
        recordingFailed: true,
        scopeKey: executionContextKey,
      });
      setRetryError(
        `Stellar confirmed the transaction, but Highrable could not finish recording it: ${normalizeStellarError(error)}`,
      );
      return false;
    }
  };

  const handleRetryRecording = async () => {
    if (
      executionRef.current ||
      !isCurrent() ||
      !visibleLocalOutcome ||
      visibleLocalOutcome.kind !== "confirmed_sync_pending" ||
      !visibleLocalOutcome.recordingFailed
    ) {
      return;
    }
    const token: TExecutionToken = {
      generation: generationRef.current,
      operationId: visibleLocalOutcome.recordingContext.clientRequestId,
    };
    executionRef.current = token;
    retryInFlight.current = true;
    setRetryError(null);
    try {
      await recordConfirmedMark(visibleLocalOutcome.recordingContext, token);
    } finally {
      if (executionRef.current === token) {
        executionRef.current = null;
        retryInFlight.current = false;
        if (isCurrent()) setRetryPhase(null);
      }
    }
  };

  const handleRetryMarkDisputed = async () => {
    const setRetryWarning = (message: string) => {
      if (!isCurrent()) return;
      setRetryError(message);
      showWarningToast(message);
    };

    if (executionRef.current || retryInFlight.current || !isCurrent()) return;
    if (!dispute || !walletIdentity.walletAddress || !walletIdentity.walletType) {
      setRetryWarning("Missing wallet identity for retry.");
      return;
    }

    if (
      !getDisputeMarkingPresentation(
        dispute.onChainStatus,
        dispute.transactionHash,
        visibleLocalOutcome,
        isTerminalDisputeStatus(dispute.status),
      ).canRetry
    ) {
      return;
    }

    if (!dispute.onChainEscrowId) {
      setRetryWarning("This dispute does not have an on-chain escrow id.");
      return;
    }

    let config: ReturnType<typeof getRequiredEscrowActionConfig>;
    try {
      config = getRequiredEscrowActionConfig();
    } catch (error) {
      setRetryWarning(normalizeStellarError(error));
      return;
    }

    const actorWallet = walletIdentity.walletAddress;
    const actorWalletType = walletIdentity.walletType;
    const clientRequestId = createClientRequestId(dispute.onChainEscrowId);
    const token: TExecutionToken = {
      generation: generationRef.current,
      operationId: clientRequestId,
    };
    executionRef.current = token;
    retryInFlight.current = true;
    setRetryPhase("Checking wallet readiness...");
    setRetryError(null);

    let knownHash: string | undefined;
    let mayHaveSubmitted = false;
    let transactionCreated = false;
    let markingStarted = false;
    try {
      assertExecutionCurrent(token);
      if (actorWalletType === "passkey_smart_account") {
        const readiness = await getPasskeyEscrowExecutionReadiness();
        assertExecutionCurrent(token);
        if (!readiness.canExecute) {
          throw new Error(
            readiness.reason ?? "Smart account fee funding or relayer configuration is missing.",
          );
        }
      } else {
        if (
          !address ||
          !walletState.isConnected ||
          address.toUpperCase() !== actorWallet.toUpperCase()
        ) {
          throw new Error("Connect the wallet for this dispute before retrying.");
        }
        if (!isWalletOnConfiguredNetwork(walletState)) {
          throw new Error(getWalletNetworkMismatchMessage("marking the escrow disputed"));
        }
        if (walletState.canWriteContracts === false) {
          throw new Error("Current wallet cannot sign escrow contract actions right now.");
        }
      }
      assertExecutionCurrent(token);
      setRetryPhase("Preparing dispute marking...");
      await createTransaction({
        walletAddress: actorWallet,
        walletType: actorWalletType,
        type: "mark_disputed",
        clientRequestId,
        escrowId: dispute.onChainEscrowId,
        ...(dispute.jobId ? { jobId: dispute.jobId } : {}),
        ...(dispute.milestoneId ? { milestoneId: dispute.milestoneId } : {}),
        status: "pending",
      });
      assertExecutionCurrent(token);
      transactionCreated = true;
      await markStarted({
        disputeId: dispute._id,
        actorWallet,
        actorWalletType,
      });
      assertExecutionCurrent(token);
      markingStarted = true;

      const guardedSignTransaction = async (
        xdr: string,
        options?: { requiresServerSession?: boolean },
      ): Promise<string> => {
        void options;
        assertExecutionCurrent(token);
        const signedXdr = await signTransaction(xdr);
        assertExecutionCurrent(token);
        return signedXdr;
      };
      const result = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: actorWallet,
        signTransaction: guardedSignTransaction,
        walletType: actorWalletType,
        operationId: clientRequestId,
        caller: actorWallet,
        escrowId: dispute.onChainEscrowId,
        onSigned: async ({ transactionHash }) => {
          assertExecutionCurrent(token);
          knownHash = transactionHash;
          await updateTransactionStatus({
            clientRequestId,
            txHash: transactionHash,
            status: "pending",
          });
          assertExecutionCurrent(token);
        },
        onPhase: (phase) => {
          if (!isExecutionCurrent(token)) return;
          setRetryPhase(
            {
              simulation: "Simulating transaction...",
              signing: "Waiting for wallet signature...",
              submission: "Submitting transaction...",
              confirmation: "Waiting for Stellar confirmation...",
            }[phase],
          );
          if (phase === "submission" || phase === "confirmation") mayHaveSubmitted = true;
        },
      });
      assertExecutionCurrent(token);
      const recordingContext: TParticipantMarkRecordingContext = {
        disputeId: dispute._id,
        actorWallet,
        actorWalletType,
        transactionHash: result.txHash,
        clientRequestId,
        onChainEscrowId: dispute.onChainEscrowId,
        ...(dispute.jobId ? { jobId: dispute.jobId } : {}),
        ...(dispute.milestoneId ? { milestoneId: dispute.milestoneId } : {}),
      };
      setLocalOutcome({
        kind: "confirmed_sync_pending",
        disputeId: dispute._id,
        transactionHash: result.txHash,
        recordingContext,
        scopeKey: executionContextKey,
      });
      await recordConfirmedMark(recordingContext, token);
    } catch (error) {
      if (!isExecutionCurrent(token)) return;
      const errorMessage = normalizeStellarError(error);
      const failedTxHash = knownHash ?? getParticipantTransactionHash(error);
      const uncertain = isParticipantOutcomeUncertain({
        error,
        mayHaveSubmitted,
        transactionHash: failedTxHash,
      });
      const outcomeUncertain = uncertain;
      if (transactionCreated) {
        try {
          assertExecutionCurrent(token);
          await updateTransactionStatus({
            clientRequestId,
            ...(failedTxHash ? { txHash: failedTxHash } : {}),
            status: outcomeUncertain ? "pending" : "failed",
            errorMessage,
          });
          assertExecutionCurrent(token);
        } catch {
          if (!isExecutionCurrent(token)) return;
        }
      }
      if (!outcomeUncertain && markingStarted) {
        try {
          assertExecutionCurrent(token);
          await markFailed({
            disputeId: dispute._id,
            actorWallet,
            actorWalletType,
            errorMessage,
          });
          assertExecutionCurrent(token);
        } catch {
          if (!isExecutionCurrent(token)) return;
        }
      }
      if (outcomeUncertain) {
        setLocalOutcome({
          kind: "pending",
          disputeId: dispute._id,
          ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
          ...(failedTxHash
            ? {
                recordingContext: {
                  disputeId: dispute._id,
                  actorWallet,
                  actorWalletType,
                  transactionHash: failedTxHash,
                  clientRequestId,
                  onChainEscrowId: dispute.onChainEscrowId,
                  ...(dispute.jobId ? { jobId: dispute.jobId } : {}),
                  ...(dispute.milestoneId ? { milestoneId: dispute.milestoneId } : {}),
                },
              }
            : {}),
          scopeKey: executionContextKey,
        });
        setRetryError(`Transaction outcome is uncertain: ${errorMessage}`);
      } else {
        setRetryError(`Escrow marking failed before submission: ${errorMessage}`);
      }
    } finally {
      if (executionRef.current === token) {
        executionRef.current = null;
        retryInFlight.current = false;
        if (isCurrent()) setRetryPhase(null);
      }
    }
  };

  if (!walletIdentity.walletAddress) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm text-[#5f5f5f]">
        Connect your wallet to view this dispute.
      </p>
    );
  }

  if (permission === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm" role="status">
        Loading dispute...
      </p>
    );
  }

  if (!permission.allowed) {
    return (
      <p
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        role="alert"
      >
        {permission.reason === "Dispute not found."
          ? "Dispute not found."
          : "You do not have access to this dispute."}
      </p>
    );
  }

  if (dispute === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm" role="status">
        Loading dispute...
      </p>
    );
  }

  if (dispute === null) {
    return (
      <p
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        role="alert"
      >
        Dispute not found.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#e8e8e8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-[#5f5f5f] uppercase">{dispute.disputeNumber}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0a0a0a]">{dispute.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <DisputeStatusBadge status={dispute.status} />
            <DisputeOnChainStatusBadge
              status={dispute.onChainStatus}
              transactionHash={dispute.transactionHash}
              localOutcome={visibleLocalOutcome?.kind}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Reason</span>
            <br />
            {getDisputeReasonLabel(dispute.reasonCategory as TDisputeReasonCategory)}
          </p>
          <p>
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Opened</span>
            <br />
            {formatDisputeDate(dispute.openedAt)}
          </p>
          <p className="break-all">
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Client</span>
            <br />
            {dispute.clientWallet}
          </p>
          <p className="break-all">
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Freelancer</span>
            <br />
            {dispute.freelancerWallet}
          </p>
        </div>
        <p className="mt-4 text-sm whitespace-pre-wrap text-[#3f3f3f]">{dispute.description}</p>
        <DisputeMarkingStatus
          status={dispute.onChainStatus}
          transactionHash={dispute.transactionHash}
          localOutcome={visibleLocalOutcome}
          retryPhase={retryPhase}
          retryError={retryError}
          onRetry={() => void handleRetryMarkDisputed()}
          onRetryRecording={() => void handleRetryRecording()}
          terminal={isTerminalDisputeStatus(dispute.status)}
        />
      </section>

      <section className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-5">
        <h2 className="mb-3 text-lg font-semibold text-[#0a0a0a]">
          Agreement Context for Platform-Reviewed Dispute
        </h2>
        <AgreementReferenceCard context={agreementContext} />
      </section>

      <section className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-5">
        <h2 className="text-lg font-semibold text-[#0a0a0a]">Evidence</h2>
        <div className="mt-3">
          <AttachmentList attachments={dispute.attachments ?? []} readOnly />
        </div>
      </section>

      <DisputeParticipantActions
        disputeId={dispute._id}
        viewerWallet={walletIdentity.walletAddress}
      />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Dispute Evidence Timeline</h2>
          <AppButton asChild variant="secondary" size="sm">
            <Link href="/disputes">All Disputes</Link>
          </AppButton>
        </div>
        <ParticipantDisputeTimeline
          disputeId={dispute._id}
          viewerWallet={walletIdentity.walletAddress}
        />
      </section>
    </div>
  );
}
