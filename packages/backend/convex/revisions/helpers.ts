import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TRevisionPolicy } from "../jobs/schema";
import type { TWorkSubmissionParentType } from "../work_submissions/schema";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";
import { createSystemMessageForEvent } from "../conversations/helpers";
import { validateDeadlineAt } from "../deadlines/helpers";

const DEFAULT_REVISION_POLICY: TRevisionPolicy = "fixed";
const DEFAULT_REVISION_LIMIT = 2;
const MAX_REVISION_LIMIT = 25;
const ACTIVE_REVISION_STATUSES = new Set(["requested", "acknowledged"]);
const TERMINAL_WORK_STATUSES = new Set(["completed", "released", "cancelled", "disputed"]);
const REQUESTABLE_SUBMISSION_STATUSES = new Set([
  "submitted_for_review",
  "revision_submitted",
  "submitted",
  "anchoring",
  "anchored",
  "anchor_failed",
]);

export type TRevisionPolicyConfig = {
  revisionPolicy: TRevisionPolicy;
  revisionLimit: number | null;
  revisionCount: number;
};

export function isRevisionEnabledPolicy(policy: TRevisionPolicy): boolean {
  return policy === "fixed" || policy === "unlimited";
}

export type TRevisionParentContext = {
  parentType: TWorkSubmissionParentType;
  parentId: string;
  jobId?: Id<"jobs">;
  milestoneId?: Id<"milestones">;
  escrowId?: Id<"escrows">;
  clientWallet: string;
  freelancerWallet?: string;
  status: string;
  escrowStatus?: string;
  activeRevisionId?: Id<"revisionRequests">;
  revisionPolicy?: TRevisionPolicy;
  revisionLimit?: number | null;
  revisionCount?: number;
};

export function sanitizeRevisionText(value: string, fieldName: string): string {
  return requireNonEmptyString(value, fieldName).replace(/\r\n?/g, "\n").trim().slice(0, 4000);
}

export function validateRevisionPolicy(input: {
  revisionPolicy?: TRevisionPolicy;
  revisionLimit?: number | null;
}): TRevisionPolicyConfig {
  const revisionPolicy = input.revisionPolicy ?? DEFAULT_REVISION_POLICY;
  const rawLimit = input.revisionLimit;

  if (revisionPolicy === "none") {
    return { revisionPolicy, revisionLimit: null, revisionCount: 0 };
  }

  if (revisionPolicy === "unlimited") {
    return { revisionPolicy, revisionLimit: null, revisionCount: 0 };
  }

  if (rawLimit === null || rawLimit === undefined) {
    return {
      revisionPolicy,
      revisionLimit: DEFAULT_REVISION_LIMIT,
      revisionCount: 0,
    };
  }

  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_REVISION_LIMIT) {
    throw new BadRequestError("Fixed revisions require a limit between 1 and 25.");
  }

  return { revisionPolicy, revisionLimit: rawLimit, revisionCount: 0 };
}

export function getRevisionPolicyConfig(
  parent: Pick<TRevisionParentContext, "revisionPolicy" | "revisionLimit" | "revisionCount">,
): TRevisionPolicyConfig {
  const config = validateRevisionPolicy({
    revisionPolicy: parent.revisionPolicy,
    revisionLimit: parent.revisionLimit,
  });

  return {
    ...config,
    revisionCount:
      Number.isInteger(parent.revisionCount) && (parent.revisionCount ?? 0) > 0
        ? parent.revisionCount!
        : 0,
  };
}

export function computeRemainingRevisions(config: TRevisionPolicyConfig): number | null {
  if (config.revisionPolicy === "unlimited") {
    return null;
  }
  if (config.revisionPolicy === "none") {
    return 0;
  }

  return Math.max(0, (config.revisionLimit ?? DEFAULT_REVISION_LIMIT) - config.revisionCount);
}

async function getEscrowForParent(
  ctx: QueryCtx,
  input: { jobId?: Id<"jobs">; milestoneId?: Id<"milestones">; escrowId?: Id<"escrows"> },
) {
  if (input.escrowId !== undefined) {
    return await ctx.db.get(input.escrowId);
  }
  if (input.milestoneId !== undefined) {
    return await ctx.db
      .query("escrows")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", input.milestoneId))
      .first();
  }
  if (input.jobId !== undefined) {
    return await ctx.db
      .query("escrows")
      .withIndex("by_jobId", (q) => q.eq("jobId", input.jobId!))
      .first();
  }

  return null;
}

export async function resolveRevisionParent(
  ctx: QueryCtx,
  input: { parentType: TWorkSubmissionParentType; parentId: string },
): Promise<TRevisionParentContext> {
  const parentId = requireNonEmptyString(input.parentId, "parentId");

  if (input.parentType === "micro_gig" || input.parentType === "job") {
    const job = await ctx.db.get(parentId as Id<"jobs">);
    if (!job) {
      throw new NotFoundError("Work item not found.");
    }
    const escrow = await getEscrowForParent(ctx, { jobId: job._id });
    return {
      parentType: "micro_gig",
      parentId: job._id,
      jobId: job._id,
      ...(escrow?._id !== undefined ? { escrowId: escrow._id } : {}),
      clientWallet: job.clientWallet,
      freelancerWallet: job.selectedFreelancerWallet ?? escrow?.freelancerWallet,
      status: job.status,
      ...(escrow?.status !== undefined ? { escrowStatus: escrow.status } : {}),
      ...(job.activeRevisionId !== undefined ? { activeRevisionId: job.activeRevisionId } : {}),
      revisionPolicy: job.revisionPolicy,
      revisionLimit: job.revisionLimit,
      revisionCount: job.revisionCount,
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
    const escrow = await getEscrowForParent(ctx, { milestoneId: milestone._id });
    return {
      parentType: "milestone",
      parentId: milestone._id,
      jobId: milestone.jobId,
      milestoneId: milestone._id,
      ...(escrow?._id !== undefined ? { escrowId: escrow._id } : {}),
      clientWallet: job.clientWallet,
      freelancerWallet: milestone.assignedFreelancerWallet ?? escrow?.freelancerWallet,
      status: milestone.status,
      ...(escrow?.status !== undefined ? { escrowStatus: escrow.status } : {}),
      ...(milestone.activeRevisionId !== undefined
        ? { activeRevisionId: milestone.activeRevisionId }
        : {}),
      revisionPolicy: milestone.revisionPolicy,
      revisionLimit: milestone.revisionLimit,
      revisionCount: milestone.revisionCount,
    };
  }

  if (input.parentType === "escrow") {
    const escrow = await ctx.db.get(parentId as Id<"escrows">);
    if (!escrow) {
      throw new NotFoundError("Escrow not found.");
    }
    const parentType: TWorkSubmissionParentType =
      escrow.milestoneId !== undefined ? "milestone" : "micro_gig";
    const parentIdForEscrow = escrow.milestoneId ?? escrow.jobId;
    return await resolveRevisionParent(ctx, { parentType, parentId: parentIdForEscrow });
  }

  throw new BadRequestError("This work item does not support revisions.");
}

export function assertParticipantCanViewRevision(
  revision: Pick<Doc<"revisionRequests">, "clientWallet" | "freelancerWallet">,
  viewerWallet?: string,
) {
  if (!viewerWallet) {
    throw new ForbiddenError("You do not have permission to view this revision.");
  }

  const wallet = normalizeWalletAddress(viewerWallet);
  if (wallet === revision.clientWallet || wallet === revision.freelancerWallet) {
    return wallet;
  }

  throw new ForbiddenError("You do not have permission to view this revision.");
}

export async function getActiveRevisionRequestForParent(
  ctx: QueryCtx,
  input: { parentType: TWorkSubmissionParentType; parentId: string },
) {
  const requests = await ctx.db
    .query("revisionRequests")
    .withIndex("by_parent", (q) =>
      q.eq("parentType", input.parentType).eq("parentId", input.parentId),
    )
    .take(20);

  return requests.find((request) => ACTIVE_REVISION_STATUSES.has(request.status)) ?? null;
}

export async function assertCanRequestRevision(
  ctx: QueryCtx,
  input: {
    parentType: TWorkSubmissionParentType;
    parentId: string;
    clientWallet: string;
    workSubmissionId: Id<"workSubmissions">;
  },
) {
  const clientWallet = normalizeWalletAddress(input.clientWallet);
  const parent = await resolveRevisionParent(ctx, input);
  const submission = await ctx.db.get(input.workSubmissionId);

  if (!submission || submission.status === "cancelled") {
    throw new NotFoundError("Proof submission not found.");
  }
  if (submission.parentType !== parent.parentType || submission.parentId !== parent.parentId) {
    throw new BadRequestError("Revision must target a proof submission for this work item.");
  }
  if (!REQUESTABLE_SUBMISSION_STATUSES.has(submission.status)) {
    throw new BadRequestError("Client cannot request revision before proof is submitted.");
  }
  if (parent.clientWallet !== clientWallet || submission.clientWallet !== clientWallet) {
    throw new ForbiddenError("Only the client can request a revision.");
  }
  if (!parent.freelancerWallet || submission.freelancerWallet !== parent.freelancerWallet) {
    throw new ForbiddenError("This work item does not have an assigned freelancer.");
  }
  if (
    TERMINAL_WORK_STATUSES.has(parent.status) ||
    TERMINAL_WORK_STATUSES.has(parent.escrowStatus ?? "")
  ) {
    throw new BadRequestError(
      "Revision cannot be requested after release, cancellation, or dispute.",
    );
  }

  const config = getRevisionPolicyConfig(parent);
  if (config.revisionPolicy === "none") {
    throw new BadRequestError("This work does not allow revisions.");
  }
  if (config.revisionPolicy === "fixed" && computeRemainingRevisions(config) === 0) {
    throw new BadRequestError("The revision limit has already been reached.");
  }

  const active = parent.activeRevisionId
    ? await ctx.db.get(parent.activeRevisionId)
    : await getActiveRevisionRequestForParent(ctx, parent);
  if (active && ACTIVE_REVISION_STATUSES.has(active.status)) {
    throw new BadRequestError("There is already an active revision request.");
  }

  return { parent, submission, config, clientWallet };
}

export async function assertCanSubmitRevision(
  ctx: QueryCtx,
  input: { revisionRequestId: Id<"revisionRequests">; freelancerWallet: string },
) {
  const freelancerWallet = normalizeWalletAddress(input.freelancerWallet);
  const revision = await ctx.db.get(input.revisionRequestId);
  if (!revision) {
    throw new NotFoundError("Revision request not found.");
  }
  if (!ACTIVE_REVISION_STATUSES.has(revision.status)) {
    throw new BadRequestError("Revision cannot be submitted because it is not active.");
  }
  if (revision.freelancerWallet !== freelancerWallet) {
    throw new ForbiddenError("Only the assigned freelancer can submit a revision.");
  }

  const parent = await resolveRevisionParent(ctx, {
    parentType: revision.parentType,
    parentId: revision.parentId,
  });
  if (
    TERMINAL_WORK_STATUSES.has(parent.status) ||
    TERMINAL_WORK_STATUSES.has(parent.escrowStatus ?? "")
  ) {
    throw new BadRequestError(
      "Revision cannot be submitted after release, cancellation, or dispute.",
    );
  }

  return { revision, parent, freelancerWallet };
}

export async function assertCanAcceptPreviewSubmission(
  ctx: QueryCtx,
  input: { submissionId: Id<"workSubmissions">; clientWallet: string },
) {
  const clientWallet = normalizeWalletAddress(input.clientWallet);
  const submission = await ctx.db.get(input.submissionId);
  if (!submission || submission.status === "cancelled") {
    throw new NotFoundError("Proof submission not found.");
  }
  const parent = await resolveRevisionParent(ctx, {
    parentType: submission.parentType,
    parentId: submission.parentId,
  });
  if (submission.clientWallet !== clientWallet || parent.clientWallet !== clientWallet) {
    throw new ForbiddenError("Only the client can accept a work preview.");
  }
  if (submission.status !== "submitted_for_review") {
    throw new BadRequestError("Only a submitted preview can be accepted for final submission.");
  }
  if (parent.activeRevisionId !== undefined) {
    const active = await ctx.db.get(parent.activeRevisionId);
    if (active && ACTIVE_REVISION_STATUSES.has(active.status)) {
      throw new BadRequestError("Resolve the active revision request before accepting a preview.");
    }
  }
  if (
    TERMINAL_WORK_STATUSES.has(parent.status) ||
    TERMINAL_WORK_STATUSES.has(parent.escrowStatus ?? "")
  ) {
    throw new BadRequestError("Preview cannot be accepted after release, cancellation, or dispute.");
  }
  const config = getRevisionPolicyConfig(parent);
  if (!isRevisionEnabledPolicy(config.revisionPolicy)) {
    throw new BadRequestError("This work does not use preview approval.");
  }

  return { submission, parent, clientWallet };
}

export async function assertRevisionAttachmentsOwnedByClient(
  ctx: MutationCtx,
  input: {
    attachmentIds: Id<"attachments">[];
    clientWallet: string;
    revisionRequestId: Id<"revisionRequests">;
  },
) {
  const clientWallet = normalizeWalletAddress(input.clientWallet);
  const now = Date.now();

  for (const attachmentId of input.attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.status !== "active") {
      throw new NotFoundError("Attachment not found.");
    }
    if (attachment.uploadedByWallet !== clientWallet) {
      throw new ForbiddenError("Attachment does not belong to requester.");
    }
    if (
      attachment.parentType !== "unknown" &&
      (attachment.parentType !== "revision_request" ||
        attachment.parentId !== input.revisionRequestId)
    ) {
      throw new BadRequestError("Attachment is already linked to another parent.");
    }

    await ctx.db.patch(attachmentId, {
      parentType: "revision_request",
      parentId: input.revisionRequestId,
      ownerRole: "client",
      visibility: "participants",
      updatedAt: now,
    });
  }
}

export async function patchRevisionParent(
  ctx: MutationCtx,
  parent: TRevisionParentContext,
  patch: {
    status?: "revision_requested" | "revision_submitted" | "submitted";
    activeRevisionId?: Id<"revisionRequests">;
    lastRevisionRequestedAt?: number;
    revisionStatus?: "none" | "revision_requested" | "revision_submitted" | "revision_resolved";
    revisionCount?: number;
  },
) {
  const now = Date.now();
  if (parent.parentType === "milestone" && parent.milestoneId !== undefined) {
    await ctx.db.patch(parent.milestoneId, { ...patch, updatedAt: now });
    return;
  }

  if (parent.jobId !== undefined) {
    await ctx.db.patch(parent.jobId, patch);
  }
}

export async function createRevisionNotification(
  ctx: MutationCtx,
  input: {
    recipientWallet: string;
    type:
      | "revision_requested"
      | "revision_submitted"
      | "revision_limit_reached"
      | "preview_submitted"
      | "preview_accepted";
    title: string;
    body: string;
    parentType: "micro_gig" | "milestone";
    parentId: string;
    jobId?: Id<"jobs">;
    milestoneId?: Id<"milestones">;
    escrowId?: Id<"escrows">;
    metadata?: unknown;
  },
) {
  return await ctx.db.insert("notifications", {
    recipientWallet: normalizeWalletAddress(input.recipientWallet),
    type: input.type,
    title: input.title,
    body: input.body,
    parentType: input.parentType,
    parentId: input.parentId,
    ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
    ...(input.milestoneId !== undefined ? { milestoneId: input.milestoneId } : {}),
    ...(input.escrowId !== undefined ? { escrowId: input.escrowId } : {}),
    createdAt: Date.now(),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });
}

export async function createRevisionEventMessage(
  ctx: MutationCtx,
  input: {
    parent: TRevisionParentContext;
    eventType: "revision_requested" | "revision_submitted" | "preview_submitted" | "preview_accepted";
    body: string;
    revisionRequestId?: Id<"revisionRequests">;
    workSubmissionId: Id<"workSubmissions">;
    proofHash?: string;
    transactionHash?: string;
  },
) {
  return await createSystemMessageForEvent(ctx, {
    parentType: input.parent.escrowId !== undefined ? "escrow" : input.parent.parentType,
    parentId: input.parent.escrowId ?? input.parent.parentId,
    eventType: input.eventType,
    body: input.body,
    eventPayload: {
      workSubmissionId: input.workSubmissionId,
      ...(input.revisionRequestId !== undefined
        ? { revisionRequestId: input.revisionRequestId }
        : {}),
      parentType: input.parent.parentType,
      parentId: input.parent.parentId,
      jobId: input.parent.jobId,
      milestoneId: input.parent.milestoneId,
      escrowId: input.parent.escrowId,
      ...(input.proofHash !== undefined ? { proofHash: input.proofHash } : {}),
      ...(input.transactionHash !== undefined ? { transactionHash: input.transactionHash } : {}),
    },
  });
}

export function sanitizeRevisionDeadline(deadlineAt?: number): number | undefined {
  if (deadlineAt === undefined) {
    return undefined;
  }

  return validateDeadlineAt(deadlineAt);
}

export function sanitizeOptionalRevisionReason(reason?: string): string | undefined {
  return optionalNonEmptyString(reason, "reason")?.slice(0, 500);
}
