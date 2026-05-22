"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { markDisputedOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AttachmentList } from "@/features/attachments/components";
import { showWarningToast } from "@/features/common";
import { AgreementReferenceCard } from "@/features/work-agreements/components";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

import type { TDisputeReasonCategory } from "../types";
import type { TConvexId } from "@repo/convex-client";

import { formatDisputeDate, getDisputeReasonLabel } from "../lib";
import { DisputeResponseComposer } from "./dispute-response-composer";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "./dispute-status-badge";
import { DisputeTimeline } from "./dispute-timeline";

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
  const dispute = useQuery(
    api.disputes.getDispute,
    walletIdentity.walletAddress
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const timeline = useQuery(
    api.disputes.getDisputeTimeline,
    walletIdentity.walletAddress
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const agreementContext = useQuery(
    api.work_agreements.getAgreementContextForDispute,
    walletIdentity.walletAddress
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetryMarkDisputed = async () => {
    const setRetryWarning = (message: string) => {
      setRetryError(message);
      showWarningToast(message);
    };

    if (!dispute || !walletIdentity.walletAddress || !walletIdentity.walletType) {
      setRetryWarning("Missing wallet identity for retry.");
      return;
    }

    if (!dispute.onChainEscrowId) {
      setRetryWarning("This dispute does not have an on-chain escrow id.");
      return;
    }

    const config = getRequiredEscrowActionConfig();

    if (walletIdentity.walletType === "passkey_smart_account") {
      const readiness = await getPasskeyEscrowExecutionReadiness();
      if (!readiness.canExecute) {
        setRetryWarning(
          readiness.reason ?? "Smart account fee funding or relayer configuration is missing.",
        );
        return;
      }
    } else {
      if (!address || !walletState.isConnected) {
        setRetryWarning("Connect a Stellar wallet before retrying.");
        return;
      }
      if (!walletState.isTestnet) {
        setRetryWarning("Switch wallet to Stellar Testnet before retrying.");
        return;
      }
      if (walletState.canWriteContracts === false) {
        setRetryWarning("Current wallet cannot sign escrow contract actions right now.");
        return;
      }
    }

    setIsRetrying(true);
    setRetryError(null);

    const clientRequestId = createClientRequestId(dispute.onChainEscrowId);
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

      await markStarted({
        disputeId: dispute._id,
        actorWallet: walletIdentity.walletAddress,
        actorWalletType: walletIdentity.walletType,
      });

      const result = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: walletIdentity.walletAddress,
        signTransaction,
        walletType: walletIdentity.walletType,
        caller: walletIdentity.walletAddress,
        escrowId: dispute.onChainEscrowId,
      });

      await updateTransactionStatus({
        clientRequestId,
        txHash: result.txHash,
        status: "success",
      });

      if (dispute.milestoneId) {
        await updateMilestoneEscrowStatus({
          milestoneId: dispute.milestoneId,
          escrowId: dispute.onChainEscrowId,
          status: "disputed",
          txHash: result.txHash,
          txType: "mark_disputed",
        });
      } else {
        await updateEscrowStatus({
          escrowId: dispute.onChainEscrowId,
          status: "disputed",
          txHash: result.txHash,
          txType: "mark_disputed",
        });
      }

      await markSucceeded({
        disputeId: dispute._id,
        actorWallet: walletIdentity.walletAddress,
        actorWalletType: walletIdentity.walletType,
        transactionHash: result.txHash,
        stellarExpertUrl: getTxExplorerUrl(result.txHash),
      });
    } catch (error) {
      const errorMessage = normalizeStellarError(error);
      const failedTxHash =
        typeof error === "object" &&
        error !== null &&
        "txHash" in error &&
        typeof error.txHash === "string"
          ? error.txHash
          : undefined;

      try {
        await updateTransactionStatus({
          clientRequestId,
          ...(failedTxHash ? { txHash: failedTxHash } : {}),
          status: "failed",
          errorMessage,
        });
      } catch {
        // Best-effort transaction status update.
      }

      try {
        await markFailed({
          disputeId: dispute._id,
          actorWallet: walletIdentity.walletAddress,
          actorWalletType: walletIdentity.walletType,
          errorMessage,
          ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
        });
      } catch {
        // Best-effort dispute failure event update.
      }

      setRetryError(errorMessage);
    } finally {
      setIsRetrying(false);
    }
  };

  if (!walletIdentity.walletAddress) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm text-[#5f5f5f]">
        Connect your wallet to view this dispute.
      </p>
    );
  }

  if (dispute === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm">Loading dispute...</p>
    );
  }

  if (dispute === null) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Dispute not found or you do not have access.
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
            <DisputeOnChainStatusBadge status={dispute.onChainStatus} />
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
        {dispute.transactionHash ? (
          <div className="mt-4">
            <AppButton asChild variant="secondary" size="sm">
              <a href={dispute.stellarExpertUrl ?? "#"} target="_blank" rel="noreferrer">
                View Stellar Transaction
              </a>
            </AppButton>
          </div>
        ) : dispute.onChainStatus === "mark_failed" ? (
          <div className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              Dispute evidence was saved, but on-chain escrow dispute marking failed. Retry
              required.
            </p>
            {retryError ? <p className="text-sm text-red-700">{retryError}</p> : null}
            <div className="flex justify-end">
              <AppButton
                type="button"
                size="sm"
                onClick={() => void handleRetryMarkDisputed()}
                disabled={isRetrying}
                className="disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetrying ? "Retrying..." : "Retry mark_disputed"}
              </AppButton>
            </div>
          </div>
        ) : null}
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

      <DisputeResponseComposer dispute={dispute} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Dispute Evidence Timeline</h2>
          <AppButton asChild variant="secondary" size="sm">
            <Link href="/disputes">All Disputes</Link>
          </AppButton>
        </div>
        <DisputeTimeline events={timeline} isLoading={timeline === undefined} />
      </section>
    </div>
  );
}
