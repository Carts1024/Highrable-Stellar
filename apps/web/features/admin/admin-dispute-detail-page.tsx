"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import {
  getPlatformAdminOnChain,
  markDisputedOnChain,
  resolveDisputeOnChain,
} from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { WalletRequiredNotice } from "@/core/wallet/components/wallet-required-notice";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminSessionGate } from "@/features/admin/admin-session-gate";
import { AdminSection } from "@/features/admin/components/admin-operations-ui";
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
  sanitizeMultilineInput,
  showWarningToast,
} from "@/features/common";
import { useDashboardRole } from "@/features/dashboard/hooks/use-dashboard-role";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import { formatDisputeDate, getDisputeReasonLabel } from "@/features/disputes/lib";
import { api } from "@repo/convex-client";
import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { ArrowLeft, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type {
  IAdminDisputeDetail,
  TAdminResolutionStatus,
  TAdminReviewStatus,
} from "@/features/admin/types";
import type { ReactNode } from "react";

const MAX_MODERATOR_NOTE_LENGTH = 4000;
const MAX_REVIEW_MESSAGE_LENGTH = 4000;
const MAX_RESOLUTION_NOTE_LENGTH = 2000;

const REVIEW_STATUS_OPTIONS = [
  { value: "under_review", label: "Under review" },
  { value: "awaiting_client_response", label: "Awaiting client response" },
  { value: "awaiting_freelancer_response", label: "Awaiting freelancer response" },
] satisfies ReadonlyArray<{ value: TAdminReviewStatus; label: string }>;

const RESOLUTION_STATUS_OPTIONS = [
  { value: "resolved_client", label: "Resolved client" },
  { value: "resolved_freelancer", label: "Resolved freelancer" },
  { value: "split_resolution", label: "Split resolution" },
] satisfies ReadonlyArray<{ value: TAdminResolutionStatus; label: string }>;

interface IAdminDisputeDetailActionsProps {
  readonly detail: IAdminDisputeDetail;
  readonly canRetryMarkDisputed: boolean;
  readonly isSubmitting: boolean;
  readonly onRetryMarkDisputed: () => void;
}

interface IAdminCaseBriefProps {
  readonly detail: IAdminDisputeDetail;
}

interface IAdminModeratorWorkspaceProps {
  readonly moderatorNote: string;
  readonly reviewMessage: string;
  readonly reviewStatus: TAdminReviewStatus;
  readonly isSubmitting: boolean;
  readonly onModeratorNoteChange: (value: string) => void;
  readonly onReviewMessageChange: (value: string) => void;
  readonly onReviewStatusChange: (value: TAdminReviewStatus) => void;
  readonly onAddModeratorNote: () => void;
  readonly onChangeReviewStatus: () => void;
}

interface IAdminResolutionWorkspaceProps {
  readonly resolutionStatus: TAdminResolutionStatus;
  readonly resolutionShareInput: string;
  readonly resolutionNote: string;
  readonly isSubmitting: boolean;
  readonly onResolutionStatusChange: (value: TAdminResolutionStatus) => void;
  readonly onResolutionShareInputChange: (value: string) => void;
  readonly onResolutionNoteChange: (value: string) => void;
  readonly onResolveOnChain: () => void;
}

interface IAdminTimelineProps {
  readonly detail: IAdminDisputeDetail;
}

interface IDefinitionItemProps {
  readonly label: string;
  readonly children: ReactNode;
}

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

function isTerminalDisputeStatus(status: IAdminDisputeDetail["dispute"]["status"]): boolean {
  return (
    status === "resolved_client" ||
    status === "resolved_freelancer" ||
    status === "split_resolution" ||
    status === "cancelled"
  );
}

function sanitizeLimitedMultilineInput(value: string, maxLength: number): string {
  return sanitizeMultilineInput(value).slice(0, maxLength);
}

function sanitizeBasisPointInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

function getResolutionShareDisplayValue(
  status: TAdminResolutionStatus,
  resolutionShareInput: string,
): string {
  if (status === "resolved_client") {
    return "0";
  }

  if (status === "resolved_freelancer") {
    return "10000";
  }

  return resolutionShareInput;
}

function DefinitionItem({ label, children }: IDefinitionItemProps) {
  return (
    <div className="border-l border-[#e8e8e8] pl-4">
      <dt className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm font-semibold break-words text-[#0a0a0a]">{children}</dd>
    </div>
  );
}

function AdminDisputeDetailActions({
  detail,
  canRetryMarkDisputed,
  isSubmitting,
  onRetryMarkDisputed,
}: IAdminDisputeDetailActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <AppButton asChild variant="secondary" size="sm" className="rounded-none">
        <Link href="/admin/disputes">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to Disputes
        </Link>
      </AppButton>
      {detail.dispute.resolutionStellarExpertUrl ? (
        <AppButton asChild variant="secondary" size="sm" className="rounded-none">
          <a href={detail.dispute.resolutionStellarExpertUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
            Resolution Transaction
          </a>
        </AppButton>
      ) : null}
      {canRetryMarkDisputed ? (
        <AppButton
          type="button"
          size="sm"
          onClick={onRetryMarkDisputed}
          disabled={isSubmitting}
          className="rounded-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Retrying..." : "Retry mark_disputed"}
        </AppButton>
      ) : null}
    </div>
  );
}

function AdminCaseBrief({ detail }: IAdminCaseBriefProps) {
  return (
    <section className="border border-[#e8e8e8] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8e8e8] p-5 sm:p-6">
        <div className="max-w-3xl space-y-2">
          <SectionLabel>Case Brief</SectionLabel>
          <h2 className="text-xl font-semibold text-[#0a0a0a]">{detail.dispute.title}</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#5f5f5f]">
            {detail.dispute.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <DisputeStatusBadge status={detail.dispute.status} />
          <DisputeOnChainStatusBadge status={detail.dispute.onChainStatus} />
        </div>
      </div>

      <dl className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <DefinitionItem label="Reason">
          {getDisputeReasonLabel(detail.dispute.reasonCategory)}
        </DefinitionItem>
        <DefinitionItem label="Opened">{formatDisputeDate(detail.dispute.openedAt)}</DefinitionItem>
        <DefinitionItem label="Updated">
          {formatDisputeDate(detail.dispute.updatedAt)}
        </DefinitionItem>
        <DefinitionItem label="Parent">
          {detail.milestone ? "Milestone" : detail.job ? "Job" : detail.dispute.parentType}
        </DefinitionItem>
        <DefinitionItem label="Client Wallet">{detail.dispute.clientWallet}</DefinitionItem>
        <DefinitionItem label="Freelancer Wallet">{detail.dispute.freelancerWallet}</DefinitionItem>
        <DefinitionItem label="Escrow ID">
          {detail.dispute.onChainEscrowId ?? detail.dispute.escrowId ?? "Not recorded"}
        </DefinitionItem>
        <DefinitionItem label="Resolution">
          {detail.dispute.resolutionNote ?? "No final note recorded"}
        </DefinitionItem>
      </dl>
    </section>
  );
}

function AdminModeratorWorkspace({
  moderatorNote,
  reviewMessage,
  reviewStatus,
  isSubmitting,
  onModeratorNoteChange,
  onReviewMessageChange,
  onReviewStatusChange,
  onAddModeratorNote,
  onChangeReviewStatus,
}: IAdminModeratorWorkspaceProps) {
  return (
    <AdminSection
      label="Review Desk"
      title="Moderator workflow"
      description="Add internal context or request a party response without leaving the case record."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label
            htmlFor="moderator-note"
            className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase"
          >
            Moderator note
          </label>
          <Textarea
            id="moderator-note"
            value={moderatorNote}
            onChange={(event) => onModeratorNoteChange(event.target.value)}
            className="min-h-36 rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            placeholder="Add context for the dispute timeline."
            disabled={isSubmitting}
            maxLength={MAX_MODERATOR_NOTE_LENGTH}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#7f7f7f]">
              {moderatorNote.length}/{MAX_MODERATOR_NOTE_LENGTH}
            </p>
            <AppButton
              type="button"
              variant="secondary"
              className="rounded-none"
              onClick={onAddModeratorNote}
              disabled={isSubmitting}
            >
              Save Note
            </AppButton>
          </div>
        </div>

        <div className="space-y-3">
          <label
            htmlFor="review-status"
            className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase"
          >
            Review status
          </label>
          <NativeSelect
            id="review-status"
            value={reviewStatus}
            onChange={(event) => onReviewStatusChange(event.target.value as TAdminReviewStatus)}
            className="h-11 w-full rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            disabled={isSubmitting}
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Textarea
            value={reviewMessage}
            onChange={(event) => onReviewMessageChange(event.target.value)}
            className="min-h-24 rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            placeholder="Optional status message"
            disabled={isSubmitting}
            maxLength={MAX_REVIEW_MESSAGE_LENGTH}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#7f7f7f]">
              {reviewMessage.length}/{MAX_REVIEW_MESSAGE_LENGTH}
            </p>
            <AppButton
              type="button"
              variant="secondary"
              className="rounded-none"
              onClick={onChangeReviewStatus}
              disabled={isSubmitting}
            >
              Update Status
            </AppButton>
          </div>
        </div>
      </div>
    </AdminSection>
  );
}

function AdminResolutionWorkspace({
  resolutionStatus,
  resolutionShareInput,
  resolutionNote,
  isSubmitting,
  onResolutionStatusChange,
  onResolutionShareInputChange,
  onResolutionNoteChange,
  onResolveOnChain,
}: IAdminResolutionWorkspaceProps) {
  return (
    <AdminSection
      label="Settlement"
      title="Resolve dispute on-chain"
      description="Settlement calls escrow resolve_dispute with the configured platform admin wallet."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,220px)_minmax(0,1fr)]">
        <label className="grid gap-1.5 text-sm text-[#5f5f5f]" htmlFor="resolution-status">
          <span className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            Resolution
          </span>
          <NativeSelect
            id="resolution-status"
            value={resolutionStatus}
            onChange={(event) =>
              onResolutionStatusChange(event.target.value as TAdminResolutionStatus)
            }
            className="h-11 w-full rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            disabled={isSubmitting}
          >
            {RESOLUTION_STATUS_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>

        <label className="grid gap-1.5 text-sm text-[#5f5f5f]" htmlFor="resolution-share-bps">
          <span className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            Freelancer share
          </span>
          <AppInput
            id="resolution-share-bps"
            aria-label="Freelancer share in basis points"
            type="number"
            min={1}
            max={9999}
            value={getResolutionShareDisplayValue(resolutionStatus, resolutionShareInput)}
            onChange={(event) => onResolutionShareInputChange(event.target.value)}
            disabled={isSubmitting || resolutionStatus !== "split_resolution"}
            className="h-11 rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30 disabled:opacity-60"
          />
        </label>

        <label className="grid gap-1.5 text-sm text-[#5f5f5f]" htmlFor="resolution-note">
          <span className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            Resolution note
          </span>
          <Textarea
            id="resolution-note"
            aria-label="Resolution note"
            value={resolutionNote}
            onChange={(event) => onResolutionNoteChange(event.target.value)}
            className="min-h-24 rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            disabled={isSubmitting}
            placeholder="Optional internal context for this resolution."
            maxLength={MAX_RESOLUTION_NOTE_LENGTH}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e8e8e8] pt-5">
        <p className="max-w-2xl text-sm leading-relaxed text-[#5f5f5f]">
          Split values are validated as basis points. Client and freelancer resolutions are locked
          to 0 and 10000 respectively.
        </p>
        <AppButton
          type="button"
          onClick={onResolveOnChain}
          disabled={isSubmitting}
          className="rounded-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Resolving..." : "Resolve On-Chain"}
        </AppButton>
      </div>
    </AdminSection>
  );
}

function AdminTimeline({ detail }: IAdminTimelineProps) {
  return (
    <AdminSection
      label="Audit Log"
      title="Timeline"
      description="Chronological dispute events, evidence references, and moderation activity."
      action={
        <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
          {detail.timeline.length} event{detail.timeline.length === 1 ? "" : "s"}
        </p>
      }
    >
      {detail.timeline.length === 0 ? (
        <RouteEmptyState description="No timeline events yet." />
      ) : (
        <ol className="relative space-y-0 border-l border-[#e8e8e8]">
          {detail.timeline.map((event) => (
            <li key={event._id} className="relative grid gap-2 pb-6 pl-6 last:pb-0">
              <span
                className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 border border-[#FF7003]/40 bg-orange-50"
                aria-hidden="true"
              />
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-start">
                <p className="text-sm leading-relaxed font-medium text-[#0a0a0a]">
                  {event.message}
                </p>
                <time className="font-mono text-xs tracking-[0.04em] text-[#7f7f7f] lg:text-right">
                  {formatDisputeDate(event.createdAt)}
                </time>
              </div>
              {event.attachments && event.attachments.length > 0 ? (
                <ul className="grid gap-2 text-xs text-[#5f5f5f] sm:grid-cols-2">
                  {event.attachments.map((attachment) => (
                    <li
                      key={attachment._id}
                      className="flex min-w-0 items-center justify-between gap-3 border border-[#e8e8e8] bg-[#fafafa] px-3 py-2"
                    >
                      <span className="truncate">{attachment.name}</span>
                      {attachment.url ? (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 font-mono text-[0.7rem] tracking-[0.06em] text-[#B94A00] uppercase hover:text-[#E85D00]"
                        >
                          Open
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </AdminSection>
  );
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
    const sanitizedModeratorNote = sanitizeLimitedMultilineInput(
      moderatorNote,
      MAX_MODERATOR_NOTE_LENGTH,
    );

    if (!sanitizedModeratorNote) {
      const nextWarning = "Write a moderator note before submitting.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postAdminModeratorNote(disputeId, sanitizedModeratorNote);
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
    const sanitizedReviewMessage = sanitizeLimitedMultilineInput(
      reviewMessage,
      MAX_REVIEW_MESSAGE_LENGTH,
    );

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await postAdminReviewStatus(disputeId, reviewStatus, sanitizedReviewMessage || undefined);
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
      const nextWarning = "Missing dispute or wallet context for retry.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
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
      const nextWarning = "Missing dispute or wallet context for settlement.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
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
      const sanitizedResolutionNote = sanitizeLimitedMultilineInput(
        resolutionNote,
        MAX_RESOLUTION_NOTE_LENGTH,
      );
      const platformAdmin = await getPlatformAdminOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress,
        walletType: activeWalletType,
      });
      const connectedWallet = activeWalletAddress.trim();

      if (platformAdmin !== connectedWallet) {
        throw new Error(
          `Connected wallet is not the escrow platform admin. Connect ${platformAdmin} to resolve this dispute on-chain.`,
        );
      }

      await postAdminResolution(disputeId, {
        phase: "started",
        status: resolutionStatus,
        freelancerShareBps,
        ...(sanitizedResolutionNote ? { resolutionNote: sanitizedResolutionNote } : {}),
      });

      const resolutionHash = await toBytesN32Hash(
        `dispute:${detail.dispute._id}:status:${resolutionStatus}:bps:${freelancerShareBps}:note:${sanitizedResolutionNote}`,
      );

      const txResult = await resolveDisputeOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: connectedWallet,
        signTransaction,
        walletType: activeWalletType,
        platformAdmin,
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
        ...(sanitizedResolutionNote ? { resolutionNote: sanitizedResolutionNote } : {}),
      });

      setActionSuccess("Dispute resolution succeeded on-chain and in backend records.");
      await loadDetail();
    } catch (nextError) {
      const normalizedError = normalizeStellarError(nextError);
      try {
        const freelancerShareBps = resolveShareBps(resolutionStatus, resolutionShareInput);
        const sanitizedResolutionNote = sanitizeLimitedMultilineInput(
          resolutionNote,
          MAX_RESOLUTION_NOTE_LENGTH,
        );
        await postAdminResolution(disputeId, {
          phase: "failed",
          status: resolutionStatus,
          freelancerShareBps,
          errorMessage: normalizedError,
          ...(sanitizedResolutionNote ? { resolutionNote: sanitizedResolutionNote } : {}),
        });
      } catch {
        // Best-effort failure recording.
      }

      setActionError(
        normalizedError.includes("Error(Contract, #3)") ||
          normalizedError
            .toLowerCase()
            .includes("connected wallet is not the escrow platform admin")
          ? normalizedError
          : normalizedError.includes("resolve_dispute")
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

  const isReadOnlyDispute = isTerminalDisputeStatus(detail.dispute.status);
  const canShowRetryMarkDisputed = canRetryMarkDisputed && !isReadOnlyDispute;

  return (
    <div className="space-y-6">
      <section className="grid gap-8 border-b border-[#e8e8e8] pb-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <ProductPageHero
          label={detail.dispute.disputeNumber}
          title={
            <>
              Dispute <span className="hr-v2-gradient-text">Review</span>
            </>
          }
          description={`${getDisputeReasonLabel(detail.dispute.reasonCategory)} | Opened ${formatDisputeDate(detail.dispute.openedAt)}`}
        />

        <div className="grid gap-5 border-l border-[#e8e8e8] py-2 pl-5 sm:grid-cols-3 lg:grid-cols-1">
          <HighrableV2Metric label="Status" value={detail.dispute.status.replaceAll("_", " ")} />
          <HighrableV2Metric
            label="On-chain"
            value={detail.dispute.onChainStatus.replaceAll("_", " ")}
          />
          <HighrableV2Metric label="Events" value={detail.timeline.length} />
        </div>
      </section>

      <AdminDisputeDetailActions
        detail={detail}
        canRetryMarkDisputed={canShowRetryMarkDisputed}
        isSubmitting={isSubmitting}
        onRetryMarkDisputed={() => void handleRetryMarkDisputed()}
      />

      {canShowRetryMarkDisputed ? (
        <RouteCallout tone="danger">
          The previous on-chain dispute mark failed. Retry will attempt mark_disputed again and sync
          escrow status.
        </RouteCallout>
      ) : null}

      <AdminCaseBrief detail={detail} />

      {!isReadOnlyDispute ? (
        <>
          <AdminModeratorWorkspace
            moderatorNote={moderatorNote}
            reviewMessage={reviewMessage}
            reviewStatus={reviewStatus}
            isSubmitting={isSubmitting}
            onModeratorNoteChange={(value) =>
              setModeratorNote(value.slice(0, MAX_MODERATOR_NOTE_LENGTH))
            }
            onReviewMessageChange={(value) =>
              setReviewMessage(value.slice(0, MAX_REVIEW_MESSAGE_LENGTH))
            }
            onReviewStatusChange={setReviewStatus}
            onAddModeratorNote={() => void handleAddModeratorNote()}
            onChangeReviewStatus={() => void handleChangeReviewStatus()}
          />

          <AdminResolutionWorkspace
            resolutionStatus={resolutionStatus}
            resolutionShareInput={resolutionShareInput}
            resolutionNote={resolutionNote}
            isSubmitting={isSubmitting}
            onResolutionStatusChange={setResolutionStatus}
            onResolutionShareInputChange={(value) =>
              setResolutionShareInput(sanitizeBasisPointInput(value))
            }
            onResolutionNoteChange={(value) =>
              setResolutionNote(value.slice(0, MAX_RESOLUTION_NOTE_LENGTH))
            }
            onResolveOnChain={() => void handleResolveOnChain()}
          />
        </>
      ) : null}

      {actionError ? <RouteCallout tone="danger">{actionError}</RouteCallout> : null}
      {actionSuccess ? <RouteCallout tone="success">{actionSuccess}</RouteCallout> : null}

      <AdminTimeline detail={detail} />
    </div>
  );
}
