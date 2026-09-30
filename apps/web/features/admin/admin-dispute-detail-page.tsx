"use client";

import { getRequiredAdminContractConfig } from "@/core/config/stellar-contracts";
import {
  isDisputeAdminOnChain,
  markDisputedOnChain,
  resolveDisputeOnChain,
} from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { toBytesN32Hash } from "@/core/stellar/hashes";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import {
  isPendingStellarTransactionError,
  normalizeStellarError,
} from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminRouteLoadingState } from "@/features/admin/admin-route-fallbacks";
import {
  AdminSessionGate,
  ADMIN_QUERY_KEY,
  useAdminSessionAccess,
} from "@/features/admin/admin-session-gate";
import { AdminSection } from "@/features/admin/components/admin-operations-ui";
import {
  AdminApiError,
  fetchAdminDispute,
  fetchAdminMembershipManagement,
  getAdminApiErrorMessage,
  isAdminNetworkError,
  postAdminModeratorNote,
  postAdminAssignDispute,
  postAdminClaimDispute,
  postAdminResolution,
  postAdminReviewStatus,
  shouldRetryAdminRead,
} from "@/features/admin/lib/admin-api";
import {
  deriveSettlementEligibility,
  getResolutionShareDisplayValue,
  isActiveSettlementAttemptStatus,
  resolveShareBps,
  validateResolutionShare,
} from "@/features/admin/lib/settlement-validation";
import {
  ProductPageHero,
  RouteCallout,
  RouteEmptyState,
  sanitizeMultilineInput,
  showWarningToast,
} from "@/features/common";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "@/features/disputes";
import {
  formatDisputeDate,
  getDisputeOnChainStatusLabel,
  getDisputeReasonLabel,
  getDisputeStatusLabel,
  isTerminalDisputeStatus,
} from "@/features/disputes/lib";
import { api } from "@repo/convex-client";
import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { ArrowLeft, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

import type {
  IAdminDisputeDetail,
  TAdminResolutionStatus,
  TAdminReviewStatus,
} from "@/features/admin/types";
import type { TDisputeStatus } from "@/features/disputes/types";
import type { ReactNode } from "react";

const MAX_MODERATOR_NOTE_LENGTH = 4000;
const MAX_REVIEW_MESSAGE_LENGTH = 4000;
const MAX_RESOLUTION_NOTE_LENGTH = 2000;

const REVIEW_STATUS_OPTIONS = [
  { value: "under_review", label: getDisputeStatusLabel("under_review") },
  { value: "awaiting_client_response", label: getDisputeStatusLabel("awaiting_client_response") },
  {
    value: "awaiting_freelancer_response",
    label: getDisputeStatusLabel("awaiting_freelancer_response"),
  },
] satisfies ReadonlyArray<{ value: TAdminReviewStatus; label: string }>;

function isAdminReviewStatus(value: string): value is TAdminReviewStatus {
  return REVIEW_STATUS_OPTIONS.some((option) => option.value === value);
}

function getReviewStatusForDispute(status: TDisputeStatus): TAdminReviewStatus {
  return isAdminReviewStatus(status) ? status : "under_review";
}

function canAdminReviewDispute(detail: IAdminDisputeDetail, verifiedWallet: string): boolean {
  const normalizedWallet = verifiedWallet.trim().toUpperCase();
  const isParticipant =
    normalizedWallet === detail.dispute.clientWallet.trim().toUpperCase() ||
    normalizedWallet === detail.dispute.freelancerWallet.trim().toUpperCase();

  return (
    detail.dispute.assignedAdminWallet?.trim().toUpperCase() === normalizedWallet &&
    !isParticipant &&
    !isTerminalDisputeStatus(detail.dispute.status)
  );
}

const RESOLUTION_STATUS_OPTIONS = [
  { value: "resolved_client", label: getDisputeStatusLabel("resolved_client") },
  { value: "resolved_freelancer", label: getDisputeStatusLabel("resolved_freelancer") },
  { value: "split_resolution", label: getDisputeStatusLabel("split_resolution") },
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
  readonly resolutionShareError: string | null;
  readonly resolutionNote: string;
  readonly settlementBlockingReason: string | null;
  readonly canSettle: boolean;
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

function createSettlementOperationId(disputeId: string): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `resolve_dispute:${disputeId}:${uniqueId}`;
}

function sanitizeLimitedMultilineInput(value: string, maxLength: number): string {
  return sanitizeMultilineInput(value).slice(0, maxLength);
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

function AdminAssignmentWorkspace({
  detail,
  verifiedWallet,
  isOwner,
  activeAdminWallets,
  assignedAdminAccessState,
  isSubmitting,
  onClaim,
  onAssign,
}: {
  readonly detail: IAdminDisputeDetail;
  readonly verifiedWallet: string;
  readonly isOwner: boolean;
  readonly activeAdminWallets: readonly string[];
  readonly assignedAdminAccessState?: string;
  readonly isSubmitting: boolean;
  readonly onClaim: () => void;
  readonly onAssign: (wallet: string | null) => void;
}) {
  const assignedWallet = detail.dispute.assignedAdminWallet ?? null;
  const isParticipant =
    verifiedWallet === detail.dispute.clientWallet.toUpperCase() ||
    verifiedWallet === detail.dispute.freelancerWallet.toUpperCase();
  const canClaim =
    !assignedWallet && !isParticipant && !isTerminalDisputeStatus(detail.dispute.status);

  return (
    <AdminSection
      label="Case Ownership"
      title="Assignment"
      description="Case actions are available to the assigned active admin. The platform owner can reassign or release cases."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-[#777] uppercase">Current assignee</p>
          <p className="mt-1 font-mono text-sm break-all">
            {assignedWallet ?? "Unassigned"}
            {assignedWallet && assignedAdminAccessState && assignedAdminAccessState !== "active"
              ? ` · ${assignedAdminAccessState}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canClaim ? (
            <AppButton type="button" size="sm" disabled={isSubmitting} onClick={onClaim}>
              Claim Case
            </AppButton>
          ) : null}
          {isOwner ? (
            <select
              aria-label="Assign case to dispute admin"
              className="h-10 max-w-72 border border-[#e8e8e8] bg-white px-3 text-sm"
              value={assignedWallet ?? ""}
              disabled={isSubmitting}
              onChange={(event) => onAssign(event.target.value || null)}
            >
              <option value="">Unassigned</option>
              {assignedWallet && !activeAdminWallets.includes(assignedWallet) ? (
                <option value={assignedWallet}>Revoked: {assignedWallet}</option>
              ) : null}
              {activeAdminWallets.map((wallet) => (
                <option key={wallet} value={wallet}>
                  {wallet === verifiedWallet ? "Owner (you)" : wallet}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
      {detail.assignmentEvents.length ? (
        <ol className="mt-5 space-y-2 border-t border-[#e8e8e8] pt-4">
          {detail.assignmentEvents.map((event) => (
            <li key={event._id} className="text-xs text-[#777]">
              {event.type.replaceAll("_", " ")} · {event.actorWallet}
              {event.assignedAdminWallet ? ` → ${event.assignedAdminWallet}` : ""}
              {event.previousAdminWallet ? ` (from ${event.previousAdminWallet})` : ""}
              {` · ${formatDisputeDate(event.createdAt)}`}
            </li>
          ))}
        </ol>
      ) : null}
    </AdminSection>
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
            onChange={(event) => {
              const nextValue = event.target.value;
              if (isAdminReviewStatus(nextValue)) {
                onReviewStatusChange(nextValue);
              }
            }}
            className="h-11 w-full rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30"
            disabled={isSubmitting}
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <label
            htmlFor="review-message"
            className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase"
          >
            Optional review message
          </label>
          <Textarea
            id="review-message"
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
  resolutionShareError,
  resolutionNote,
  settlementBlockingReason,
  canSettle,
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
      description="Settlement calls resolve_dispute with the assigned, active dispute admin wallet."
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
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={getResolutionShareDisplayValue(resolutionStatus, resolutionShareInput)}
            onChange={(event) => onResolutionShareInputChange(event.target.value)}
            disabled={isSubmitting || resolutionStatus !== "split_resolution"}
            aria-invalid={resolutionShareError !== null}
            aria-describedby={resolutionShareError ? "resolution-share-bps-error" : undefined}
            className="h-11 rounded-none border-[#e8e8e8] bg-white focus-visible:ring-[#FF7003]/30 disabled:opacity-60"
          />
          {resolutionShareError ? (
            <p
              id="resolution-share-bps-error"
              className="text-xs leading-relaxed text-red-700"
              role="alert"
            >
              {resolutionShareError}
            </p>
          ) : null}
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
        <div className="max-w-2xl space-y-1 text-sm leading-relaxed text-[#5f5f5f]">
          <p>
            Split values are validated as basis points. Client and freelancer resolutions are locked
            to 0 and 10000 respectively.
          </p>
          {settlementBlockingReason ? (
            <p className="text-amber-800" role="status" aria-live="polite">
              {settlementBlockingReason}
            </p>
          ) : null}
        </div>
        <AppButton
          type="button"
          onClick={onResolveOnChain}
          disabled={isSubmitting || !canSettle || resolutionShareError !== null}
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
  network: string;
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
  if ((args.network === "testnet") !== args.isTestnet) {
    throw new Error(`Switch wallet network to Stellar ${args.network}.`);
  }
  if (args.canWriteContracts === false) {
    throw new Error("Current wallet cannot sign escrow contract actions.");
  }
}

function getConfiguredAdminNetwork(): string | null {
  try {
    return getRequiredAdminContractConfig().network;
  } catch {
    return null;
  }
}

function AdminDisputeDetailContent({ disputeId }: { readonly disputeId: string }) {
  const walletIdentity = useHighrableWalletIdentity();
  const { verifiedWallet, isOwner, handleProtectedApiError } = useAdminSessionAccess();
  const { address, walletState, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  const markStarted = useMutation(api.disputes.markDisputeOnChainStarted);
  const markSucceeded = useMutation(api.disputes.markDisputeOnChainSucceeded);
  const markFailed = useMutation(api.disputes.markDisputeOnChainFailed);
  const updateEscrowStatus = useMutation(api.escrows.updateEscrowStatus);
  const updateMilestoneEscrowStatus = useMutation(api.milestones.updateMilestoneEscrowStatus);
  const createTransaction = useMutation(api.transactions.createTransaction);
  const updateTransactionStatus = useMutation(api.transactions.updateTransactionStatus);

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
  const [reviewStatusRefreshFailed, setReviewStatusRefreshFailed] = useState(false);

  const detailQuery = useQuery<IAdminDisputeDetail, AdminApiError>({
    queryKey: [...ADMIN_QUERY_KEY, "dispute", verifiedWallet, disputeId],
    queryFn: ({ signal }) => fetchAdminDispute(disputeId, { signal }),
    retry: shouldRetryAdminRead,
  });
  const membershipQuery = useQuery({
    queryKey: [...ADMIN_QUERY_KEY, "admins", verifiedWallet],
    queryFn: ({ signal }) => fetchAdminMembershipManagement({ signal }),
    enabled: isOwner,
    retry: shouldRetryAdminRead,
  });
  const detail = detailQuery.data ?? null;
  const canReviewCurrentDispute = detail ? canAdminReviewDispute(detail, verifiedWallet) : false;
  const loadDetail = useCallback(async () => {
    const result = await detailQuery.refetch();
    if (result.error) {
      throw result.error;
    }
  }, [detailQuery.refetch]);

  const invalidateAdminDisputeQueue = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...ADMIN_QUERY_KEY, "disputes", verifiedWallet],
    });
  }, [queryClient, verifiedWallet]);

  useEffect(() => {
    if (detail) {
      setReviewStatus(getReviewStatusForDispute(detail.dispute.status));
    }
  }, [detail?.dispute._id, detail?.dispute.status]);

  useEffect(() => {
    setModeratorNote("");
    setReviewMessage("");
    setResolutionStatus("resolved_client");
    setResolutionShareInput("5000");
    setResolutionNote("");
    setReviewStatusRefreshFailed(false);
  }, [disputeId]);

  useEffect(() => {
    if (detailQuery.error) {
      handleProtectedApiError(detailQuery.error);
    }
  }, [detailQuery.error, handleProtectedApiError]);

  useEffect(() => {
    if (membershipQuery.error) {
      handleProtectedApiError(membershipQuery.error);
    }
  }, [handleProtectedApiError, membershipQuery.error]);

  const activeWalletAddress = walletIdentity.walletAddress;
  const activeWalletType = walletIdentity.walletType;
  const settlementEligibility = deriveSettlementEligibility({
    detail,
    verifiedWallet,
    activeWalletAddress,
    activeWalletType,
    connectedWalletAddress: address,
    isConnected: walletState.isConnected,
    canWriteContracts: walletState.canWriteContracts,
    isTestnet: walletState.isTestnet,
    configuredNetwork: getConfiguredAdminNetwork(),
    isActionRunning: isSubmitting,
  });
  const resolutionShareValidation = validateResolutionShare(resolutionStatus, resolutionShareInput);

  const handleClaimCase = useCallback(async () => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await postAdminClaimDispute(disputeId);
      await loadDetail();
      await invalidateAdminDisputeQueue();
      setActionSuccess("Case claimed.");
    } catch (error) {
      handleProtectedApiError(error);
      setActionError(error instanceof Error ? error.message : "Could not claim the case.");
    } finally {
      setIsSubmitting(false);
    }
  }, [disputeId, handleProtectedApiError, invalidateAdminDisputeQueue, loadDetail]);

  const handleAssignCase = useCallback(
    async (assignedAdminWallet: string | null) => {
      setIsSubmitting(true);
      setActionError(null);
      try {
        await postAdminAssignDispute(disputeId, assignedAdminWallet);
        await loadDetail();
        await invalidateAdminDisputeQueue();
        setActionSuccess(assignedAdminWallet ? "Case assignment updated." : "Case unassigned.");
      } catch (error) {
        handleProtectedApiError(error);
        setActionError(
          error instanceof Error ? error.message : "Could not update case assignment.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [disputeId, handleProtectedApiError, invalidateAdminDisputeQueue, loadDetail],
  );

  const handleReconcileSettlement = useCallback(
    async (operationId: string) => {
      setIsSubmitting(true);
      setActionError(null);
      setActionSuccess(null);
      try {
        await postAdminResolution(disputeId, { phase: "reconcile", operationId });
        setActionSuccess("Settlement reconciliation checked the saved Stellar transaction.");
        await loadDetail();
      } catch (error) {
        handleProtectedApiError(error);
        setActionError(error instanceof Error ? error.message : "Could not reconcile settlement.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [disputeId, handleProtectedApiError, loadDetail],
  );

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
      handleProtectedApiError(nextError);
      setActionError(nextError instanceof Error ? nextError.message : "Failed to add note.");
    } finally {
      setIsSubmitting(false);
    }
  }, [disputeId, handleProtectedApiError, loadDetail, moderatorNote]);

  const handleChangeReviewStatus = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (!detail || !canReviewCurrentDispute) {
      const nextWarning =
        "Assign this nonterminal case to your verified admin wallet before changing review status.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    const sanitizedReviewMessage = sanitizeLimitedMultilineInput(
      reviewMessage,
      MAX_REVIEW_MESSAGE_LENGTH,
    );

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    setReviewStatusRefreshFailed(false);
    let statusWriteSucceeded = false;
    try {
      await postAdminReviewStatus(disputeId, reviewStatus, sanitizedReviewMessage || undefined);
      statusWriteSucceeded = true;
      setReviewMessage("");
      await invalidateAdminDisputeQueue();
      await loadDetail();
      setActionSuccess("Dispute review status updated.");
    } catch (nextError) {
      handleProtectedApiError(nextError);
      if (statusWriteSucceeded) {
        setReviewStatusRefreshFailed(true);
        setActionError(
          "Review status was saved, but the detail could not be refreshed. Retry the read; the status mutation will not be repeated.",
        );
      } else {
        setActionError(nextError instanceof Error ? nextError.message : "Failed to update status.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canReviewCurrentDispute,
    detail,
    disputeId,
    handleProtectedApiError,
    invalidateAdminDisputeQueue,
    isSubmitting,
    loadDetail,
    reviewMessage,
    reviewStatus,
  ]);

  const handleRetryDetailRead = useCallback(async () => {
    const result = await detailQuery.refetch();
    if (!result.error) {
      setReviewStatusRefreshFailed(false);
      setActionError(null);
    }
  }, [detailQuery.refetch]);

  const handleRetryMarkDisputed = useCallback(async () => {
    if (!detail || !detail.dispute.onChainEscrowId || !activeWalletAddress || !activeWalletType) {
      const nextWarning = "Missing dispute or wallet context for retry.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    const clientRequestId = createClientRequestId(detail.dispute.onChainEscrowId);

    try {
      const config = getRequiredAdminContractConfig();
      await assertWalletExecutionReady({
        walletType: activeWalletType,
        address,
        isConnected: walletState.isConnected,
        isTestnet: walletState.isTestnet,
        network: config.network,
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
        operationId: clientRequestId,
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
      handleProtectedApiError(nextError);
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
          status: isPendingStellarTransactionError(nextError) ? "pending" : "failed",
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
    handleProtectedApiError,
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
      const nextWarning =
        settlementEligibility.blockingReason ?? "Missing dispute or wallet context for settlement.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    if (!settlementEligibility.canSettle) {
      const nextWarning =
        settlementEligibility.blockingReason ?? "Settlement is unavailable for this case.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    if (activeWalletType !== "external_wallet") {
      const nextWarning = "Connect a signing-capable external Stellar wallet to settle.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    const shareValidation = validateResolutionShare(resolutionStatus, resolutionShareInput);
    if (!shareValidation.isValid) {
      const nextWarning = shareValidation.error ?? "Enter a valid freelancer share.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    const operationId = createSettlementOperationId(detail.dispute._id);
    let settlementStarted = false;
    let signedIdentityPersisted = false;

    try {
      const config = getRequiredAdminContractConfig();
      await assertWalletExecutionReady({
        walletType: activeWalletType,
        address,
        isConnected: walletState.isConnected,
        isTestnet: walletState.isTestnet,
        network: config.network,
        canWriteContracts: walletState.canWriteContracts,
      });

      const freelancerShareBps = resolveShareBps(resolutionStatus, resolutionShareInput);
      const sanitizedResolutionNote = sanitizeLimitedMultilineInput(
        resolutionNote,
        MAX_RESOLUTION_NOTE_LENGTH,
      );
      const connectedWallet = activeWalletAddress.trim().toUpperCase();
      if (connectedWallet !== verifiedWallet) {
        throw new Error("The connected wallet changed after this admin session was verified.");
      }
      if (
        connectedWallet === detail.dispute.clientWallet.toUpperCase() ||
        connectedWallet === detail.dispute.freelancerWallet.toUpperCase()
      ) {
        throw new Error("A dispute participant cannot settle their own case.");
      }
      if (detail.dispute.assignedAdminWallet?.toUpperCase() !== connectedWallet) {
        throw new Error("Claim or receive assignment to this case before starting settlement.");
      }

      const isOnChainDisputeAdmin = await isDisputeAdminOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: activeWalletAddress,
        disputeAdmin: connectedWallet,
      });
      if (!isOnChainDisputeAdmin) {
        throw new Error("The connected wallet is not an active on-chain dispute admin.");
      }

      await postAdminResolution(disputeId, {
        phase: "started",
        status: resolutionStatus,
        freelancerShareBps,
        operationId,
        ...(sanitizedResolutionNote ? { resolutionNote: sanitizedResolutionNote } : {}),
      });
      settlementStarted = true;

      const resolutionHash = await toBytesN32Hash(
        `dispute:${detail.dispute._id}:status:${resolutionStatus}:bps:${freelancerShareBps}:note:${sanitizedResolutionNote}`,
      );

      await resolveDisputeOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        escrowContractId: config.escrowContractId,
        sourceAddress: connectedWallet,
        signTransaction,
        walletType: activeWalletType,
        operationId,
        disputeAdmin: connectedWallet,
        escrowId: detail.dispute.onChainEscrowId,
        freelancerShareBps,
        resolutionHash,
        onSigned: async ({ transactionHash, transactionValidUntil }) => {
          await postAdminResolution(disputeId, {
            phase: "signed",
            operationId,
            transactionHash,
            transactionValidUntil,
          });
          signedIdentityPersisted = true;
        },
      });

      await postAdminResolution(disputeId, {
        phase: "succeeded",
        operationId,
      });

      setActionSuccess("Dispute settlement was verified on Stellar and recorded.");
      await loadDetail();
    } catch (nextError) {
      handleProtectedApiError(nextError);
      const normalizedError = normalizeStellarError(nextError);
      if (settlementStarted) {
        try {
          if (signedIdentityPersisted || isPendingStellarTransactionError(nextError)) {
            await postAdminResolution(disputeId, { phase: "reconcile", operationId });
          } else {
            await postAdminResolution(disputeId, {
              phase: "failed",
              operationId,
              errorMessage: normalizedError,
            });
          }
        } catch {
          if (!signedIdentityPersisted) {
            await postAdminResolution(disputeId, { phase: "reconcile", operationId }).catch(
              () => undefined,
            );
          }
        }
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
    detail,
    disputeId,
    handleProtectedApiError,
    loadDetail,
    resolutionNote,
    resolutionShareInput,
    resolutionStatus,
    settlementEligibility,
    signTransaction,
    verifiedWallet,
    walletState.canWriteContracts,
    walletState.isConnected,
    walletState.isTestnet,
  ]);

  if (detailQuery.isPending) {
    return <AdminRouteLoadingState label="dispute detail" />;
  }

  if (detailQuery.isError) {
    if (!reviewStatusRefreshFailed && detailQuery.error.status === 404) {
      return (
        <RouteCallout tone="warning">
          <span>Dispute not found.</span>{" "}
          <Link className="underline" href="/admin/disputes">
            Return to the dispute queue
          </Link>
        </RouteCallout>
      );
    }

    if (!reviewStatusRefreshFailed && detailQuery.error.status === 400) {
      return (
        <RouteCallout tone="danger">
          This dispute request is invalid. Check the dispute ID and return to the queue.
        </RouteCallout>
      );
    }

    return (
      <RouteCallout tone="danger">
        {detailQuery.error.status === 401
          ? "Admin authentication is required before this dispute can be read."
          : detailQuery.error.status === 403
            ? "Admin access is forbidden for this dispute request."
            : reviewStatusRefreshFailed
              ? "Review status was saved, but the detail refresh failed. Retry the read; the status mutation will not be repeated."
              : isAdminNetworkError(detailQuery.error)
                ? "The dispute detail could not be reached. Check your connection and retry."
                : getAdminApiErrorMessage(detailQuery.error) ||
                  "Dispute detail could not be loaded."}{" "}
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          className="ml-3"
          onClick={() => void handleRetryDetailRead()}
          disabled={detailQuery.isFetching}
        >
          Retry
        </AppButton>
      </RouteCallout>
    );
  }

  if (!detail) {
    return (
      <RouteCallout tone="danger">
        Dispute detail could not be loaded. Retry the request or return to the queue.
      </RouteCallout>
    );
  }

  const isReadOnlyDispute = isTerminalDisputeStatus(detail.dispute.status);
  const canShowRetryMarkDisputed = canRetryMarkDisputed && !isReadOnlyDispute;
  const isAssignedAdmin = canReviewCurrentDispute;
  const activeAdminWallets = [
    verifiedWallet,
    ...(membershipQuery.data?.admins
      .filter((admin) => admin.accessState === "active")
      .map((admin) => admin.wallet) ?? []),
  ];
  const assignedAdminAccessState = detail.dispute.assignedAdminWallet
    ? (membershipQuery.data?.admins.find(
        (admin) => admin.wallet === detail.dispute.assignedAdminWallet,
      )?.accessState ??
      (detail.dispute.assignedAdminWallet.toUpperCase() === verifiedWallet
        ? "active"
        : "not active"))
    : undefined;

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
          <HighrableV2Metric label="Status" value={getDisputeStatusLabel(detail.dispute.status)} />
          <HighrableV2Metric
            label="On-chain"
            value={getDisputeOnChainStatusLabel(detail.dispute.onChainStatus)}
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
          escrow status. This starts a new chain operation; the failure label alone does not
          establish transaction retry safety.
        </RouteCallout>
      ) : null}

      <AdminCaseBrief detail={detail} />

      <AdminAssignmentWorkspace
        detail={detail}
        verifiedWallet={verifiedWallet}
        isOwner={isOwner}
        activeAdminWallets={activeAdminWallets}
        assignedAdminAccessState={assignedAdminAccessState}
        isSubmitting={isSubmitting}
        onClaim={() => void handleClaimCase()}
        onAssign={(wallet) => void handleAssignCase(wallet)}
      />

      {detail.settlementAttempts.some((attempt) =>
        isActiveSettlementAttemptStatus(attempt.status),
      ) ? (
        <AdminSection
          label="Settlement Recovery"
          title="Pending transaction"
          description="Recovery checks the persisted transaction identity and never submits it again."
        >
          <div className="space-y-3">
            {detail.settlementAttempts
              .filter((attempt) => isActiveSettlementAttemptStatus(attempt.status))
              .map((attempt) => (
                <div
                  key={attempt._id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[#e8e8e8] p-4"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {attempt.status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 font-mono text-xs break-all text-[#777]">
                      {attempt.actorWallet} ·{" "}
                      {attempt.transactionHash ?? "Awaiting signed transaction"}
                    </p>
                  </div>
                  <AppButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      isSubmitting || (!attempt.transactionHash && attempt.status !== "started")
                    }
                    onClick={() => void handleReconcileSettlement(attempt.operationId)}
                  >
                    {isSubmitting ? "Checking…" : "Reconcile"}
                  </AppButton>
                </div>
              ))}
          </div>
        </AdminSection>
      ) : null}

      {!isReadOnlyDispute && !isAssignedAdmin ? (
        <RouteCallout tone="warning">
          Assign this case to your wallet before adding moderator notes, changing review status, or
          starting settlement.
        </RouteCallout>
      ) : null}

      {!isReadOnlyDispute && isAssignedAdmin ? (
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
        </>
      ) : null}

      {!isReadOnlyDispute ? (
        <AdminResolutionWorkspace
          resolutionStatus={resolutionStatus}
          resolutionShareInput={resolutionShareInput}
          resolutionShareError={resolutionShareValidation.error}
          resolutionNote={resolutionNote}
          settlementBlockingReason={settlementEligibility.blockingReason}
          canSettle={settlementEligibility.canSettle}
          isSubmitting={isSubmitting}
          onResolutionStatusChange={(value) => {
            setResolutionStatus(value);
          }}
          onResolutionShareInputChange={setResolutionShareInput}
          onResolutionNoteChange={(value) =>
            setResolutionNote(value.slice(0, MAX_RESOLUTION_NOTE_LENGTH))
          }
          onResolveOnChain={() => void handleResolveOnChain()}
        />
      ) : null}

      {actionError ? <RouteCallout tone="danger">{actionError}</RouteCallout> : null}
      {actionSuccess ? <RouteCallout tone="success">{actionSuccess}</RouteCallout> : null}

      <AdminTimeline detail={detail} />
    </div>
  );
}

export function AdminDisputeDetailPage({ disputeId }: { readonly disputeId: string }) {
  return (
    <AdminSessionGate>
      <AdminDisputeDetailContent disputeId={disputeId} />
    </AdminSessionGate>
  );
}
