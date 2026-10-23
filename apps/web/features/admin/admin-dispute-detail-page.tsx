"use client";

import { getRequiredAdminContractConfig } from "@/core/config/stellar-contracts";
import { markDisputedOnChain } from "@/core/stellar/escrow-contract";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { getPasskeyEscrowExecutionReadiness } from "@/core/stellar/passkeySmartAccountExecutor";
import {
  isPendingStellarTransactionError,
  normalizeStellarError,
} from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { AdminEvidenceList } from "@/features/admin/admin-evidence-list";
import { AdminRouteLoadingState } from "@/features/admin/admin-route-fallbacks";
import {
  AdminSessionGate,
  ADMIN_QUERY_KEY,
  useAdminSessionAccess,
} from "@/features/admin/admin-session-gate";
import { AdminMark } from "@/features/admin/components/admin-mark";
import { AdminSection } from "@/features/admin/components/admin-operations-ui";
import {
  SETTLEMENT_NOT_SUBMITTED_MESSAGE,
  useAdminSettlement,
} from "@/features/admin/hooks/use-admin-settlement";
import {
  AdminApiError,
  fetchAdminDispute,
  fetchAdminMembershipManagement,
  getAdminApiErrorMessage,
  isAdminAccessError,
  isAdminConsistencyError,
  isAdminNetworkError,
  postAdminModeratorNote,
  postAdminAssignDispute,
  postAdminClaimDispute,
  postAdminReviewStatus,
  shouldRetryAdminRead,
} from "@/features/admin/lib/admin-api";
import { invalidateAdminDisputeCaches } from "@/features/admin/lib/admin-query-cache";
import {
  canClaimAdminDispute,
  canOwnerAssignAdminDispute,
  dedupeAdminWallets,
  getEligibleAdminWallets,
  isDisputeParticipant,
  normalizeAdminWallet,
} from "@/features/admin/lib/assignment-validation";
import {
  deriveSettlementEligibility,
  getResolutionShareDisplayValue,
  isActiveSettlementAttemptStatus,
  validateResolutionShare,
} from "@/features/admin/lib/settlement-validation";
import {
  ProductPageHero,
  RouteCallout,
  RouteEmptyState,
  sanitizeMultilineInput,
  showWarningToast,
  WalletAddressTile,
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
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

import type {
  IAdminDisputeDetail,
  TAdminResolutionStatus,
  TAdminReviewStatus,
} from "@/features/admin/types";
import type { TDisputeParentType, TDisputeStatus } from "@/features/disputes/types";
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
  const normalizedWallet = normalizeAdminWallet(verifiedWallet);

  return (
    normalizedWallet.length > 0 &&
    normalizeAdminWallet(detail.dispute.assignedAdminWallet) === normalizedWallet &&
    !isDisputeParticipant(detail.dispute, normalizedWallet) &&
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
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
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
  /** Validated freelancer share, used only to describe the payout split in plain terms. */
  readonly resolutionShareBps: number | null;
  readonly resolutionNote: string;
  readonly settlementBlockingReason: string | null;
  readonly canSettle: boolean;
  readonly isSubmitting: boolean;
  readonly requiresOnChainReconciliation: boolean;
  /** True while the recovery panel at the top of the page is asking for a reconcile. */
  readonly hasSettlementRecovery: boolean;
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

function sanitizeLimitedMultilineInput(value: string, maxLength: number): string {
  return sanitizeMultilineInput(value).slice(0, maxLength);
}

function DefinitionItem({ label, children }: IDefinitionItemProps) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="hr-text-secondary text-xs leading-5">{label}</dt>
      <dd className="hr-text-primary min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

const FIELD_LABEL_CLASS = "hr-text-secondary text-xs font-medium";
const FIELD_CONTROL_CLASS = "bg-background";

function formatBpsAsPercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

function getAdminParentTypeLabel(parentType: TDisputeParentType): string {
  switch (parentType) {
    case "micro_gig":
      return "Micro-gig";
    case "milestone":
      return "Milestone";
    case "escrow":
      return "Escrow";
    case "job":
      return "Job";
  }
}

function getAdminOpenedByRoleLabel(role: "client" | "freelancer"): string {
  return role === "client" ? "Client" : "Freelancer";
}

function AdminDisputeDetailActions({
  detail,
  canRetryMarkDisputed,
  isSubmitting,
  isRefreshing,
  onRefresh,
  onRetryMarkDisputed,
}: IAdminDisputeDetailActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <AppButton
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing || isSubmitting}
      >
        <RefreshCw
          className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")}
          aria-hidden="true"
        />
        {isRefreshing ? "Refreshing..." : "Refresh detail"}
      </AppButton>
      {detail.dispute.resolutionStellarExpertUrl ? (
        <AppButton asChild variant="outline" size="sm">
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
          className="disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Retrying..." : "Retry mark_disputed"}
        </AppButton>
      ) : null}
    </div>
  );
}

function AdminCaseStatement({ detail }: IAdminCaseBriefProps) {
  return (
    <section aria-labelledby="admin-dispute-statement-title" className="space-y-2">
      <h2 id="admin-dispute-statement-title" className="hr-text-primary text-base font-semibold">
        What happened
      </h2>
      <p className="hr-text-primary max-w-3xl text-sm leading-relaxed whitespace-pre-wrap">
        {detail.dispute.description}
      </p>
    </section>
  );
}

function AdminCaseFacts({ detail }: IAdminCaseBriefProps) {
  const parentTypeLabel = getAdminParentTypeLabel(detail.dispute.parentType);
  const hasLinkedJob =
    Boolean(detail.dispute.jobId) ||
    Boolean(detail.dispute.microGigId) ||
    detail.job !== null ||
    detail.dispute.parentType === "milestone" ||
    detail.dispute.parentType === "escrow" ||
    detail.dispute.parentType === "micro_gig" ||
    detail.dispute.parentType === "job" ||
    Boolean(detail.dispute.milestoneId);
  const hasLinkedMilestone =
    Boolean(detail.dispute.milestoneId) ||
    detail.milestone !== null ||
    detail.dispute.parentType === "milestone";

  return (
    <AdminSection title="Case details" variant="card" accent="band">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <DisputeStatusBadge status={detail.dispute.status} />
        <DisputeOnChainStatusBadge status={detail.dispute.onChainStatus} />
      </div>
      <dl className="divide-y">
        <DefinitionItem label="Reason">
          {getDisputeReasonLabel(detail.dispute.reasonCategory)}
        </DefinitionItem>
        <DefinitionItem label="Opened">{formatDisputeDate(detail.dispute.openedAt)}</DefinitionItem>
        <DefinitionItem label="Updated">
          {formatDisputeDate(detail.dispute.updatedAt)}
        </DefinitionItem>
        <DefinitionItem label="Job">
          {hasLinkedJob ? (detail.job?.title ?? "Unavailable linked job") : "Not linked"}
        </DefinitionItem>
        <DefinitionItem label="Milestone">
          {hasLinkedMilestone
            ? (detail.milestone?.title ?? "Unavailable linked milestone")
            : "Not linked"}
        </DefinitionItem>
        <DefinitionItem label="Parent">
          <span className="font-mono text-xs break-all">
            {parentTypeLabel} · {detail.dispute.parentId}
          </span>
        </DefinitionItem>
        <DefinitionItem label="Escrow ID">
          <span className="font-mono text-xs break-all">
            {detail.dispute.onChainEscrowId ?? detail.dispute.escrowId ?? "Not recorded"}
          </span>
        </DefinitionItem>
        <DefinitionItem label="Opened by">
          <span className="break-all">
            {getAdminOpenedByRoleLabel(detail.dispute.openedByRole)} ·{" "}
            {detail.dispute.openedByWallet}
          </span>
        </DefinitionItem>
        <DefinitionItem label="Resolution">
          {detail.dispute.resolutionNote ?? "No final note recorded"}
        </DefinitionItem>
      </dl>

      <div className="mt-4 space-y-3 border-t pt-4">
        <WalletAddressTile address={detail.dispute.clientWallet} label="Client Wallet" />
        <WalletAddressTile address={detail.dispute.freelancerWallet} label="Freelancer Wallet" />
      </div>
    </AdminSection>
  );
}

function AdminCaseEvidence({ detail }: IAdminCaseBriefProps) {
  return (
    <AdminSection
      title="Case Evidence"
      description="Files and links attached when the dispute was opened or added later."
      variant="card"
    >
      <AdminEvidenceList
        attachmentIds={detail.dispute.evidenceAttachmentIds}
        attachments={detail.dispute.attachments}
      />
    </AdminSection>
  );
}

type TAdminLinkedRecordGroup = {
  readonly label: string;
  readonly ids: readonly string[];
};

function dedupeLinkedRecordIds(ids: readonly string[] | undefined): readonly string[] {
  return ids ? Array.from(new Set(ids.map(String))) : [];
}

function getAdminLinkedRecordGroups(
  detail: IAdminDisputeDetail,
): readonly TAdminLinkedRecordGroup[] {
  return [
    {
      label: "Submissions",
      ids: dedupeLinkedRecordIds(detail.dispute.relatedWorkSubmissionIds),
    },
    {
      label: "Revisions",
      ids: dedupeLinkedRecordIds(detail.dispute.relatedRevisionRequestIds),
    },
    {
      label: "Messages",
      ids: dedupeLinkedRecordIds(detail.dispute.relatedMessageIds),
    },
    {
      label: "Deadlines",
      ids: dedupeLinkedRecordIds(detail.dispute.relatedDeadlineEventIds),
    },
  ];
}

function AdminLinkedRecordGroup({ group }: { readonly group: TAdminLinkedRecordGroup }) {
  if (group.ids.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={`linked-records-${group.label.toLowerCase()}`} className="space-y-2">
      <h3
        id={`linked-records-${group.label.toLowerCase()}`}
        className="hr-text-secondary text-xs font-medium"
      >
        {group.label} <span className="hr-text-muted hr-num">({group.ids.length})</span>
      </h3>
      <ul className="space-y-1.5">
        {group.ids.map((id) => (
          <li key={id} className="min-w-0 rounded-md border bg-muted/30 px-3 py-2">
            <span className="hr-text-primary block min-w-0 font-mono text-xs break-all">{id}</span>
            <span className="hr-text-muted mt-0.5 block text-xs">
              Content unavailable in this view.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdminLinkedRecords({ detail }: IAdminCaseBriefProps) {
  const groups = getAdminLinkedRecordGroups(detail);
  const hasLinkedRecords = groups.some((group) => group.ids.length > 0);

  return (
    <AdminSection
      title="Linked Records"
      description="Reference IDs only. Protected submission, revision, message, and deadline content is not loaded here."
      variant="card"
    >
      {hasLinkedRecords ? (
        <div className="space-y-4">
          {groups.map((group) => (
            <AdminLinkedRecordGroup key={group.label} group={group} />
          ))}
        </div>
      ) : (
        <RouteEmptyState description="No linked records." />
      )}
    </AdminSection>
  );
}

function AdminAssignmentWorkspace({
  detail,
  verifiedWallet,
  isOwner,
  activeAdminWallets,
  assignedAdminAccessState,
  isMembershipLoading,
  isMembershipError,
  isMembershipReady,
  isSettlementActive,
  isSubmitting,
  onClaim,
  onAssign,
}: {
  readonly detail: IAdminDisputeDetail;
  readonly verifiedWallet: string;
  readonly isOwner: boolean;
  readonly activeAdminWallets: readonly string[];
  readonly assignedAdminAccessState?: string;
  readonly isMembershipLoading: boolean;
  readonly isMembershipError: boolean;
  readonly isMembershipReady: boolean;
  readonly isSettlementActive: boolean;
  readonly isSubmitting: boolean;
  readonly onClaim: () => void;
  readonly onAssign: (wallet: string | null) => void;
}) {
  const assignedWallet = normalizeAdminWallet(detail.dispute.assignedAdminWallet) || null;
  const eligibleAdminWallets = getEligibleAdminWallets(detail.dispute, activeAdminWallets);
  const canAssign =
    canOwnerAssignAdminDispute(detail.dispute, verifiedWallet, isOwner) && isMembershipReady;
  const canClaim = canClaimAdminDispute(detail.dispute, verifiedWallet);
  const unavailableAssignedWallet =
    assignedWallet && !eligibleAdminWallets.includes(assignedWallet) ? assignedWallet : null;

  return (
    <AdminSection
      title="Assignment"
      description="Only the assigned active admin can act on this case. The platform owner can reassign or release it."
      variant="card"
      accent="band"
    >
      <div className="space-y-3">
        <div>
          <p className={FIELD_LABEL_CLASS}>Current assignee</p>
          <p
            className={cn(
              "mt-1 text-sm break-all",
              assignedWallet ? "hr-text-primary font-mono" : "font-medium text-amber-700",
            )}
          >
            {assignedWallet ?? "Unassigned"}
            {assignedWallet && assignedAdminAccessState && assignedAdminAccessState !== "active"
              ? ` · ${assignedAdminAccessState}`
              : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {canClaim ? (
            <AppButton
              type="button"
              size="sm"
              className="w-full"
              disabled={isSubmitting}
              onClick={onClaim}
            >
              Claim Case
            </AppButton>
          ) : null}
          {isOwner ? (
            <select
              aria-label="Assign case to dispute admin"
              title="Assign case to dispute admin"
              className="h-9 w-full truncate rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              value={assignedWallet ?? ""}
              disabled={isSubmitting || !canAssign || isSettlementActive}
              onChange={(event) => onAssign(event.target.value || null)}
            >
              <option value="">Unassigned</option>
              {unavailableAssignedWallet ? (
                <option value={unavailableAssignedWallet} disabled>
                  Unavailable: {unavailableAssignedWallet}
                </option>
              ) : null}
              {eligibleAdminWallets.map((wallet) => (
                <option key={wallet} value={wallet}>
                  {wallet === normalizeAdminWallet(verifiedWallet) ? "Owner (you)" : wallet}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
      {isOwner && isMembershipLoading ? (
        <p className="hr-text-secondary mt-3 text-xs" role="status" aria-live="polite">
          Loading eligible dispute admins. Assignment remains disabled until membership is verified.
        </p>
      ) : null}
      {isOwner && isMembershipError ? (
        <p className="mt-3 text-xs leading-relaxed text-red-700" role="alert">
          Eligible dispute admins could not be loaded. Assignment remains disabled until the
          membership read succeeds.
        </p>
      ) : null}
      {isOwner && isSettlementActive ? (
        <p className="mt-3 text-xs text-amber-800" role="status" aria-live="polite">
          Reassignment is disabled while a settlement attempt is active.
        </p>
      ) : null}
      {detail.assignmentEvents.length ? (
        <div className="mt-4 border-t pt-4">
          <p className={FIELD_LABEL_CLASS}>History</p>
          <ol className="mt-2 space-y-2">
            {detail.assignmentEvents.map((event) => (
              <li key={event._id} className="hr-text-muted text-xs leading-relaxed break-all">
                <span className="hr-text-secondary font-medium capitalize">
                  {event.type.replaceAll("_", " ")}
                </span>{" "}
                · {event.actorWallet}
                {event.assignedAdminWallet ? ` → ${event.assignedAdminWallet}` : ""}
                {event.previousAdminWallet ? ` (from ${event.previousAdminWallet})` : ""}
                {` · ${formatDisputeDate(event.createdAt)}`}
              </li>
            ))}
          </ol>
        </div>
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
      title="Moderator Workflow"
      description="Add internal context or request a party response without leaving the case record."
      variant="card"
      accent="band"
    >
      <div className="grid gap-6 xl:grid-cols-2 xl:divide-x">
        <div className="flex flex-col gap-2 xl:pr-6">
          <label htmlFor="moderator-note" className={FIELD_LABEL_CLASS}>
            Moderator note
          </label>
          <Textarea
            id="moderator-note"
            value={moderatorNote}
            onChange={(event) => onModeratorNoteChange(event.target.value)}
            className={cn("min-h-32 flex-1", FIELD_CONTROL_CLASS)}
            placeholder="Add context for the dispute timeline."
            disabled={isSubmitting}
            maxLength={MAX_MODERATOR_NOTE_LENGTH}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="hr-text-muted hr-num text-xs">
              {moderatorNote.length}/{MAX_MODERATOR_NOTE_LENGTH}
            </p>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onAddModeratorNote}
              disabled={isSubmitting}
            >
              Save Note
            </AppButton>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-6 xl:border-t-0 xl:pt-0 xl:pl-6">
          <label htmlFor="review-status" className={FIELD_LABEL_CLASS}>
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
            className={cn("h-9 w-full", FIELD_CONTROL_CLASS)}
            disabled={isSubmitting}
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <label htmlFor="review-message" className={cn(FIELD_LABEL_CLASS, "mt-2")}>
            Optional review message
          </label>
          <Textarea
            id="review-message"
            value={reviewMessage}
            onChange={(event) => onReviewMessageChange(event.target.value)}
            className={cn("min-h-20", FIELD_CONTROL_CLASS)}
            placeholder="Shown to both parties with the status change."
            disabled={isSubmitting}
            maxLength={MAX_REVIEW_MESSAGE_LENGTH}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="hr-text-muted hr-num text-xs">
              {reviewMessage.length}/{MAX_REVIEW_MESSAGE_LENGTH}
            </p>
            <AppButton
              type="button"
              variant="secondary"
              size="sm"
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
  resolutionShareBps,
  resolutionNote,
  settlementBlockingReason,
  canSettle,
  isSubmitting,
  requiresOnChainReconciliation,
  hasSettlementRecovery,
  onResolutionStatusChange,
  onResolutionShareInputChange,
  onResolutionNoteChange,
  onResolveOnChain,
}: IAdminResolutionWorkspaceProps) {
  return (
    <AdminSection
      title="Resolve Dispute On-chain"
      description="Settlement calls resolve_dispute with the assigned, active dispute admin wallet."
      variant="card"
      accent="band"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid content-start gap-1.5 text-sm" htmlFor="resolution-status">
          <span className={FIELD_LABEL_CLASS}>Resolution</span>
          <NativeSelect
            id="resolution-status"
            value={resolutionStatus}
            onChange={(event) =>
              onResolutionStatusChange(event.target.value as TAdminResolutionStatus)
            }
            className={cn("h-9 w-full", FIELD_CONTROL_CLASS)}
            disabled={isSubmitting}
          >
            {RESOLUTION_STATUS_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>

        <label className="grid content-start gap-1.5 text-sm" htmlFor="resolution-share-bps">
          <span className={FIELD_LABEL_CLASS}>
            Freelancer share <span className="hr-text-muted font-normal">(basis points)</span>
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
            className={cn("h-9 disabled:opacity-60", FIELD_CONTROL_CLASS)}
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

        <label className="grid gap-1.5 text-sm sm:col-span-2" htmlFor="resolution-note">
          <span className={FIELD_LABEL_CLASS}>Resolution note</span>
          <Textarea
            id="resolution-note"
            aria-label="Resolution note"
            value={resolutionNote}
            onChange={(event) => onResolutionNoteChange(event.target.value)}
            className={cn("min-h-20", FIELD_CONTROL_CLASS)}
            disabled={isSubmitting}
            placeholder="Optional internal context for this resolution."
            maxLength={MAX_RESOLUTION_NOTE_LENGTH}
          />
        </label>
      </div>

      {resolutionShareBps !== null ? (
        <div className="mt-4 grid grid-cols-2 divide-x overflow-hidden rounded-md border bg-muted/30 text-sm">
          <div className="px-3 py-2">
            <p className="hr-text-secondary text-xs">Freelancer receives</p>
            <p className="hr-text-primary hr-num font-semibold">
              {formatBpsAsPercent(resolutionShareBps)}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="hr-text-secondary text-xs">Client refunded</p>
            <p className="hr-text-primary hr-num font-semibold">
              {formatBpsAsPercent(10_000 - resolutionShareBps)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <div className="hr-text-secondary max-w-xl space-y-1 text-xs leading-relaxed">
          <p>
            Split values are validated as basis points. Client and freelancer resolutions are locked
            to 0 and 10000 respectively.
          </p>
          {settlementBlockingReason ? (
            <p className="text-sm text-amber-800" role="status" aria-live="polite">
              {settlementBlockingReason}
            </p>
          ) : null}
          {hasSettlementRecovery ? (
            <a
              href={`#${SETTLEMENT_RECOVERY_ID}`}
              className="inline-flex text-sm font-medium text-amber-800 underline"
            >
              Go to the Reconcile step ↑
            </a>
          ) : null}
        </div>
        <AppButton
          type="button"
          onClick={onResolveOnChain}
          disabled={
            isSubmitting ||
            requiresOnChainReconciliation ||
            !canSettle ||
            resolutionShareError !== null
          }
          className="disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Resolving..." : "Resolve On-Chain"}
        </AppButton>
      </div>
    </AdminSection>
  );
}

const SETTLEMENT_RECOVERY_ID = "settlement-recovery";

interface IAdminSettlementRecoveryPanelProps {
  readonly attempts: IAdminDisputeDetail["settlementAttempts"];
  readonly requiresOnChainReconciliation: boolean;
  readonly isSubmitting: boolean;
  readonly onReconcileAttempt: (operationId: string, transactionHash?: string | null) => void;
  readonly onReconcileOnChainResult: () => void;
}

/**
 * Settlement recovery, shown first on the page: a settlement transaction was started but its
 * outcome was never recorded, so new settlement stays blocked until the result is checked.
 */
function AdminSettlementRecoveryPanel({
  attempts,
  requiresOnChainReconciliation,
  isSubmitting,
  onReconcileAttempt,
  onReconcileOnChainResult,
}: IAdminSettlementRecoveryPanelProps) {
  if (attempts.length === 0 && !requiresOnChainReconciliation) {
    return null;
  }

  return (
    <section
      id={SETTLEMENT_RECOVERY_ID}
      aria-labelledby={`${SETTLEMENT_RECOVERY_ID}-title`}
      className="scroll-mt-6 overflow-hidden rounded-lg border border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30"
    >
      <header className="border-b border-amber-200 px-4 py-3 sm:px-5 dark:border-amber-800">
        <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
          Action needed
        </p>
        <h2
          id={`${SETTLEMENT_RECOVERY_ID}-title`}
          className="hr-text-primary mt-0.5 text-base font-semibold"
        >
          Confirm the settlement result
        </h2>
        <p className="hr-text-secondary mt-1 max-w-2xl text-sm leading-relaxed">
          A settlement transaction was started, but its result was never recorded in Highrable.
          Reconcile checks Stellar for that transaction and records what actually happened. It never
          sends a new transaction, so funds cannot move twice. Settlement stays locked until this is
          done.
        </p>
      </header>

      <div className="space-y-3 p-4 sm:p-5">
        {attempts.map((attempt) => {
          const canReconcileAttempt =
            Boolean(attempt.transactionHash) || attempt.status === "started";

          return (
            <div
              key={attempt._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-background p-4"
            >
              <dl className="grid min-w-0 flex-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
                <dt className="hr-text-secondary text-xs leading-5">Attempt status</dt>
                <dd className="hr-text-primary font-medium capitalize">
                  {attempt.status.replaceAll("_", " ")}
                </dd>
                <dt className="hr-text-secondary text-xs leading-5">Started by</dt>
                <dd className="hr-text-muted min-w-0 font-mono text-xs leading-5 break-all">
                  {attempt.actorWallet}
                </dd>
                <dt className="hr-text-secondary text-xs leading-5">Transaction</dt>
                <dd className="hr-text-muted min-w-0 font-mono text-xs leading-5 break-all">
                  {attempt.transactionHash ?? "Awaiting signed transaction"}
                </dd>
              </dl>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <AppButton
                  type="button"
                  disabled={isSubmitting || !canReconcileAttempt}
                  onClick={() => onReconcileAttempt(attempt.operationId, attempt.transactionHash)}
                  className="disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Checking…" : "Reconcile"}
                </AppButton>
                {!canReconcileAttempt ? (
                  <p className="hr-text-muted max-w-48 text-xs leading-relaxed sm:text-right">
                    Waiting for a transaction hash. Refresh the detail to check again.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}

        {requiresOnChainReconciliation ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-background p-4">
            <p className="hr-text-secondary max-w-xl text-sm leading-relaxed">
              Highrable searches this admin wallet&apos;s Stellar history for a successful
              resolution of this escrow, verifies the transaction and current contract state, then
              updates the dispute record without submitting another transaction.
            </p>
            <AppButton type="button" onClick={onReconcileOnChainResult} disabled={isSubmitting}>
              {isSubmitting ? "Searching Stellar history…" : "Retry automatic reconciliation"}
            </AppButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AdminTimeline({ detail }: IAdminTimelineProps) {
  return (
    <AdminSection
      title="Timeline"
      description="Chronological dispute events, evidence references, and moderation activity."
      variant="card"
      action={
        <p className="hr-text-muted hr-num text-xs">
          {detail.timeline.length} event{detail.timeline.length === 1 ? "" : "s"}
        </p>
      }
    >
      {detail.timeline.length === 0 ? (
        <RouteEmptyState description="No timeline events yet." />
      ) : (
        <ol className="relative ml-1 space-y-0 border-l">
          {detail.timeline.map((event) => (
            <li key={event._id} className="relative grid gap-2 pb-5 pl-5 last:pb-0">
              <span
                className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-background bg-(image:--mode-gradient) ring-1 ring-border"
                aria-hidden="true"
              />
              <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                <p className="hr-text-primary text-sm leading-relaxed">{event.message}</p>
                <time className="hr-text-muted text-xs whitespace-nowrap sm:text-right">
                  {formatDisputeDate(event.createdAt)}
                </time>
              </div>
              {(event.attachmentIds?.length ?? 0) > 0 || (event.attachments?.length ?? 0) > 0 ? (
                <AdminEvidenceList
                  attachmentIds={event.attachmentIds ?? []}
                  attachments={event.attachments ?? []}
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </AdminSection>
  );
}

interface IAdminSettlementProgressProps {
  readonly phase: string;
  readonly phaseLabel: string;
  readonly isExecuting: boolean;
  readonly operationId: string | null;
  readonly transactionHash: string | null;
  readonly transactionExplorerUrl: string | null;
  readonly error: string | null;
  readonly success: string | null;
}

function AdminSettlementProgress({
  phase,
  phaseLabel,
  isExecuting,
  operationId,
  transactionHash,
  transactionExplorerUrl,
  error,
  success,
}: IAdminSettlementProgressProps) {
  if (phase === "idle" && !operationId && !error && !success) {
    return null;
  }

  if (error === SETTLEMENT_NOT_SUBMITTED_MESSAGE) {
    return (
      <AdminSection
        title="Unfinished attempt closed"
        description="Reconcile result"
        variant="card"
        className="border-l-2 border-l-emerald-500"
      >
        <div className="hr-text-secondary space-y-2 text-sm" role="status" aria-live="polite">
          <p className="hr-text-primary">{error}</p>
          <p>
            The wallet never signed this attempt, so nothing was sent to Stellar and no funds moved.
            Use Resolve On-Chain to settle the dispute again.
          </p>
        </div>
      </AdminSection>
    );
  }

  return (
    <AdminSection
      title={phaseLabel}
      description="Settlement status"
      variant="card"
      className={cn(
        "border-l-2",
        error ? "border-l-red-500" : success ? "border-l-emerald-500" : "border-l-amber-400",
      )}
    >
      <div className="hr-text-secondary space-y-2 text-sm" role="status" aria-live="polite">
        <p className="flex items-center gap-2">
          {isExecuting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {isExecuting ? `${phaseLabel}…` : phaseLabel}
        </p>
        {operationId ? (
          <p className="hr-text-muted font-mono text-xs break-all">Operation: {operationId}</p>
        ) : null}
        {transactionHash ? (
          <p className="hr-text-muted font-mono text-xs break-all">
            Transaction:{" "}
            {transactionExplorerUrl ? (
              <a
                href={transactionExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {transactionHash}
              </a>
            ) : (
              transactionHash
            )}
          </p>
        ) : null}
        {error ? (
          <p className="text-red-700" role="alert">
            {phaseLabel}: {error}
          </p>
        ) : null}
        {success ? <p className="text-emerald-700">{success}</p> : null}
      </div>
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
  const [assignmentRefreshFailed, setAssignmentRefreshFailed] = useState(false);
  const [detailRefreshFailed, setDetailRefreshFailed] = useState(false);

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
      setDetailRefreshFailed(true);
      throw result.error;
    }
    setDetailRefreshFailed(false);
  }, [detailQuery.refetch]);

  const invalidateAdminDisputeQueue = useCallback(async () => {
    await invalidateAdminDisputeCaches(queryClient, verifiedWallet, disputeId);
  }, [disputeId, queryClient, verifiedWallet]);

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
    setAssignmentRefreshFailed(false);
    setDetailRefreshFailed(false);
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
  const settlement = useAdminSettlement({
    disputeId,
    detail,
    verifiedWallet,
    activeWalletAddress,
    activeWalletType,
    connectedWalletAddress: address,
    isWalletConnected: walletState.isConnected,
    isTestnet: walletState.isTestnet,
    canWriteContracts: walletState.canWriteContracts,
    signTransaction,
    resolutionStatus,
    freelancerShareBps: resolutionShareValidation.freelancerShareBps,
    resolutionNote: sanitizeLimitedMultilineInput(resolutionNote, MAX_RESOLUTION_NOTE_LENGTH),
    canSettle: settlementEligibility.canSettle,
    blockingReason: settlementEligibility.blockingReason,
    loadDetail,
    invalidateAdminDisputeQueue,
    handleProtectedApiError,
  });
  const isAnyActionRunning = isSubmitting || settlement.isExecuting;
  const isSettlementAttemptActive =
    detail?.settlementAttempts.some((attempt) => isActiveSettlementAttemptStatus(attempt.status)) ??
    false;
  const isMembershipReady = !isOwner || membershipQuery.isSuccess;
  const activeAdminWallets = membershipQuery.isSuccess
    ? dedupeAdminWallets([
        verifiedWallet,
        ...membershipQuery.data.admins
          .filter((admin) => admin.accessState === "active")
          .map((admin) => admin.wallet),
      ])
    : [];
  const canClaimCurrentDispute = detail
    ? canClaimAdminDispute(detail.dispute, verifiedWallet)
    : false;
  const canAssignCurrentDispute = detail
    ? canOwnerAssignAdminDispute(detail.dispute, verifiedWallet, isOwner) && isMembershipReady
    : false;
  const canSettle = settlementEligibility.canSettle && !settlement.blocksNewAttempt;
  const settlementBlockingReason = settlement.blocksNewAttempt
    ? "Settlement requires reconciliation before another attempt can start."
    : settlementEligibility.blockingReason;

  const handleClaimCase = useCallback(async () => {
    if (isAnyActionRunning) {
      return;
    }

    if (!detail || !canClaimCurrentDispute) {
      const nextWarning =
        "Claim requires an unassigned, nonterminal case and a verified nonparticipant admin wallet.";
      setActionError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    setAssignmentRefreshFailed(false);
    let assignmentWriteSucceeded = false;
    try {
      await postAdminClaimDispute(disputeId);
      assignmentWriteSucceeded = true;
      await invalidateAdminDisputeQueue();
      await loadDetail();
      setActionSuccess("Case claimed.");
    } catch (error) {
      handleProtectedApiError(error);
      if (assignmentWriteSucceeded) {
        if (isAdminAccessError(error)) {
          return;
        }
        setAssignmentRefreshFailed(true);
        setActionError(
          "The case was claimed, but the detail could not be refreshed. Retry the read; the claim will not be repeated.",
        );
      } else {
        setActionError(error instanceof Error ? error.message : "Could not claim the case.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canClaimCurrentDispute,
    detail,
    disputeId,
    handleProtectedApiError,
    invalidateAdminDisputeQueue,
    isAnyActionRunning,
    loadDetail,
  ]);

  const handleAssignCase = useCallback(
    async (assignedAdminWallet: string | null) => {
      if (isAnyActionRunning) {
        return;
      }

      const eligibleAdminWallets = detail
        ? getEligibleAdminWallets(detail.dispute, activeAdminWallets)
        : [];
      const normalizedAssignedWallet = normalizeAdminWallet(assignedAdminWallet);
      const isValidAssignmentTarget =
        !normalizedAssignedWallet || eligibleAdminWallets.includes(normalizedAssignedWallet);

      if (
        !detail ||
        !canAssignCurrentDispute ||
        isSettlementAttemptActive ||
        !isValidAssignmentTarget
      ) {
        const nextWarning = !detail
          ? "Assignment is unavailable until dispute details are loaded."
          : isSettlementAttemptActive
            ? "Reassignment is unavailable while a settlement attempt is active."
            : !canAssignCurrentDispute
              ? "Only a verified nonparticipant owner can assign this case after membership is loaded."
              : "Select an active, nonparticipant dispute admin.";
        setActionError(nextWarning);
        showWarningToast(nextWarning);
        return;
      }

      setIsSubmitting(true);
      setActionError(null);
      setActionSuccess(null);
      setAssignmentRefreshFailed(false);
      let assignmentWriteSucceeded = false;
      try {
        await postAdminAssignDispute(disputeId, normalizedAssignedWallet || null);
        assignmentWriteSucceeded = true;
        await invalidateAdminDisputeQueue();
        await loadDetail();
        setActionSuccess(
          normalizedAssignedWallet ? "Case assignment updated." : "Case unassigned.",
        );
      } catch (error) {
        handleProtectedApiError(error);
        if (assignmentWriteSucceeded) {
          if (isAdminAccessError(error)) {
            return;
          }
          setAssignmentRefreshFailed(true);
          setActionError(
            "The case assignment was saved, but the detail could not be refreshed. Retry the read; the assignment will not be repeated.",
          );
        } else {
          setActionError(
            error instanceof Error ? error.message : "Could not update case assignment.",
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeAdminWallets,
      canAssignCurrentDispute,
      detail,
      disputeId,
      handleProtectedApiError,
      invalidateAdminDisputeQueue,
      isSettlementAttemptActive,
      isAnyActionRunning,
      loadDetail,
    ],
  );

  const canRetryMarkDisputed =
    detail?.dispute.onChainStatus === "mark_failed" &&
    Boolean(detail?.dispute.onChainEscrowId) &&
    Boolean(activeWalletAddress) &&
    Boolean(activeWalletType);

  const handleAddModeratorNote = useCallback(async () => {
    if (isAnyActionRunning) {
      return;
    }

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
  }, [disputeId, handleProtectedApiError, isAnyActionRunning, loadDetail, moderatorNote]);

  const handleChangeReviewStatus = useCallback(async () => {
    if (isAnyActionRunning) {
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
    setAssignmentRefreshFailed(false);
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
      if (statusWriteSucceeded && isAdminAccessError(nextError)) {
        return;
      }
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
    isAnyActionRunning,
    loadDetail,
    reviewMessage,
    reviewStatus,
  ]);

  const handleRetryDetailRead = useCallback(async () => {
    if (detailQuery.isFetching) {
      return;
    }

    const result = await detailQuery.refetch();
    if (result.error) {
      setDetailRefreshFailed(true);
      return;
    }
    setDetailRefreshFailed(false);
    setReviewStatusRefreshFailed(false);
    setAssignmentRefreshFailed(false);
    settlement.clearRefreshError();
    setActionError(null);
  }, [detailQuery.isFetching, detailQuery.refetch, settlement]);

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

  if (detailQuery.isPending) {
    return <AdminRouteLoadingState label="dispute detail" />;
  }

  if (detailQuery.isError || detailRefreshFailed) {
    const detailError = detailQuery.error;
    if (!detailError) {
      return (
        <RouteCallout tone="danger">
          Dispute detail could not be loaded. Retry the request or return to the queue.{" "}
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

    if (isAdminConsistencyError(detailError)) {
      return (
        <RouteCallout tone="danger">
          <span>Dispute detail could not be verified for consistency.</span>{" "}
          <Link className="underline" href="/admin/disputes">
            Return to the dispute queue
          </Link>{" "}
          <AppButton
            type="button"
            variant="secondary"
            size="sm"
            className="ml-3"
            onClick={() => void handleRetryDetailRead()}
            disabled={detailQuery.isFetching}
          >
            {detailQuery.isFetching ? "Retrying..." : "Retry read"}
          </AppButton>
        </RouteCallout>
      );
    }

    if (
      !reviewStatusRefreshFailed &&
      !assignmentRefreshFailed &&
      !settlement.refreshError &&
      detailError.status === 404
    ) {
      return (
        <RouteCallout tone="warning">
          <span>Dispute not found.</span>{" "}
          <Link className="underline" href="/admin/disputes">
            Return to the dispute queue
          </Link>
        </RouteCallout>
      );
    }

    if (
      !reviewStatusRefreshFailed &&
      !assignmentRefreshFailed &&
      !settlement.refreshError &&
      detailError.status === 400
    ) {
      return (
        <RouteCallout tone="danger">
          This dispute request is invalid. Check the dispute ID and return to the queue.
        </RouteCallout>
      );
    }

    return (
      <RouteCallout tone="danger">
        {detailError.status === 401
          ? "Admin authentication is required before this dispute can be read."
          : detailError.status === 403
            ? "Admin access is forbidden for this dispute request."
            : assignmentRefreshFailed
              ? "The assignment was saved, but the detail refresh failed. Retry the read; the assignment mutation will not be repeated."
              : reviewStatusRefreshFailed
                ? "Review status was saved, but the detail refresh failed. Retry the read; the status mutation will not be repeated."
                : settlement.refreshError
                  ? settlement.refreshError
                  : isAdminNetworkError(detailError)
                    ? "The dispute detail could not be reached. Check your connection and retry."
                    : getAdminApiErrorMessage(detailError) ||
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
  const activeSettlementAttempts = detail.settlementAttempts.filter((attempt) =>
    isActiveSettlementAttemptStatus(attempt.status),
  );
  // The automatic search was previously only offered alongside the (non-terminal) resolution form.
  const requiresOnChainReconciliation =
    !isReadOnlyDispute && settlement.phase === "reconciliation_required";
  const hasSettlementRecovery =
    activeSettlementAttempts.length > 0 || requiresOnChainReconciliation;
  const canShowRetryMarkDisputed = canRetryMarkDisputed && !isReadOnlyDispute;
  const isAssignedAdmin = canReviewCurrentDispute;
  const assignedAdminAccessState = detail.dispute.assignedAdminWallet
    ? (membershipQuery.data?.admins.find(
        (admin) =>
          normalizeAdminWallet(admin.wallet) ===
          normalizeAdminWallet(detail.dispute.assignedAdminWallet),
      )?.accessState ??
      (normalizeAdminWallet(detail.dispute.assignedAdminWallet) ===
      normalizeAdminWallet(verifiedWallet)
        ? "active"
        : "not active"))
    : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b pb-5">
        <Link
          href="/admin/disputes"
          className="hr-text-muted inline-flex text-sm hover:text-foreground hover:underline"
        >
          ← All disputes
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <ProductPageHero
            meta={
              <>
                <AdminMark /> · {detail.dispute.disputeNumber}
              </>
            }
            title={detail.dispute.title}
            description={`${getDisputeReasonLabel(detail.dispute.reasonCategory)} · Opened ${formatDisputeDate(detail.dispute.openedAt)}`}
          />
          <AdminDisputeDetailActions
            detail={detail}
            canRetryMarkDisputed={canShowRetryMarkDisputed}
            isSubmitting={isAnyActionRunning}
            isRefreshing={detailQuery.isFetching}
            onRefresh={() => void handleRetryDetailRead()}
            onRetryMarkDisputed={() => void handleRetryMarkDisputed()}
          />
        </div>
        <p className="hr-text-secondary flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>Status: {getDisputeStatusLabel(detail.dispute.status)}</span>
          <span>On-chain: {getDisputeOnChainStatusLabel(detail.dispute.onChainStatus)}</span>
          <span>Events: {detail.timeline.length}</span>
          {hasSettlementRecovery ? (
            <a
              href={`#${SETTLEMENT_RECOVERY_ID}`}
              className="inline-flex items-center rounded-full bg-amber-100 px-2 text-xs leading-5 font-medium text-amber-900 hover:underline dark:bg-amber-900/40 dark:text-amber-200"
            >
              Action needed: reconcile settlement
            </a>
          ) : null}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <aside className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
          <AdminCaseFacts detail={detail} />

          <AdminAssignmentWorkspace
            detail={detail}
            verifiedWallet={verifiedWallet}
            isOwner={isOwner}
            activeAdminWallets={activeAdminWallets}
            assignedAdminAccessState={assignedAdminAccessState}
            isMembershipLoading={isOwner && membershipQuery.isPending}
            isMembershipError={isOwner && membershipQuery.isError}
            isMembershipReady={isMembershipReady}
            isSettlementActive={isSettlementAttemptActive}
            isSubmitting={isAnyActionRunning}
            onClaim={() => void handleClaimCase()}
            onAssign={(wallet) => void handleAssignCase(wallet)}
          />

          <AdminLinkedRecords detail={detail} />
        </aside>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <AdminSettlementRecoveryPanel
            attempts={activeSettlementAttempts}
            requiresOnChainReconciliation={requiresOnChainReconciliation}
            isSubmitting={isAnyActionRunning}
            onReconcileAttempt={(operationId, transactionHash) =>
              void settlement.reconcile(operationId, transactionHash)
            }
            onReconcileOnChainResult={() => void settlement.reconcileOnChainResult()}
          />

          {canShowRetryMarkDisputed ? (
            <RouteCallout tone="danger">
              The previous on-chain dispute mark failed. Retry will attempt mark_disputed again and
              sync escrow status. This starts a new chain operation; the failure label alone does
              not establish transaction retry safety.
            </RouteCallout>
          ) : null}

          {!isReadOnlyDispute && !isAssignedAdmin ? (
            <RouteCallout tone="warning">
              Assign this case to your wallet before adding moderator notes, changing review status,
              or starting settlement.
            </RouteCallout>
          ) : null}

          <AdminCaseStatement detail={detail} />

          <AdminCaseEvidence detail={detail} />

          {!isReadOnlyDispute && isAssignedAdmin ? (
            <>
              <AdminModeratorWorkspace
                moderatorNote={moderatorNote}
                reviewMessage={reviewMessage}
                reviewStatus={reviewStatus}
                isSubmitting={isAnyActionRunning}
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
              resolutionShareBps={
                resolutionShareValidation.isValid
                  ? resolutionShareValidation.freelancerShareBps
                  : null
              }
              resolutionNote={resolutionNote}
              settlementBlockingReason={settlementBlockingReason}
              canSettle={canSettle}
              isSubmitting={isAnyActionRunning}
              requiresOnChainReconciliation={settlement.phase === "reconciliation_required"}
              hasSettlementRecovery={hasSettlementRecovery}
              onResolutionStatusChange={(value) => {
                setResolutionStatus(value);
              }}
              onResolutionShareInputChange={setResolutionShareInput}
              onResolutionNoteChange={(value) =>
                setResolutionNote(value.slice(0, MAX_RESOLUTION_NOTE_LENGTH))
              }
              onResolveOnChain={() => void settlement.resolve()}
            />
          ) : null}

          <AdminSettlementProgress
            phase={settlement.phase}
            phaseLabel={settlement.phaseLabel}
            isExecuting={settlement.isExecuting}
            operationId={settlement.attempt?.operationId ?? null}
            transactionHash={settlement.attempt?.transactionHash ?? null}
            transactionExplorerUrl={settlement.transactionExplorerUrl}
            error={settlement.error}
            success={settlement.success}
          />

          {actionError ? <RouteCallout tone="danger">{actionError}</RouteCallout> : null}
          {actionSuccess ? <RouteCallout tone="success">{actionSuccess}</RouteCallout> : null}

          <AdminTimeline detail={detail} />
        </div>
      </div>
    </div>
  );
}

export function AdminDisputeDetailPage({ disputeId }: { readonly disputeId: string }) {
  return (
    <AdminSessionGate>
      <AdminDisputeDetailContent key={disputeId} disputeId={disputeId} />
    </AdminSessionGate>
  );
}
