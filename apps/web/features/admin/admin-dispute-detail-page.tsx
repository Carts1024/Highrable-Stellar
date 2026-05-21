"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { markDisputedOnChain, resolveDisputeOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminSessionGate } from "@/features/admin/admin-session-gate";
import {
  fetchAdminDispute,
  postAdminModeratorNote,
  postAdminResolution,
  postAdminReviewStatus,
} from "@/features/admin/lib/admin-api";
import {
  ProductPageHero,
  RouteCallout,
  RouteEmptyState,
  RoutePanel,
  RoutePanelHeader,
} from "@/features/common";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import { formatDisputeDate, getDisputeReasonLabel } from "@/features/disputes/lib";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type {
  IAdminDisputeDetail,
  TAdminResolutionStatus,
  TAdminReviewStatus,
} from "@/features/admin/types";

function createClientRequestId(escrowId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `mark_disputed:retry:${escrowId}:${uniqueId}`;
}

function resolveShareBps(status: TAdminResolutionStatus, currentInput: string): number {
  if (status === "resolved_client") {
    return 0;
  }

  if (status === "resolved_freelancer") {
    return 10_000;
  }

  const parsed = Number.parseInt(currentInput, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 10_000) {
    throw new Error("Split resolution requires freelancer share between 1 and 9999 bps.");
  }

  return parsed;
}

async function assertWalletExecutionReady(args: {
  walletType: "external_wallet" | "passkey_smart_account";
  address: string | null;
  isConnected: boolean;
  isTestnet: boolean;
  canWriteContracts: boolean | undefined;
}): Promise<void> {
  if (args.walletType === "passkey_smart_account") {
    const readiness = await getPasskeyEscrowExecutionReadiness();
    if (!readiness.canExecute) {
      throw new Error(readiness.reason ?? "Smart account is not ready for contract execution.");
    }
    return;
  }

  if (!args.address || !args.isConnected) {
    throw new Error("Connect a Stellar wallet to continue.");
  }
  if (!args.isTestnet) {
    throw new Error("Switch wallet network to Stellar Testnet.");
  }
  if (args.canWriteContracts === false) {
    throw new Error("Current wallet cannot sign escrow contract actions.");
  }
}

export function AdminDisputeDetailPage({ disputeId }: { readonly disputeId: string }) {
  const walletIdentity = useHighrableWalletIdentity();
  const { role, isLoading: isRoleLoading } = useDashboardRole();
  const { address, authSession, walletState, signTransaction } = useWallet();

  const markStarted = useMutation(api.disputes.markDisputeOnChainStarted);
  const markSucceeded = useMutation(api.disputes.markDisputeOnChainSucceeded);
  const markFailed = useMutation(api.disputes.markDisputeOnChainFailed);
  const updateEscrowStatus = useMutation(api.escrows.updateEscrowStatus);
  const updateMilestoneEscrowStatus = useMutation(api.milestones.updateMilestoneEscrowStatus);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);

  const [detail, setDetail] = useState<IAdminDisputeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [moderatorNote, setModeratorNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<TAdminReviewStatus>("under_review");
  const [reviewMessage, setReviewMessage] = useState("");
  const [resolutionStatus, setResolutionStatus] =
    useState<TAdminResolutionStatus>("resolved_client");
  const [resolutionShareInput, setResolutionShareInput] = useState("5000");
  const [resolutionNote, setResolutionNote] = useState("");

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const next = await fetchAdminDispute(disputeId);
      setDetail(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load dispute.");
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    if (role !== "admin" || !authSession) {
      return;
    }

    void loadDetail();
  }, [authSession, loadDetail, role]);

  const activeWalletAddress = walletIdentity.walletAddress;
  const activeWalletType = walletIdentity.walletType;

  const canRetryMarkDisputed =
    detail?.dispute.onChainStatus === "mark_failed" &&
    Boolean(detail?.dispute.onChainEscrowId) &&
    Boolean(activeWalletAddress) &&
    Boolean(activeWalletType);

  const handleAddModeratorNote = useCallback(async () => {
    if (!moderatorNote.trim()) {
      setActionError("Write a moderator note before submitting.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postAdminModeratorNote(disputeId, moderatorNote.trim());
      setModeratorNote("");
      setActionSuccess("Moderator note added.");
      await loadDetail();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to add note.");
    } finally {
      setIsSubmitting(false);
    }
  }, [disputeId, loadDetail, moderatorNote]);

  const handleChangeReviewStatus = useCallback(async () => {
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await postAdminReviewStatus(disputeId, reviewStatus, reviewMessage.trim() || undefined);
      setActionSuccess("Dispute review status updated.");
      await loadDetail();
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : "Failed to update status.");
    } finally {
      setIsSubmitting(false);
    }
  }, [disputeId, loadDetail, reviewMessage, reviewStatus]);

  const handleRetryMarkDisputed = useCallback(async () => {
    if (!detail || !detail.dispute.onChainEscrowId || !activeWalletAddress || !activeWalletType) {
      setActionError("Missing dispute or wallet context for retry.");
      return;
    }

    const config = getRequiredEscrowActionConfig();

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    const clientRequestId = createClientRequestId(detail.dispute.onChainEscrowId);

    try {
      await assertWalletExecutionReady({
        walletType: activeWalletType,
        address,
        isConnected: walletState.isConnected,
        isTestnet: walletState.isTestnet,
        canWriteContracts: walletState.canWriteContracts,
      });

      await createTransaction({
        walletAddress: activeWalletAddress,
        walletType: activeWalletType,
        type: "mark_disputed",
        clientRequestId,
        escrowId: detail.dispute.onChainEscrowId,
        ...(detail.dispute.jobId ? { jobId: detail.dispute.jobId } : {}),
        ...(detail.dispute.milestoneId ? { milestoneId: detail.dispute.milestoneId } : {}),
        status: "pending",
      });

      await markStarted({
        disputeId: detail.dispute._id,
        actorWallet: activeWalletAddress,
        actorWalletType: activeWalletType,
      });

      const txResult = await markDisputedOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress,
        signTransaction,
        walletType: activeWalletType,
        caller: activeWalletAddress,
        escrowId: detail.dispute.onChainEscrowId,
      });

      await updateTransactionStatus({
        clientRequestId,
        txHash: txResult.txHash,
        status: "success",
      });

      if (detail.dispute.milestoneId) {
        await updateMilestoneEscrowStatus({
          milestoneId: detail.dispute.milestoneId,
          escrowId: detail.dispute.onChainEscrowId,
          status: "disputed",
          txHash: txResult.txHash,
          txType: "mark_disputed",
        });
      } else {
        await updateEscrowStatus({
          escrowId: detail.dispute.onChainEscrowId,
          status: "disputed",
          txHash: txResult.txHash,
          txType: "mark_disputed",
        });
      }

      await markSucceeded({
        disputeId: detail.dispute._id,
        actorWallet: activeWalletAddress,
        actorWalletType: activeWalletType,
        transactionHash: txResult.txHash,
        stellarExpertUrl: getTxExplorerUrl(txResult.txHash),
      });

      setActionSuccess("On-chain mark_disputed retry succeeded.");
      await loadDetail();
    } catch (nextError) {
      const normalizedError = normalizeStellarError(nextError);
      const failedTxHash =
        typeof nextError === "object" &&
        nextError !== null &&
        "txHash" in nextError &&
        typeof nextError.txHash === "string"
          ? nextError.txHash
          : undefined;

      try {
        await updateTransactionStatus({
          clientRequestId,
          ...(failedTxHash ? { txHash: failedTxHash } : {}),
          status: "failed",
          errorMessage: normalizedError,
        });
      } catch {
        // Best-effort transaction update.
      }

      try {
        await markFailed({
          disputeId: detail.dispute._id,
          actorWallet: activeWalletAddress,
          actorWalletType: activeWalletType,
          errorMessage: normalizedError,
          ...(failedTxHash ? { transactionHash: failedTxHash } : {}),
        });
      } catch {
        // Best-effort event update.
      }

      setActionError(normalizedError);
      await loadDetail();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeWalletAddress,
    activeWalletType,
    address,
    createTransaction,
    detail,
    loadDetail,
    markFailed,
    markStarted,
    markSucceeded,
    signTransaction,
    updateEscrowStatus,
    updateMilestoneEscrowStatus,
    updateTransactionStatus,
    walletState.canWriteContracts,
    walletState.isConnected,
    walletState.isTestnet,
  ]);

  const handleResolveOnChain = useCallback(async () => {
    if (!detail || !detail.dispute.onChainEscrowId || !activeWalletAddress || !activeWalletType) {
      setActionError("Missing dispute or wallet context for settlement.");
      return;
    }

    const config = getRequiredEscrowActionConfig();

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await assertWalletExecutionReady({
        walletType: activeWalletType,
        address,
        isConnected: walletState.isConnected,
        isTestnet: walletState.isTestnet,
        canWriteContracts: walletState.canWriteContracts,
      });

      const freelancerShareBps = resolveShareBps(resolutionStatus, resolutionShareInput);

      await postAdminResolution(disputeId, {
        phase: "started",
        status: resolutionStatus,
        freelancerShareBps,
        ...(resolutionNote.trim() ? { resolutionNote: resolutionNote.trim() } : {}),
      });

      const resolutionHash = await toBytesN32Hash(
        `dispute:${detail.dispute._id}:status:${resolutionStatus}:bps:${freelancerShareBps}:note:${resolutionNote.trim()}`,
      );

      const txResult = await resolveDisputeOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress,
        signTransaction,
        walletType: activeWalletType,
        platformAdmin: activeWalletAddress,
        escrowId: detail.dispute.onChainEscrowId,
        freelancerShareBps,
        resolutionHash,
      });

      await postAdminResolution(disputeId, {
        phase: "succeeded",
        status: resolutionStatus,
        freelancerShareBps,
        transactionHash: txResult.txHash,
        stellarExpertUrl: getTxExplorerUrl(txResult.txHash),
        ...(resolutionNote.trim() ? { resolutionNote: resolutionNote.trim() } : {}),
      });

      setActionSuccess("Dispute resolution succeeded on-chain and in backend records.");
      await loadDetail();
    } catch (nextError) {
      const normalizedError = normalizeStellarError(nextError);
      try {
        const freelancerShareBps = resolveShareBps(resolutionStatus, resolutionShareInput);
        await postAdminResolution(disputeId, {
          phase: "failed",
          status: resolutionStatus,
          freelancerShareBps,
          errorMessage: normalizedError,
          ...(resolutionNote.trim() ? { resolutionNote: resolutionNote.trim() } : {}),
        });
      } catch {
        // Best-effort failure recording.
      }

      setActionError(
        normalizedError.includes("resolve_dispute")
          ? "Settlement unavailable: escrow contract may not yet expose resolve_dispute."
          : normalizedError,
      );
      await loadDetail();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeWalletAddress,
    activeWalletType,
    address,
    detail,
    disputeId,
    loadDetail,
    resolutionNote,
    resolutionShareInput,
    resolutionStatus,
    signTransaction,
    walletState.canWriteContracts,
    walletState.isConnected,
    walletState.isTestnet,
  ]);

  if (isRoleLoading) {
    return <p className="hr-text-secondary text-sm">Loading wallet access...</p>;
  }

  if (role === null) {
    return (
      <WalletRequiredNotice
        title="Admin Dispute Review"
        description="Connect the configured admin wallet to review disputes."
      />
    );
  }

  if (role !== "admin") {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        This route is restricted to the configured admin wallet.
      </section>
    );
  }

  if (!authSession) {
    return <AdminSessionGate>{null}</AdminSessionGate>;
  }

  if (isLoading) {
    return <p className="hr-text-secondary text-sm">Loading dispute detail...</p>;
  }

  if (error || !detail) {
    return (
      <RouteCallout tone="danger">{error ?? "Dispute detail could not be loaded."}</RouteCallout>
    );
  }

  return (
    <div className="space-y-5">
      <ProductPageHero
        label={detail.dispute.disputeNumber}
        title={detail.dispute.title}
        description={`${getDisputeReasonLabel(detail.dispute.reasonCategory)} | Opened ${formatDisputeDate(detail.dispute.openedAt)}`}
      />

      <div className="flex flex-wrap gap-2">
        <DisputeStatusBadge status={detail.dispute.status} />
        <DisputeOnChainStatusBadge status={detail.dispute.onChainStatus} />
      </div>

      <RoutePanel className="p-5">
        <p className="text-sm whitespace-pre-wrap text-foreground/80">
          {detail.dispute.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <AppButton asChild variant="secondary" size="sm">
            <Link href="/admin/disputes">Back to Disputes</Link>
          </AppButton>
          {detail.dispute.resolutionStellarExpertUrl ? (
            <AppButton asChild variant="secondary" size="sm">
              <a href={detail.dispute.resolutionStellarExpertUrl} target="_blank" rel="noreferrer">
                Resolution Transaction
              </a>
            </AppButton>
          ) : null}
        </div>
      </RoutePanel>

      {canRetryMarkDisputed ? (
        <RoutePanel className="border-red-200 bg-red-50 p-5">
          <h2 className="text-base font-semibold text-red-800">Retry mark_disputed</h2>
          <p className="mt-2 text-sm text-red-700">
            The previous on-chain dispute mark failed. Retry will attempt mark_disputed again and
            sync escrow status.
          </p>
          <div className="mt-3 flex justify-end">
            <AppButton
              type="button"
              onClick={() => void handleRetryMarkDisputed()}
              disabled={isSubmitting}
              className="disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Retrying..." : "Retry mark_disputed"}
            </AppButton>
          </div>
        </RoutePanel>
      ) : null}

      <RoutePanel className="p-5">
        <RoutePanelHeader
          className="border-b-0 px-0 pb-0"
          title="Moderator Actions"
          description="Capture internal notes and move the dispute through the review flow."
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="hr-text-primary text-sm font-medium">Add Moderator Note</p>
            <Textarea
              value={moderatorNote}
              onChange={(event) => setModeratorNote(event.target.value)}
              className="min-h-28 rounded-lg border-border"
              placeholder="Add context for the dispute timeline."
              disabled={isSubmitting}
            />
            <div className="flex justify-end">
              <AppButton
                type="button"
                variant="secondary"
                onClick={() => void handleAddModeratorNote()}
                disabled={isSubmitting}
              >
                Save Note
              </AppButton>
            </div>
          </div>

          <div className="space-y-2">
            <p className="hr-text-primary text-sm font-medium">Change Review Status</p>
            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as TAdminReviewStatus)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              disabled={isSubmitting}
            >
              <option value="under_review">Under review</option>
              <option value="awaiting_client_response">Awaiting client response</option>
              <option value="awaiting_freelancer_response">Awaiting freelancer response</option>
            </select>
            <Textarea
              value={reviewMessage}
              onChange={(event) => setReviewMessage(event.target.value)}
              className="min-h-20 rounded-lg border-border"
              placeholder="Optional status message"
              disabled={isSubmitting}
            />
            <div className="flex justify-end">
              <AppButton
                type="button"
                variant="secondary"
                onClick={() => void handleChangeReviewStatus()}
                disabled={isSubmitting}
              >
                Update Status
              </AppButton>
            </div>
          </div>
        </div>
      </RoutePanel>

      <RoutePanel className="p-5">
        <RoutePanelHeader
          className="border-b-0 px-0 pb-0"
          title="Resolve Dispute On-Chain"
          description="Resolution uses Highrable review flow and calls escrow resolve_dispute with admin authorization."
        />

        <p className="hr-text-secondary mt-2 text-sm">
          Resolution uses Highrable review flow and calls escrow resolve_dispute with admin
          authorization.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="hr-text-secondary grid gap-1 text-sm">
            <span>Resolution</span>
            <select
              value={resolutionStatus}
              onChange={(event) =>
                setResolutionStatus(event.target.value as TAdminResolutionStatus)
              }
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              disabled={isSubmitting}
            >
              <option value="resolved_client">Resolved client</option>
              <option value="resolved_freelancer">Resolved freelancer</option>
              <option value="split_resolution">Split resolution</option>
            </select>
          </label>

          <label className="hr-text-secondary grid gap-1 text-sm" htmlFor="resolution-share-bps">
            <span>Freelancer Share (bps)</span>
            <input
              id="resolution-share-bps"
              aria-label="Freelancer share in basis points"
              type="number"
              value={
                resolutionStatus === "resolved_client"
                  ? "0"
                  : resolutionStatus === "resolved_freelancer"
                    ? "10000"
                    : resolutionShareInput
              }
              onChange={(event) => setResolutionShareInput(event.target.value)}
              disabled={isSubmitting || resolutionStatus !== "split_resolution"}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60"
            />
          </label>

          <label
            className="hr-text-secondary grid gap-1 text-sm lg:col-span-2"
            htmlFor="resolution-note"
          >
            <span>Resolution Note (optional)</span>
            <Textarea
              id="resolution-note"
              aria-label="Resolution note"
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              className="min-h-20 rounded-lg border-border"
              disabled={isSubmitting}
              placeholder="Optional internal context for this resolution."
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <AppButton
            type="button"
            onClick={() => void handleResolveOnChain()}
            disabled={isSubmitting}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Resolving..." : "Resolve On-Chain"}
          </AppButton>
        </div>
      </RoutePanel>

      {actionError ? <RouteCallout tone="danger">{actionError}</RouteCallout> : null}
      {actionSuccess ? <RouteCallout tone="success">{actionSuccess}</RouteCallout> : null}

      <RoutePanel className="p-5">
        <RoutePanelHeader className="border-b-0 px-0 pb-0" title="Timeline" />
        {detail.timeline.length === 0 ? (
          <RouteEmptyState description="No timeline events yet." className="mt-2" />
        ) : (
          <div className="mt-3 space-y-3">
            {detail.timeline.map((event) => (
              <article key={event._id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="hr-text-primary text-sm font-medium">{event.message}</p>
                  <p className="hr-text-secondary text-xs">{formatDisputeDate(event.createdAt)}</p>
                </div>
                {event.attachments && event.attachments.length > 0 ? (
                  <ul className="hr-text-secondary mt-2 space-y-1 text-xs">
                    {event.attachments.map((attachment) => (
                      <li key={attachment._id}>
                        {attachment.name}
                        {attachment.url ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hr-text-accent ml-2"
                          >
                            Open
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </RoutePanel>
    </div>
  );
}
