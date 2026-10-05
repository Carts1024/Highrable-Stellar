"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { markDisputedOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import {
  isPendingStellarTransactionError,
  normalizeStellarError,
} from "@/core/stellar/transaction";
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
import React, { useRef, useState } from "react";

import type { TDisputeReasonCategory } from "../types";
import type { TLocalMarkOutcome } from "./dispute-marking-status";
import type { TConvexId } from "@repo/convex-client";

import { formatDisputeDate, getDisputeReasonLabel, isTerminalDisputeStatus } from "../lib";
import { DisputeMarkingStatus, getDisputeMarkingPresentation } from "./dispute-marking-status";
import { DisputeParticipantActions } from "./dispute-participant-actions";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "./dispute-status-badge";
import { ParticipantDisputeTimeline } from "./dispute-timeline";

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
  const retryInFlight = useRef(false);
  const [retryPhase, setRetryPhase] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [localOutcome, setLocalOutcome] = useState<
    | (TLocalMarkOutcome & {
        disputeId: string;
        clientRequestId: string;
        recordingFailed?: boolean;
      })
    | null
  >(null);

  const recordConfirmedMark = async (
    currentDispute: NonNullable<typeof dispute>,
    actorWallet: string,
    actorWalletType: "external_wallet" | "passkey_smart_account",
    transactionHash: string,
    clientRequestId: string,
  ) => {
    setRetryPhase("Recording confirmed transaction...");
    try {
      await markSucceeded({
        disputeId: currentDispute._id,
        actorWallet,
        actorWalletType,
        transactionHash,
        stellarExpertUrl: getTxExplorerUrl(transactionHash),
      });
      await updateTransactionStatus({
        clientRequestId,
        txHash: transactionHash,
        status: "success",
      });
      if (currentDispute.milestoneId) {
        await updateMilestoneEscrowStatus({
          milestoneId: currentDispute.milestoneId,
          escrowId: currentDispute.onChainEscrowId!,
          status: "disputed",
          txHash: transactionHash,
          txType: "mark_disputed",
        });
      } else {
        await updateEscrowStatus({
          escrowId: currentDispute.onChainEscrowId!,
          status: "disputed",
          txHash: transactionHash,
          txType: "mark_disputed",
        });
      }
      setLocalOutcome({
        kind: "confirmed_sync_pending",
        disputeId: currentDispute._id,
        clientRequestId,
        transactionHash,
      });
      setRetryError(null);
    } catch (error) {
      setLocalOutcome({
        kind: "confirmed_sync_pending",
        disputeId: currentDispute._id,
        clientRequestId,
        transactionHash,
        recordingFailed: true,
      });
      setRetryError(
        `Stellar confirmed the transaction, but Highrable could not finish recording it: ${normalizeStellarError(error)}`,
      );
    } finally {
      setRetryPhase(null);
    }
  };

  const handleRetryRecording = async () => {
    if (
      retryInFlight.current ||
      !dispute ||
      !walletIdentity.walletAddress ||
      !walletIdentity.walletType ||
      localOutcome?.kind !== "confirmed_sync_pending" ||
      localOutcome.disputeId !== dispute._id ||
      !localOutcome.recordingFailed
    )
      return;
    retryInFlight.current = true;
    try {
      await recordConfirmedMark(
        dispute,
        walletIdentity.walletAddress,
        walletIdentity.walletType,
        localOutcome.transactionHash,
        localOutcome.clientRequestId,
      );
    } finally {
      retryInFlight.current = false;
    }
  };

  const handleRetryMarkDisputed = async () => {
    const setRetryWarning = (message: string) => {
      setRetryError(message);
      showWarningToast(message);
    };

    if (retryInFlight.current) return;
    if (!dispute || !walletIdentity.walletAddress || !walletIdentity.walletType) {
      setRetryWarning("Missing wallet identity for retry.");
      return;
    }

    if (
      !getDisputeMarkingPresentation(
        dispute.onChainStatus,
        dispute.transactionHash,
        localOutcome?.disputeId === dispute._id ? localOutcome : null,
        isTerminalDisputeStatus(dispute.status),
      ).canRetry
    )
      return;

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
    retryInFlight.current = true;
    setRetryPhase("Checking wallet readiness...");
    const failReadiness = (message: string) => {
      setRetryWarning(message);
      setRetryPhase(null);
      retryInFlight.current = false;
    };
    if (walletIdentity.walletType === "passkey_smart_account") {
      let readiness: Awaited<ReturnType<typeof getPasskeyEscrowExecutionReadiness>>;
      try {
        readiness = await getPasskeyEscrowExecutionReadiness();
      } catch (error) {
        failReadiness(normalizeStellarError(error));
        return;
      }
      if (!readiness.canExecute) {
        failReadiness(
          readiness.reason ?? "Smart account fee funding or relayer configuration is missing.",
        );
        return;
      }
    } else {
      if (
        !address ||
        !walletState.isConnected ||
        address.toUpperCase() !== walletIdentity.walletAddress.toUpperCase()
      ) {
        failReadiness("Connect the wallet for this dispute before retrying.");
        return;
      }
      if (!isWalletOnConfiguredNetwork(walletState)) {
        failReadiness(getWalletNetworkMismatchMessage("marking the escrow disputed"));
        return;
      }
      if (walletState.canWriteContracts === false) {
        failReadiness("Current wallet cannot sign escrow contract actions right now.");
        return;
      }
    }

    setRetryPhase("Preparing dispute marking...");
    setRetryError(null);

    const clientRequestId = createClientRequestId(dispute.onChainEscrowId);
    let transactionCreated = false;
    try {
      await createTransaction({
        walletAddress: walletIdentity.walletAddress,
        walletType: walletIdentity.walletType,
        type: "mark_disputed",
        clientRequestId,
        escrowId: dispute.onChainEscrowId,
        ...(dispute.jobId ? { jobId: dispute.jobId } : {}),
        ...(dispute.milestoneId ? { milestoneId: dispute.milestoneId } : {}),
        status: "pending",
      });
      transactionCreated = true;

      await markStarted({
        disputeId: dispute._id,
        actorWallet: walletIdentity.walletAddress,
        actorWalletType: walletIdentity.walletType,
      });
    } catch (error) {
      if (transactionCreated) {
        try {
          await updateTransactionStatus({
            clientRequestId,
            status: "failed",
            errorMessage: normalizeStellarError(error),
          });
        } catch {
          // Keep the original start error visible.
        }
      }
      setRetryError(`Could not start escrow marking: ${normalizeStellarError(error)}`);
      setRetryPhase(null);
      retryInFlight.current = false;
      return;
    }

    let knownHash: string | undefined;
    let mayHaveSubmitted = false;
    let result: { txHash: string };
    try {
      result = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: walletIdentity.walletAddress,
        signTransaction,
        walletType: walletIdentity.walletType,
        operationId: clientRequestId,
        caller: walletIdentity.walletAddress,
        escrowId: dispute.onChainEscrowId,
        onSigned: async ({ transactionHash }) => {
          knownHash = transactionHash;
          await updateTransactionStatus({
            clientRequestId,
            txHash: transactionHash,
            status: "pending",
          });
        },
        onPhase: (phase) => {
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
    } catch (error) {
      const errorMessage = normalizeStellarError(error);
      const failedTxHash =
        knownHash ??
        (typeof error === "object" &&
        error !== null &&
        "txHash" in error &&
        typeof error.txHash === "string"
          ? error.txHash
          : undefined);
      const uncertain =
        isPendingStellarTransactionError(error) || mayHaveSubmitted || Boolean(failedTxHash);

      try {
        await updateTransactionStatus({
          clientRequestId,
          ...(failedTxHash ? { txHash: failedTxHash } : {}),
          status: uncertain ? "pending" : "failed",
          errorMessage,
        });
      } catch {
        // Best-effort transaction status update.
      }

      if (!uncertain) {
        try {
          await markFailed({
            disputeId: dispute._id,
            actorWallet: walletIdentity.walletAddress,
            actorWalletType: walletIdentity.walletType,
            errorMessage,
          });
        } catch {
          // Best-effort dispute failure event update.
        }
      }

      if (uncertain) {
        setLocalOutcome({
          kind: "pending",
          disputeId: dispute._id,
          clientRequestId,
          ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
        });
        setRetryError(`Transaction outcome is uncertain: ${errorMessage}`);
      } else {
        setRetryError(`Escrow marking failed before submission: ${errorMessage}`);
      }
      return;
    } finally {
      setRetryPhase(null);
      retryInFlight.current = false;
    }
    setLocalOutcome({
      kind: "confirmed_sync_pending",
      disputeId: dispute._id,
      clientRequestId,
      transactionHash: result.txHash,
    });
    await recordConfirmedMark(
      dispute,
      walletIdentity.walletAddress,
      walletIdentity.walletType,
      result.txHash,
      clientRequestId,
    );
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
              localOutcome={localOutcome?.disputeId === dispute._id ? localOutcome.kind : undefined}
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
          localOutcome={localOutcome?.disputeId === dispute._id ? localOutcome : null}
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
