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
import { SectionCard, showWarningToast, WalletAddressTile } from "@/features/common";
import { AgreementReferenceCard } from "@/features/work-agreements/components";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { FileText, History, Paperclip } from "lucide-react";
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
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="hr-card-head flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tracking-[0.06em] uppercase opacity-80">
              {dispute.disputeNumber}
            </p>
            <h1 className="mt-1 font-sans text-2xl leading-tight font-bold">{dispute.title}</h1>
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
        <div className="space-y-4 p-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="hr-tone-orange hr-tone-card rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold" style={{ color: "var(--tone-fg)" }}>
                Reason
              </p>
              <p className="hr-text-primary mt-0.5 font-medium">
                {getDisputeReasonLabel(dispute.reasonCategory as TDisputeReasonCategory)}
              </p>
            </div>
            <div className="hr-tone-violet hr-tone-card rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold" style={{ color: "var(--tone-fg)" }}>
                Opened
              </p>
              <p className="hr-text-primary mt-0.5 font-medium">
                {formatDisputeDate(dispute.openedAt)}
              </p>
            </div>
            <WalletAddressTile address={dispute.clientWallet} label="Client" />
            <WalletAddressTile address={dispute.freelancerWallet} label="Freelancer" />
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">What happened</p>
            <p className="text-sm whitespace-pre-wrap text-[#3f3f3f]">{dispute.description}</p>
          </div>
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
        </div>
      </section>

      <SectionCard
        icon={FileText}
        title="Agreement Context for Platform-Reviewed Dispute"
        description="The job terms both sides agreed to."
      >
        <AgreementReferenceCard context={agreementContext} />
      </SectionCard>

      <SectionCard icon={Paperclip} title="Evidence" description="Files shared for this case.">
        <AttachmentList attachments={dispute.attachments ?? []} readOnly />
      </SectionCard>

      <DisputeParticipantActions
        disputeId={dispute._id}
        viewerWallet={walletIdentity.walletAddress}
      />

      <SectionCard
        icon={History}
        title="Dispute Evidence Timeline"
        description="Everything that happened in this case, in order."
        action={
          <AppButton asChild variant="outline" size="sm" className="border-white bg-white">
            <Link href="/disputes">All Disputes</Link>
          </AppButton>
        }
      >
        <ParticipantDisputeTimeline
          disputeId={dispute._id}
          viewerWallet={walletIdentity.walletAddress}
        />
      </SectionCard>
    </div>
  );
}
