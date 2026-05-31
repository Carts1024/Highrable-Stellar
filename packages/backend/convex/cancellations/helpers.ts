import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TWalletType } from "../users/schema";
import type {
  TCancellationActorRole,
  TCancellationEventType,
  TCancellationParentType,
  TCancellationReasonCategory,
  TCancellationStatus,
  TCancellationType,
} from "./schema";

import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";
import { assertCanViewAttachment } from "../attachments/helpers";
import { createSystemMessageForEvent } from "../conversations/helpers";
import { computeDeadlineStatus } from "../deadlines/helpers";
import { getActiveDisputeForEscrowId, isActiveDisputeStatus } from "../disputes/helpers";
import { ACTIVE_CANCELLATION_STATUSES } from "./schema";

const MAX_REASON_TEXT_LENGTH = 4000;
const MAX_RESPONSE_TEXT_LENGTH = 4000;
const MAX_EVENT_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENTS = 10;
const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_CANCELLATION_STATUS_SET = new Set<string>(ACTIVE_CANCELLATION_STATUSES);
const PROOF_SUBMITTED_STATUSES = new Set([
  "submitted_for_review",
  "revision_submitted",
  "accepted_for_final",
  "submitted",
  "anchoring",
  "anchored",
  "anchor_failed",
]);
const ACTIVE_REVISION_STATUSES = new Set(["requested", "acknowledged"]);
const CLIENT_RESOLVED_DISPUTE_STATUSES = new Set(["resolved_client"]);

export type TCancellationParticipantRole = "client" | "freelancer";

export type TResolvedCancellationParent = {
  parentType: TCancellationParentType;
  parentId: string;
  jobId: Id<"jobs">;
  microGigId?: Id<"jobs">;
  milestoneId?: Id<"milestones">;
  escrowId?: Id<"escrows">;
  onChainEscrowId?: string;
  clientWallet: string;
  freelancerWallet?: string;
  status: string;
  escrowStatus?: string;
  deadlineAt?: number;
  submittedAt?: number;
  completedAt?: number;
  approvedAt?: number;
  overdueAt?: number;
  activeRevisionId?: Id<"revisionRequests">;
};

export type TCancellationEligibility = {
  allowed: boolean;
  canRequest: boolean;
  canCancelImmediately: boolean;
  canExecuteOnChain: boolean;
  requiresFreelancerResponse: boolean;
  blocked: boolean;
  reason: string | null;
  warnings: string[];
  suggestedAction:
    | "cancel_escrow"
    | "request_cancellation"
    | "open_dispute"
    | "request_revision"
    | "wait"
    | "none";
  cancellationType: TCancellationType;
  proofSubmitted: boolean;
  revisedProofSubmitted: boolean;
  hasActiveRevision: boolean;
  hasActiveDispute: boolean;
  isOverdueWithoutProof: boolean;
  isPostDisputeClientResolution: boolean;
  escrowStatus?: string;
  workStatus: string;
  deadlineStatus: string;
  latestProof?: {
    id: Id<"workSubmissions">;
    proofHash?: string;
    submittedAt?: number;
    status: string;
  };
  activeDisputeId?: Id<"disputes">;
  activeRevisionId?: Id<"revisionRequests">;
  activeCancellationRequestId?: Id<"cancellationRequests">;
};

export type TCancellationEvaluationContext = {
  parent: TResolvedCancellationParent;
  proofSubmitted: boolean;
  revisedProofSubmitted: boolean;
  latestProof?: Doc<"workSubmissions">;
  hasActiveRevision: boolean;
  activeRevisionId?: Id<"revisionRequests">;
  hasActiveDispute: boolean;
  activeDisputeId?: Id<"disputes">;
  isPostDisputeClientResolution: boolean;
  activeCancellationRequestId?: Id<"cancellationRequests">;
  now: number;
};

export function sanitizeCancellationReasonText(reasonText: string): string {
  return requireNonEmptyString(reasonText, "reasonText")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, MAX_REASON_TEXT_LENGTH);
}

export function sanitizeCancellationResponseMessage(message: string): string {
  return requireNonEmptyString(message, "responseMessage")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, MAX_RESPONSE_TEXT_LENGTH);
}

export function sanitizeCancellationEventMessage(message: string): string {
  return requireNonEmptyString(message, "message")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, MAX_EVENT_MESSAGE_LENGTH);
}

export function getCancellationReasonOptions() {
  return [
    { value: "changed_requirements", label: "Changed requirements" },
    { value: "duplicate_work", label: "Duplicate work" },
    { value: "freelancer_unresponsive", label: "Freelancer unresponsive" },
    { value: "missed_deadline", label: "Missed deadline" },
    { value: "work_not_started", label: "Work not started" },
    { value: "scope_issue", label: "Scope issue" },
    { value: "mutual_agreement", label: "Mutual agreement" },
    { value: "dispute_resolution", label: "Dispute resolution" },
    { value: "other", label: "Other" },
  ] as const;
}

export function getCancellationReasonLabel(reason: TCancellationReasonCategory): string {
  const option = getCancellationReasonOptions().find((item) => item.value === reason);
  return option?.label ?? "Other";
}

function getEscrowForCancellationParent(
  ctx: QueryCtx,
  input: { parentType: TCancellationParentType; parentId: string },
) {
  if (input.parentType === "escrow") {
    return ctx.db.get(input.parentId as Id<"escrows">);
  }
  if (input.parentType === "milestone") {
    return ctx.db
      .query("escrows")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", input.parentId as Id<"milestones">))
      .first();
  }
  return ctx.db
    .query("escrows")
    .withIndex("by_jobId", (q) => q.eq("jobId", input.parentId as Id<"jobs">))
    .first();
}

export async function resolveCancellationParticipants(
  ctx: QueryCtx,
  input: { parentType: TCancellationParentType; parentId: string },
): Promise<TResolvedCancellationParent> {
  const parentId = requireNonEmptyString(input.parentId, "parentId");
  const escrow = await getEscrowForCancellationParent(ctx, {
    parentType: input.parentType,
    parentId,
  });

  if (escrow) {
    const job = await ctx.db.get(escrow.jobId);
    if (!job) {
      throw new NotFoundError("Parent job not found.");
    }
    const milestone = escrow.milestoneId ? await ctx.db.get(escrow.milestoneId) : null;
    const canonicalParentType: TCancellationParentType =
      escrow.milestoneId !== undefined
        ? "milestone"
        : input.parentType === "escrow"
          ? "escrow"
          : "micro_gig";
    const canonicalParentId =
      canonicalParentType === "escrow"
        ? escrow._id
        : escrow.milestoneId !== undefined
          ? escrow.milestoneId
          : escrow.jobId;

    return {
      parentType: canonicalParentType,
      parentId: canonicalParentId,
      jobId: escrow.jobId,
      ...(escrow.milestoneId === undefined ? { microGigId: escrow.jobId } : {}),
      ...(escrow.milestoneId !== undefined ? { milestoneId: escrow.milestoneId } : {}),
      escrowId: escrow._id,
      onChainEscrowId: escrow.escrowId,
      clientWallet: normalizeWalletAddress(escrow.clientWallet),
      ...(escrow.freelancerWallet !== undefined
        ? { freelancerWallet: normalizeWalletAddress(escrow.freelancerWallet) }
        : {}),
      status: milestone?.status ?? job.status,
      escrowStatus: escrow.status,
      ...((milestone?.deadlineAt ?? job.deadlineAt)
        ? { deadlineAt: milestone?.deadlineAt ?? job.deadlineAt }
        : {}),
      ...((milestone?.submittedAt ?? job.submittedAt)
        ? { submittedAt: milestone?.submittedAt ?? job.submittedAt }
        : {}),
      ...((milestone?.completedAt ?? job.completedAt)
        ? { completedAt: milestone?.completedAt ?? job.completedAt }
        : {}),
      ...((milestone?.approvedAt ?? job.approvedAt)
        ? { approvedAt: milestone?.approvedAt ?? job.approvedAt }
        : {}),
      ...((milestone?.overdueAt ?? job.overdueAt)
        ? { overdueAt: milestone?.overdueAt ?? job.overdueAt }
        : {}),
      ...((milestone?.activeRevisionId ?? job.activeRevisionId)
        ? { activeRevisionId: milestone?.activeRevisionId ?? job.activeRevisionId }
        : {}),
    };
  }

  if (input.parentType === "milestone") {
    const milestone = await ctx.db.get(parentId as Id<"milestones">);
    if (!milestone) {
      throw new NotFoundError("Milestone not found.");
    }
    const job = await ctx.db.get(milestone.jobId);
    if (!job) {
      throw new NotFoundError("Parent job not found.");
    }
    return {
      parentType: "milestone",
      parentId: milestone._id,
      jobId: milestone.jobId,
      milestoneId: milestone._id,
      clientWallet: normalizeWalletAddress(job.clientWallet),
      ...(milestone.assignedFreelancerWallet !== undefined
        ? { freelancerWallet: normalizeWalletAddress(milestone.assignedFreelancerWallet) }
        : {}),
      status: milestone.status,
      ...(milestone.deadlineAt !== undefined ? { deadlineAt: milestone.deadlineAt } : {}),
      ...(milestone.submittedAt !== undefined ? { submittedAt: milestone.submittedAt } : {}),
      ...(milestone.completedAt !== undefined ? { completedAt: milestone.completedAt } : {}),
      ...(milestone.approvedAt !== undefined ? { approvedAt: milestone.approvedAt } : {}),
      ...(milestone.overdueAt !== undefined ? { overdueAt: milestone.overdueAt } : {}),
      ...(milestone.activeRevisionId !== undefined
        ? { activeRevisionId: milestone.activeRevisionId }
        : {}),
    };
  }

  const job = await ctx.db.get(parentId as Id<"jobs">);
  if (!job) {
    throw new NotFoundError("Work item not found.");
  }
  return {
    parentType: "micro_gig",
    parentId: job._id,
    jobId: job._id,
    microGigId: job._id,
    clientWallet: normalizeWalletAddress(job.clientWallet),
    ...(job.selectedFreelancerWallet !== undefined
      ? { freelancerWallet: normalizeWalletAddress(job.selectedFreelancerWallet) }
      : {}),
    status: job.status,
    ...(job.deadlineAt !== undefined ? { deadlineAt: job.deadlineAt } : {}),
    ...(job.submittedAt !== undefined ? { submittedAt: job.submittedAt } : {}),
    ...(job.completedAt !== undefined ? { completedAt: job.completedAt } : {}),
    ...(job.approvedAt !== undefined ? { approvedAt: job.approvedAt } : {}),
    ...(job.overdueAt !== undefined ? { overdueAt: job.overdueAt } : {}),
    ...(job.activeRevisionId !== undefined ? { activeRevisionId: job.activeRevisionId } : {}),
  };
}

export function getCancellationRole(
  walletAddress: string,
  request: Pick<Doc<"cancellationRequests">, "clientWallet" | "freelancerWallet">,
): TCancellationParticipantRole {
  const wallet = normalizeWalletAddress(walletAddress);
  if (wallet === request.clientWallet) return "client";
  if (request.freelancerWallet && wallet === request.freelancerWallet) return "freelancer";
  throw new ForbiddenError("Only authorized participants can use this cancellation request.");
}

export function assertCanViewCancellation(
  request: Pick<Doc<"cancellationRequests">, "clientWallet" | "freelancerWallet">,
  viewerWallet?: string,
) {
  if (!viewerWallet) {
    throw new ForbiddenError("You do not have permission to view this cancellation request.");
  }
  return getCancellationRole(viewerWallet, request);
}

export function isCancellationBlockedByProof(eligibility: TCancellationEligibility): boolean {
  return eligibility.proofSubmitted || eligibility.revisedProofSubmitted;
}

export function isCancellationBlockedByDispute(eligibility: TCancellationEligibility): boolean {
  return eligibility.hasActiveDispute;
}

export function isCancellationAllowedByDeadline(eligibility: TCancellationEligibility): boolean {
  return eligibility.isOverdueWithoutProof;
}

export function isActiveCancellationStatus(status: string): boolean {
  return ACTIVE_CANCELLATION_STATUS_SET.has(status);
}

export async function getActiveCancellationRequestForParentInternal(
  ctx: QueryCtx,
  input: { parentType: TCancellationParentType; parentId: string },
) {
  const requests = await ctx.db
    .query("cancellationRequests")
    .withIndex("by_parent_status", (q) =>
      q.eq("parentType", input.parentType).eq("parentId", input.parentId),
    )
    .order("desc")
    .take(50);

  return requests.find((request) => isActiveCancellationStatus(request.status)) ?? null;
}

async function getCancellationContext(
  ctx: QueryCtx,
  input: { parentType: TCancellationParentType; parentId: string; now?: number },
): Promise<TCancellationEvaluationContext> {
  const now = input.now ?? Date.now();
  const parent = await resolveCancellationParticipants(ctx, input);
  const submissions =
    parent.escrowId !== undefined
      ? await ctx.db
          .query("workSubmissions")
          .withIndex("by_convex_escrow", (q) => q.eq("escrowId", parent.escrowId!))
          .take(50)
      : [];
  const meaningfulSubmissions = submissions.filter((submission) =>
    PROOF_SUBMITTED_STATUSES.has(submission.status),
  );
  const latestProof = meaningfulSubmissions.sort(
    (left, right) => right.updatedAt - left.updatedAt,
  )[0];
  const revisedProof = meaningfulSubmissions.find(
    (submission) => submission.proofVersion === "v1_revision",
  );

  const revisions =
    parent.escrowId !== undefined
      ? await ctx.db
          .query("revisionRequests")
          .withIndex("by_escrow", (q) => q.eq("escrowId", parent.escrowId!))
          .take(50)
      : [];
  const activeRevision =
    revisions.find((revision) => ACTIVE_REVISION_STATUSES.has(revision.status)) ??
    (parent.activeRevisionId ? await ctx.db.get(parent.activeRevisionId) : null);

  const activeDispute =
    parent.escrowId !== undefined ? await getActiveDisputeForEscrowId(ctx, parent.escrowId) : null;
  const disputes =
    parent.escrowId !== undefined
      ? await ctx.db
          .query("disputes")
          .withIndex("by_escrow_status", (q) => q.eq("escrowId", parent.escrowId!))
          .take(50)
      : [];
  const isPostDisputeClientResolution = disputes.some((dispute) =>
    CLIENT_RESOLVED_DISPUTE_STATUSES.has(dispute.status),
  );
  const activeCancellation = await getActiveCancellationRequestForParentInternal(ctx, {
    parentType: parent.parentType,
    parentId: parent.parentId,
  });

  return {
    parent,
    proofSubmitted: meaningfulSubmissions.length > 0,
    revisedProofSubmitted: revisedProof !== undefined,
    ...(latestProof !== undefined ? { latestProof } : {}),
    hasActiveRevision: activeRevision !== null,
    ...(activeRevision?._id !== undefined ? { activeRevisionId: activeRevision._id } : {}),
    hasActiveDispute: activeDispute !== null,
    ...(activeDispute?._id !== undefined ? { activeDisputeId: activeDispute._id } : {}),
    isPostDisputeClientResolution,
    ...(activeCancellation?._id !== undefined
      ? { activeCancellationRequestId: activeCancellation._id }
      : {}),
    now,
  };
}

export function isWorkStarted(parent: TResolvedCancellationParent): boolean {
  return (
    parent.escrowStatus === "funded" ||
    parent.escrowStatus === "submitted" ||
    parent.status === "funded" ||
    parent.status === "submitted" ||
    parent.status === "revision_requested" ||
    parent.status === "revision_submitted"
  );
}

export function isOverdueWithoutProof(context: TCancellationEvaluationContext): boolean {
  const deadlineStatus = computeDeadlineStatus({
    deadlineAt: context.parent.deadlineAt,
    submittedAt: context.parent.submittedAt,
    completedAt: context.parent.completedAt,
    approvedAt: context.parent.approvedAt,
    escrowStatus: context.parent.escrowStatus,
    workStatus: context.parent.status,
    now: context.now,
  });
  return (
    !context.proofSubmitted &&
    (deadlineStatus === "overdue" || context.parent.overdueAt !== undefined)
  );
}

export function computeCancellationEligibility(
  context: TCancellationEvaluationContext,
): TCancellationEligibility {
  const deadlineStatus = computeDeadlineStatus({
    deadlineAt: context.parent.deadlineAt,
    submittedAt: context.parent.submittedAt,
    completedAt: context.parent.completedAt,
    approvedAt: context.parent.approvedAt,
    escrowStatus: context.parent.escrowStatus,
    workStatus: context.parent.status,
    now: context.now,
  });
  const warnings: string[] = [];
  const hasEscrow = context.parent.escrowId !== undefined;
  const escrowStatus = context.parent.escrowStatus;
  const funded = escrowStatus === "funded" || escrowStatus === "submitted";
  const workStarted = isWorkStarted(context.parent);
  const overdueWithoutProof = isOverdueWithoutProof(context);

  if (funded) {
    warnings.push(
      "This escrow is already funded. Cancellation may require freelancer agreement or dispute review.",
    );
  }
  if (context.proofSubmitted) {
    warnings.push(
      "Proof has already been submitted. You should approve, request revision, or open a dispute instead of cancelling.",
    );
  }
  if (overdueWithoutProof) {
    warnings.push(
      "This work is overdue and no proof has been submitted. Cancellation may be allowed.",
    );
  }
  if (context.hasActiveDispute) {
    warnings.push(
      "This work is disputed. Cancellation is paused until dispute review is resolved.",
    );
  }
  if (hasEscrow && escrowStatus !== "cancelled") {
    warnings.push("Cancelling escrow is an on-chain action and may require wallet approval.");
  }

  const base = {
    proofSubmitted: context.proofSubmitted,
    revisedProofSubmitted: context.revisedProofSubmitted,
    hasActiveRevision: context.hasActiveRevision,
    hasActiveDispute: context.hasActiveDispute,
    isOverdueWithoutProof: overdueWithoutProof,
    isPostDisputeClientResolution: context.isPostDisputeClientResolution,
    ...(escrowStatus !== undefined ? { escrowStatus } : {}),
    workStatus: context.parent.status,
    deadlineStatus,
    ...(context.latestProof !== undefined
      ? {
          latestProof: {
            id: context.latestProof._id,
            ...(context.latestProof.proofHash !== undefined
              ? { proofHash: context.latestProof.proofHash }
              : {}),
            ...(context.latestProof.submittedAt !== undefined
              ? { submittedAt: context.latestProof.submittedAt }
              : {}),
            status: context.latestProof.status,
          },
        }
      : {}),
    ...(context.activeDisputeId !== undefined ? { activeDisputeId: context.activeDisputeId } : {}),
    ...(context.activeRevisionId !== undefined
      ? { activeRevisionId: context.activeRevisionId }
      : {}),
    ...(context.activeCancellationRequestId !== undefined
      ? { activeCancellationRequestId: context.activeCancellationRequestId }
      : {}),
  };

  if (context.activeCancellationRequestId !== undefined) {
    return {
      ...base,
      allowed: false,
      canRequest: false,
      canCancelImmediately: false,
      canExecuteOnChain: false,
      requiresFreelancerResponse: false,
      blocked: true,
      reason: "This work already has an active cancellation request.",
      warnings,
      suggestedAction: "wait",
      cancellationType: "client_requested",
    };
  }

  if (escrowStatus === "cancelled") {
    return {
      ...base,
      allowed: false,
      canRequest: false,
      canCancelImmediately: false,
      canExecuteOnChain: false,
      requiresFreelancerResponse: false,
      blocked: true,
      reason: "This escrow has already been cancelled.",
      warnings,
      suggestedAction: "none",
      cancellationType: "client_requested",
    };
  }

  if (escrowStatus === "released" || context.parent.status === "completed") {
    return {
      ...base,
      allowed: false,
      canRequest: false,
      canCancelImmediately: false,
      canExecuteOnChain: false,
      requiresFreelancerResponse: false,
      blocked: true,
      reason: "Released or completed work cannot be cancelled.",
      warnings,
      suggestedAction: "none",
      cancellationType: "client_requested",
    };
  }

  if (context.hasActiveDispute) {
    return {
      ...base,
      allowed: false,
      canRequest: false,
      canCancelImmediately: false,
      canExecuteOnChain: false,
      requiresFreelancerResponse: false,
      blocked: true,
      reason: "This escrow is disputed, so cancellation is paused during review.",
      warnings,
      suggestedAction: "wait",
      cancellationType: "client_requested",
    };
  }

  if (context.isPostDisputeClientResolution && escrowStatus === "funded") {
    return {
      ...base,
      allowed: true,
      canRequest: true,
      canCancelImmediately: true,
      canExecuteOnChain: true,
      requiresFreelancerResponse: false,
      blocked: false,
      reason: null,
      warnings,
      suggestedAction: "cancel_escrow",
      cancellationType: "post_dispute",
    };
  }

  if (context.proofSubmitted || context.revisedProofSubmitted) {
    return {
      ...base,
      allowed: false,
      canRequest: false,
      canCancelImmediately: false,
      canExecuteOnChain: false,
      requiresFreelancerResponse: false,
      blocked: true,
      reason: "Proof has already been submitted. Request a revision or open a dispute instead.",
      warnings,
      suggestedAction: context.hasActiveRevision ? "open_dispute" : "request_revision",
      cancellationType: "client_requested",
    };
  }

  if (context.hasActiveRevision) {
    return {
      ...base,
      allowed: false,
      canRequest: false,
      canCancelImmediately: false,
      canExecuteOnChain: false,
      requiresFreelancerResponse: false,
      blocked: true,
      reason: "An active revision request exists. Resolve the revision or open a dispute.",
      warnings,
      suggestedAction: "open_dispute",
      cancellationType: "client_requested",
    };
  }

  if (
    !context.parent.freelancerWallet ||
    !workStarted ||
    !hasEscrow ||
    escrowStatus === "created"
  ) {
    return {
      ...base,
      allowed: true,
      canRequest: true,
      canCancelImmediately: true,
      canExecuteOnChain: escrowStatus === "created" || escrowStatus === "funded",
      requiresFreelancerResponse: false,
      blocked: false,
      reason: null,
      warnings,
      suggestedAction: hasEscrow ? "cancel_escrow" : "none",
      cancellationType: !context.parent.freelancerWallet ? "pre_acceptance" : "pre_funding",
    };
  }

  if (overdueWithoutProof && escrowStatus === "funded") {
    return {
      ...base,
      allowed: true,
      canRequest: true,
      canCancelImmediately: true,
      canExecuteOnChain: true,
      requiresFreelancerResponse: false,
      blocked: false,
      reason: null,
      warnings,
      suggestedAction: "cancel_escrow",
      cancellationType: "overdue",
    };
  }

  if (funded && !context.proofSubmitted) {
    return {
      ...base,
      allowed: true,
      canRequest: true,
      canCancelImmediately: false,
      canExecuteOnChain: false,
      requiresFreelancerResponse: true,
      blocked: false,
      reason: "Freelancer agreement is required before this work can be cancelled.",
      warnings,
      suggestedAction: "request_cancellation",
      cancellationType: "client_requested",
    };
  }

  return {
    ...base,
    allowed: false,
    canRequest: false,
    canCancelImmediately: false,
    canExecuteOnChain: false,
    requiresFreelancerResponse: false,
    blocked: true,
    reason: "This escrow cannot be cancelled in its current state.",
    warnings,
    suggestedAction: "none",
    cancellationType: "client_requested",
  };
}

export async function getCancellationEligibilityForParent(
  ctx: QueryCtx,
  input: { parentType: TCancellationParentType; parentId: string; now?: number },
) {
  return computeCancellationEligibility(await getCancellationContext(ctx, input));
}

export function buildCancellationEligibilitySnapshot(
  eligibility: TCancellationEligibility,
): TCancellationEligibility {
  return eligibility;
}

export async function assertCanCreateCancellationRequest(
  ctx: QueryCtx,
  input: { parentType: TCancellationParentType; parentId: string; requestedByWallet: string },
) {
  const requestedByWallet = normalizeWalletAddress(input.requestedByWallet);
  const context = await getCancellationContext(ctx, input);
  if (requestedByWallet !== context.parent.clientWallet) {
    throw new ForbiddenError("Only the client can request cancellation.");
  }
  const eligibility = computeCancellationEligibility(context);
  if (!eligibility.canRequest) {
    throw new BadRequestError(eligibility.reason ?? "This work cannot be cancelled right now.");
  }
  return { parent: context.parent, requestedByWallet, eligibility };
}

export function assertCanCancelImmediately(eligibility: TCancellationEligibility) {
  if (!eligibility.canCancelImmediately) {
    throw new ForbiddenError(
      eligibility.reason ?? "Freelancer agreement is required before this work can be cancelled.",
    );
  }
}

export function assertCanRequestCancellation(eligibility: TCancellationEligibility) {
  if (!eligibility.canRequest) {
    throw new BadRequestError(eligibility.reason ?? "Cancellation cannot be requested.");
  }
}

export function assertCanExecuteCancellation(request: Doc<"cancellationRequests">) {
  if (request.status !== "approved_for_cancel" && request.status !== "cancel_failed") {
    throw new ForbiddenError(
      request.freelancerResponseRequired
        ? "Freelancer agreement is required before this work can be cancelled."
        : "This cancellation request is not approved for on-chain execution.",
    );
  }
  if (request.onChainStatus === "confirmed") {
    throw new BadRequestError("This escrow has already been cancelled.");
  }
}

export function assertCanRespondToCancellation(
  request: Doc<"cancellationRequests">,
  walletAddress: string,
) {
  const wallet = normalizeWalletAddress(walletAddress);
  if (!request.freelancerWallet || wallet !== request.freelancerWallet) {
    throw new ForbiddenError("Only the assigned freelancer can respond to cancellation.");
  }
  if (!request.freelancerResponseRequired || request.freelancerResponseStatus !== "pending") {
    throw new BadRequestError("This cancellation request is not waiting for freelancer response.");
  }
  if (request.status !== "pending_freelancer_response") {
    throw new BadRequestError("This cancellation request is no longer accepting responses.");
  }
  if (request.expiresAt !== undefined && request.expiresAt <= Date.now()) {
    throw new BadRequestError("This cancellation request has expired.");
  }
}

export async function assertNoActiveCancellationRequest(
  ctx: QueryCtx,
  input: { parentType: TCancellationParentType; parentId: string },
) {
  const active = await getActiveCancellationRequestForParentInternal(ctx, input);
  if (active) {
    throw new ConflictError("This work already has an active cancellation request.");
  }
}

export async function validateCancellationAttachmentIds(
  ctx: QueryCtx,
  input: {
    attachmentIds: Id<"attachments">[];
    walletAddress: string;
    parentId?: string;
  },
) {
  if (input.attachmentIds.length > MAX_ATTACHMENTS) {
    throw new BadRequestError("Attach 10 files or fewer.");
  }
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  for (const attachmentId of input.attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.status !== "active") {
      throw new NotFoundError("Attachment not found.");
    }
    if (attachment.uploadedByWallet !== walletAddress) {
      throw new ForbiddenError("You cannot use evidence files owned by another wallet.");
    }
    if (
      attachment.parentType !== "unknown" &&
      (attachment.parentType !== "cancellation" || attachment.parentId !== input.parentId)
    ) {
      throw new BadRequestError("Attachment is already linked to another record.");
    }
  }
}

export async function attachEvidenceToCancellation(
  ctx: MutationCtx,
  input: {
    attachmentIds: Id<"attachments">[];
    cancellationRequestId: Id<"cancellationRequests">;
  },
) {
  const now = Date.now();
  for (const attachmentId of input.attachmentIds) {
    await ctx.db.patch(attachmentId, {
      parentType: "cancellation",
      parentId: input.cancellationRequestId,
      visibility: "participants",
      updatedAt: now,
    });
  }
}

export async function createCancellationEvent(
  ctx: MutationCtx,
  input: {
    cancellationRequestId: Id<"cancellationRequests">;
    parentType: TCancellationParentType;
    parentId: string;
    escrowId?: Id<"escrows">;
    type: TCancellationEventType;
    actorWallet: string;
    actorWalletType: TWalletType | "system";
    actorRole: TCancellationActorRole;
    message: string;
    oldStatus?: TCancellationStatus;
    newStatus?: TCancellationStatus;
    transactionHash?: string;
    metadata?: unknown;
    createdAt?: number;
  },
) {
  return await ctx.db.insert("cancellationEvents", {
    cancellationRequestId: input.cancellationRequestId,
    parentType: input.parentType,
    parentId: input.parentId,
    ...(input.escrowId !== undefined ? { escrowId: input.escrowId } : {}),
    type: input.type,
    actorWallet:
      input.actorWallet === "system" ? "system" : normalizeWalletAddress(input.actorWallet),
    actorWalletType: input.actorWalletType,
    actorRole: input.actorRole,
    message: sanitizeCancellationEventMessage(input.message),
    ...(input.oldStatus !== undefined ? { oldStatus: input.oldStatus } : {}),
    ...(input.newStatus !== undefined ? { newStatus: input.newStatus } : {}),
    ...(input.transactionHash !== undefined ? { transactionHash: input.transactionHash } : {}),
    createdAt: input.createdAt ?? Date.now(),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });
}

export async function createCancellationNotification(
  ctx: MutationCtx,
  input: {
    request: Doc<"cancellationRequests">;
    recipientWallet: string;
    recipientWalletType?: TWalletType;
    type:
      | "cancellation_requested"
      | "cancellation_freelancer_responded"
      | "cancellation_approved"
      | "cancellation_on_chain_started"
      | "cancellation_on_chain_succeeded"
      | "cancellation_on_chain_failed"
      | "cancellation_blocked"
      | "cancellation_withdrawn"
      | "cancellation_expired";
    title: string;
    body: string;
    metadata?: unknown;
  },
) {
  await ctx.db.insert("notifications", {
    recipientWallet: normalizeWalletAddress(input.recipientWallet),
    ...(input.recipientWalletType !== undefined
      ? { recipientWalletType: input.recipientWalletType }
      : {}),
    type: input.type,
    title: input.title.slice(0, 160),
    body: input.body.slice(0, 500),
    parentType: input.request.milestoneId !== undefined ? "milestone" : "micro_gig",
    parentId: input.request.milestoneId ?? input.request.jobId ?? input.request.parentId,
    ...(input.request.jobId !== undefined ? { jobId: input.request.jobId } : {}),
    ...(input.request.milestoneId !== undefined ? { milestoneId: input.request.milestoneId } : {}),
    ...(input.request.escrowId !== undefined ? { escrowId: input.request.escrowId } : {}),
    createdAt: Date.now(),
    metadata: {
      cancellationRequestId: input.request._id,
      requestNumber: input.request.requestNumber,
      ...(input.metadata !== undefined ? { detail: input.metadata } : {}),
    },
  });
}

export async function createCancellationSystemMessage(
  ctx: MutationCtx,
  input: {
    request: Doc<"cancellationRequests">;
    eventType:
      | "cancellation_requested"
      | "cancellation_accepted"
      | "cancellation_rejected"
      | "cancellation_approved"
      | "cancellation_on_chain_started"
      | "cancellation_on_chain_succeeded"
      | "cancellation_on_chain_failed"
      | "cancellation_withdrawn"
      | "cancellation_expired";
    body: string;
    transactionHash?: string;
  },
) {
  if (input.request.escrowId === undefined) {
    return null;
  }
  try {
    return await createSystemMessageForEvent(ctx, {
      parentType: "escrow",
      parentId: input.request.escrowId,
      eventType: input.eventType,
      body: input.body,
      eventPayload: {
        cancellationRequestId: input.request._id,
        requestNumber: input.request.requestNumber,
        ...(input.transactionHash !== undefined ? { transactionHash: input.transactionHash } : {}),
      },
    });
  } catch {
    return null;
  }
}

export async function withCancellationAttachments(
  ctx: QueryCtx,
  request: Doc<"cancellationRequests">,
  viewerWallet?: string,
) {
  assertCanViewCancellation(request, viewerWallet);
  const attachments = [];
  for (const attachmentId of request.freelancerResponseAttachmentIds ?? []) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) continue;
    try {
      await assertCanViewAttachment(ctx, attachment, viewerWallet);
      attachments.push({
        ...attachment,
        url: attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null,
      });
    } catch {
      // Hide inaccessible evidence.
    }
  }
  return { ...request, freelancerResponseAttachments: attachments };
}

export function buildCancellationNumber(now = Date.now()): string {
  return `CAN-${new Date(now).toISOString().slice(0, 10).replace(/-/g, "")}-${now.toString(36).toUpperCase()}`;
}

function getStellarExpertNetworkPath(): "public" | "testnet" {
  const network = (
    process.env.STELLAR_NETWORK ??
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
    "testnet"
  )
    .trim()
    .toLowerCase();

  return network === "mainnet" || network === "public" || network === "pubnet"
    ? "public"
    : "testnet";
}

export function getStellarExpertUrl(txHash: string): string {
  return `https://stellar.expert/explorer/${getStellarExpertNetworkPath()}/tx/${encodeURIComponent(txHash)}`;
}

export function getCancellationExpiresAt(now = Date.now()): number {
  return now + REQUEST_TTL_MS;
}

export function sanitizeOptionalEscrowContractId(value?: string): string | undefined {
  return optionalNonEmptyString(value, "escrowContractId");
}

export async function refreshCancellationEligibilityForRequest(
  ctx: QueryCtx,
  request: Doc<"cancellationRequests">,
) {
  const eligibility = await getCancellationEligibilityForParent(ctx, {
    parentType: request.parentType,
    parentId: request.parentId,
  });
  const isSelfActiveRequest = eligibility.activeCancellationRequestId === request._id;
  const canUseApprovedRequest =
    isSelfActiveRequest &&
    (request.status === "approved_for_cancel" || request.status === "cancel_failed") &&
    (request.freelancerResponseStatus === "accepted" ||
      request.freelancerResponseStatus === "not_required");

  if (canUseApprovedRequest) {
    if (eligibility.hasActiveDispute) {
      return {
        ...eligibility,
        reason: "This escrow is disputed, so cancellation is paused during review.",
        suggestedAction: "wait" as const,
      };
    }
    if (
      (eligibility.proofSubmitted || eligibility.revisedProofSubmitted) &&
      request.cancellationType !== "post_dispute"
    ) {
      return {
        ...eligibility,
        reason: "Proof has already been submitted. Request a revision or open a dispute instead.",
        suggestedAction: "request_revision" as const,
      };
    }
    if (eligibility.escrowStatus !== "created" && eligibility.escrowStatus !== "funded") {
      return {
        ...eligibility,
        reason: "This escrow cannot be cancelled in its current state.",
        suggestedAction: "none" as const,
      };
    }

    return {
      ...eligibility,
      allowed: true,
      canRequest: true,
      canCancelImmediately: true,
      canExecuteOnChain: request.onChainStatus !== "confirmed",
      requiresFreelancerResponse: false,
      blocked: false,
      reason: null,
      suggestedAction: "cancel_escrow" as const,
      cancellationType: "mutual_agreement" as const,
    };
  }
  return eligibility;
}

export async function getActiveDisputeStatusForRequest(
  ctx: QueryCtx,
  request: Doc<"cancellationRequests">,
) {
  if (request.escrowId === undefined) return null;
  const active = await getActiveDisputeForEscrowId(ctx, request.escrowId);
  return active && isActiveDisputeStatus(active.status) ? active.status : null;
}
