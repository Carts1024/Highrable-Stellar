import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TWalletType } from "../users/schema";
import type {
  TDisputeActorRole,
  TDisputeEventType,
  TDisputeParentType,
  TDisputeReasonCategory,
  TDisputeStatus,
} from "./schema";

import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";
import { assertCanViewAttachment, serializeAttachmentForViewer } from "../attachments/helpers";
import { createSystemMessageForEvent } from "../conversations/helpers";
import { getJobType } from "../jobs/helpers";
import { ACTIVE_DISPUTE_STATUSES } from "./schema";

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 10_000;
const MAX_EVENT_MESSAGE_LENGTH = 4_000;
const MAX_ATTACHMENTS = 25;
const MAX_RELATED_RECORDS = 20;
const ACTIVE_DISPUTE_STATUS_SET = new Set<string>(ACTIVE_DISPUTE_STATUSES);

export type TDisputeParticipantRole = "client" | "freelancer";

export type TResolvedDisputeParent = {
  parentType: TDisputeParentType;
  parentId: string;
  jobId?: Id<"jobs">;
  microGigId?: Id<"jobs">;
  milestoneId?: Id<"milestones">;
  escrowId: Id<"escrows">;
  onChainEscrowId: string;
  clientWallet: string;
  freelancerWallet: string;
  status: string;
  escrowStatus: string;
};

export function sanitizeDisputeTitle(title: string): string {
  return requireNonEmptyString(title, "title").replace(/\s+/g, " ").slice(0, MAX_TITLE_LENGTH);
}

export function sanitizeDisputeDescription(description: string): string {
  return requireNonEmptyString(description, "description")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
}

export function sanitizeDisputeMessage(message: string): string {
  return requireNonEmptyString(message, "message")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, MAX_EVENT_MESSAGE_LENGTH);
}

export function sanitizeOptionalProofHash(proofHash?: string): string | undefined {
  return optionalNonEmptyString(proofHash, "proofHash")?.toLowerCase();
}

export function getDisputeReasonLabel(reason: TDisputeReasonCategory): string {
  const labels: Record<TDisputeReasonCategory, string> = {
    work_not_delivered: "Work not delivered",
    work_quality_issue: "Work quality issue",
    client_unresponsive: "Client unresponsive",
    freelancer_unresponsive: "Freelancer unresponsive",
    missed_deadline: "Missed deadline",
    revision_disagreement: "Revision disagreement",
    payment_release_disagreement: "Payment release disagreement",
    scope_disagreement: "Scope disagreement",
    other: "Other",
  };

  return labels[reason];
}

export function isActiveDisputeStatus(status: string): boolean {
  return ACTIVE_DISPUTE_STATUS_SET.has(status);
}

type TDisputeParentRecords = {
  escrow: Doc<"escrows"> | null;
  job: Doc<"jobs">;
  milestone: Doc<"milestones"> | null;
};

function normalizeParentId<TableName extends "escrows" | "jobs" | "milestones">(
  ctx: QueryCtx,
  tableName: TableName,
  parentId: string,
): Id<TableName> {
  const normalizedId = ctx.db.normalizeId(tableName, parentId);
  if (!normalizedId) {
    throw new BadRequestError(`parentId must be a valid ${tableName.slice(0, -1)} ID.`);
  }

  return normalizedId;
}

async function getUniqueEscrowByJobId(ctx: QueryCtx, jobId: Id<"jobs">) {
  const escrows = await ctx.db
    .query("escrows")
    .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
    .take(2);

  if (escrows.length > 1) {
    throw new ConflictError("Multiple escrows match this job; select a specific escrow.");
  }

  return escrows[0] ?? null;
}

async function getUniqueEscrowByMilestoneId(ctx: QueryCtx, milestoneId: Id<"milestones">) {
  const escrows = await ctx.db
    .query("escrows")
    .withIndex("by_milestoneId", (q) => q.eq("milestoneId", milestoneId))
    .take(2);

  if (escrows.length > 1) {
    throw new ConflictError("Multiple escrows match this milestone; select a specific escrow.");
  }

  return escrows[0] ?? null;
}

async function getJobById(ctx: QueryCtx, jobId: Id<"jobs">) {
  const job = await ctx.db.get(jobId);
  if (!job) {
    throw new NotFoundError("Parent job not found.");
  }

  return job;
}

async function getMilestoneById(ctx: QueryCtx, milestoneId: Id<"milestones">) {
  const milestone = await ctx.db.get(milestoneId);
  if (!milestone) {
    throw new NotFoundError("Milestone not found.");
  }

  return milestone;
}

async function getDisputeParentRecords(
  ctx: QueryCtx,
  input: { parentType: TDisputeParentType; parentId: string },
): Promise<TDisputeParentRecords> {
  const parentId = requireNonEmptyString(input.parentId, "parentId");

  if (input.parentType === "escrow") {
    const escrowId = normalizeParentId(ctx, "escrows", parentId);
    const escrow = await ctx.db.get(escrowId);
    if (!escrow) {
      throw new NotFoundError("Escrow not found.");
    }

    const storedJobId = ctx.db.normalizeId("jobs", escrow.jobId);
    if (!storedJobId) {
      throw new BadRequestError("This escrow has an invalid parent job ID.");
    }
    const job = await getJobById(ctx, storedJobId);
    let milestone: Doc<"milestones"> | null = null;
    if (escrow.milestoneId !== undefined) {
      const storedMilestoneId = ctx.db.normalizeId("milestones", escrow.milestoneId);
      if (!storedMilestoneId) {
        throw new BadRequestError("This escrow has an invalid milestone ID.");
      }
      milestone = await getMilestoneById(ctx, storedMilestoneId);
    }

    return { escrow, job, milestone };
  }

  if (input.parentType === "milestone") {
    const milestoneId = normalizeParentId(ctx, "milestones", parentId);
    const milestone = await getMilestoneById(ctx, milestoneId);
    const storedJobId = ctx.db.normalizeId("jobs", milestone.jobId);
    if (!storedJobId) {
      throw new BadRequestError("This milestone has an invalid parent job ID.");
    }
    const job = await getJobById(ctx, storedJobId);
    const escrow = await getUniqueEscrowByMilestoneId(ctx, milestone._id);
    return { escrow, job, milestone };
  }

  const jobId = normalizeParentId(ctx, "jobs", parentId);
  const job = await getJobById(ctx, jobId);
  if (getJobType(job) === "milestone_project") {
    throw new BadRequestError(
      "Milestone projects must be disputed by selecting a specific milestone or escrow.",
    );
  }

  const escrow = await getUniqueEscrowByJobId(ctx, job._id);
  let milestone: Doc<"milestones"> | null = null;
  if (escrow?.milestoneId !== undefined) {
    const storedMilestoneId = ctx.db.normalizeId("milestones", escrow.milestoneId);
    if (!storedMilestoneId) {
      throw new BadRequestError("This escrow has an invalid milestone ID.");
    }
    milestone = await getMilestoneById(ctx, storedMilestoneId);
  }

  return { escrow, job, milestone };
}

export async function resolveDisputeParticipants(
  ctx: QueryCtx,
  input: { parentType: TDisputeParentType; parentId: string },
): Promise<TResolvedDisputeParent> {
  const { escrow, job, milestone } = await getDisputeParentRecords(ctx, input);
  if (!escrow) {
    throw new NotFoundError("Active escrow not found for this dispute.");
  }
  if (!escrow.escrowId) {
    throw new BadRequestError("This escrow is missing its on-chain escrow id.");
  }

  const jobType = getJobType(job);
  if (jobType === "milestone_project" && !milestone) {
    throw new BadRequestError(
      "Milestone projects must be disputed by selecting a specific milestone or escrow.",
    );
  }
  if (jobType === "micro_gig" && milestone) {
    throw new BadRequestError("Micro-gig escrows cannot be linked to a milestone.");
  }
  if (escrow.jobId !== job._id) {
    throw new BadRequestError("Escrow is not linked to its parent job.");
  }
  if (milestone) {
    if (milestone.jobId !== job._id) {
      throw new BadRequestError("Milestone does not belong to the escrow's parent job.");
    }
    if (escrow.milestoneId !== milestone._id) {
      throw new BadRequestError("Escrow is not linked to the selected milestone.");
    }
    if (milestone.escrowId !== undefined && milestone.escrowId !== escrow.escrowId) {
      throw new ConflictError("Milestone escrow reference does not match the selected escrow.");
    }
  }

  if (normalizeWalletAddress(escrow.clientWallet) !== normalizeWalletAddress(job.clientWallet)) {
    throw new ForbiddenError("Escrow client must match the parent job owner.");
  }

  const assignedFreelancerWallet =
    milestone !== null ? milestone.assignedFreelancerWallet : job.selectedFreelancerWallet;
  if (!assignedFreelancerWallet || !escrow.freelancerWallet) {
    throw new ForbiddenError("Only assigned escrow work can be disputed.");
  }
  if (
    normalizeWalletAddress(escrow.freelancerWallet) !==
    normalizeWalletAddress(assignedFreelancerWallet)
  ) {
    throw new ForbiddenError("Escrow freelancer must match the assigned freelancer.");
  }

  const canonicalParentType: TDisputeParentType =
    milestone !== null ? "milestone" : input.parentType === "escrow" ? "escrow" : "micro_gig";
  const canonicalParentId =
    canonicalParentType === "escrow"
      ? escrow._id
      : milestone !== null
        ? milestone._id
        : escrow.jobId;

  return {
    parentType: canonicalParentType,
    parentId: canonicalParentId,
    jobId: escrow.jobId,
    ...(milestone === null ? { microGigId: escrow.jobId } : {}),
    ...(milestone !== null ? { milestoneId: milestone._id } : {}),
    escrowId: escrow._id,
    onChainEscrowId: escrow.escrowId,
    clientWallet: normalizeWalletAddress(escrow.clientWallet),
    freelancerWallet: normalizeWalletAddress(escrow.freelancerWallet),
    status: milestone?.status ?? job.status,
    escrowStatus: escrow.status,
  };
}

export function getDisputeRole(
  walletAddress: string,
  dispute: Pick<Doc<"disputes">, "clientWallet" | "freelancerWallet">,
): TDisputeParticipantRole {
  const wallet = normalizeWalletAddress(walletAddress);
  if (wallet === normalizeWalletAddress(dispute.clientWallet)) return "client";
  if (wallet === normalizeWalletAddress(dispute.freelancerWallet)) return "freelancer";
  throw new ForbiddenError("Only the client or assigned freelancer can use this dispute.");
}

export function assertCanViewDispute(
  dispute: Pick<Doc<"disputes">, "clientWallet" | "freelancerWallet">,
  viewerWallet?: string,
) {
  if (!viewerWallet) {
    throw new ForbiddenError("You do not have permission to view this dispute.");
  }
  return getDisputeRole(viewerWallet, dispute);
}

export function assertCanRespondToDispute(dispute: Doc<"disputes">, walletAddress: string) {
  if (!isActiveDisputeStatus(dispute.status)) {
    throw new BadRequestError("This dispute is not accepting new responses.");
  }
  return getDisputeRole(walletAddress, dispute);
}

export async function getActiveDisputeForEscrowId(ctx: QueryCtx, escrowId: Id<"escrows">) {
  const disputes = await Promise.all(
    ACTIVE_DISPUTE_STATUSES.map((status) =>
      ctx.db
        .query("disputes")
        .withIndex("by_escrow_status", (q) => q.eq("escrowId", escrowId).eq("status", status))
        .first(),
    ),
  );

  return disputes.find((dispute) => dispute !== null) ?? null;
}

export async function assertNoActiveDispute(
  ctx: QueryCtx,
  input: { escrowId: Id<"escrows">; milestoneId?: Id<"milestones"> },
) {
  const existingEscrowDispute = await getActiveDisputeForEscrowId(ctx, input.escrowId);
  if (existingEscrowDispute) {
    throw new ConflictError("This escrow is already disputed.");
  }

  if (input.milestoneId !== undefined) {
    const milestoneDisputes = await Promise.all(
      ACTIVE_DISPUTE_STATUSES.map((status) =>
        ctx.db
          .query("disputes")
          .withIndex("by_milestone_status", (q) =>
            q.eq("milestoneId", input.milestoneId).eq("status", status),
          )
          .first(),
      ),
    );
    if (milestoneDisputes.some((dispute) => dispute !== null)) {
      throw new ConflictError("This milestone already has an active dispute.");
    }
  }
}

export async function assertCanOpenDispute(
  ctx: QueryCtx,
  input: {
    parentType: TDisputeParentType;
    parentId: string;
    openedByWallet: string;
  },
) {
  const openedByWallet = normalizeWalletAddress(input.openedByWallet);
  const parent = await resolveDisputeParticipants(ctx, input);
  const openedByRole = getDisputeRole(openedByWallet, parent);

  if (parent.escrowStatus === "released") {
    throw new BadRequestError("You cannot dispute an escrow that has already been released.");
  }
  if (parent.escrowStatus === "cancelled") {
    throw new BadRequestError("You cannot dispute an escrow that has already been cancelled.");
  }
  if (parent.escrowStatus !== "funded" && parent.escrowStatus !== "submitted") {
    throw new BadRequestError("Disputes require an assigned escrow in funded or submitted status.");
  }

  await assertNoActiveDispute(ctx, {
    escrowId: parent.escrowId,
    ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
  });

  return {
    parent,
    openedByWallet,
    openedByRole,
  };
}

export async function assertEscrowActionNotBlockedByDispute(
  ctx: QueryCtx,
  input: { escrowId: Id<"escrows"> },
) {
  const active = await getActiveDisputeForEscrowId(ctx, input.escrowId);
  if (active) {
    throw new ForbiddenError(
      "This escrow is currently disputed. Release and cancellation actions are paused during review.",
    );
  }
}

export async function validateDisputeAttachmentIds(
  ctx: QueryCtx,
  input: {
    attachmentIds: Id<"attachments">[];
    walletAddress: string;
    parentId?: string;
  },
) {
  if (input.attachmentIds.length > MAX_ATTACHMENTS) {
    throw new BadRequestError("Attach 25 files or fewer.");
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
      input.parentId === undefined
        ? attachment.parentType !== "unknown"
        : attachment.parentType !== "unknown" &&
          (attachment.parentType !== "dispute" || attachment.parentId !== input.parentId)
    ) {
      throw new BadRequestError("Attachment is already linked to another record.");
    }
  }
}

export async function attachEvidenceToDispute(
  ctx: MutationCtx,
  input: { attachmentIds: Id<"attachments">[]; disputeId: Id<"disputes"> },
) {
  const now = Date.now();
  for (const attachmentId of input.attachmentIds) {
    await ctx.db.patch(attachmentId, {
      parentType: "dispute",
      parentId: input.disputeId,
      visibility: "participants",
      updatedAt: now,
    });
  }
}

export function validateRelatedIds<TId extends string>(ids: TId[], label: string): TId[] {
  if (ids.length > MAX_RELATED_RECORDS) {
    throw new BadRequestError(`${label} can include 20 records or fewer.`);
  }
  return Array.from(new Set(ids));
}

type TDisputeRelatedTable =
  | "attachments"
  | "workSubmissions"
  | "revisionRequests"
  | "messages"
  | "conversations"
  | "deadlineAuditEvents"
  | "disputes";

function getRelatedTableLabel(tableName: TDisputeRelatedTable): string {
  const labels: Record<TDisputeRelatedTable, string> = {
    attachments: "attachment",
    workSubmissions: "work submission",
    revisionRequests: "revision request",
    messages: "message",
    conversations: "conversation",
    deadlineAuditEvents: "deadline event",
    disputes: "dispute",
  };

  return labels[tableName];
}

function normalizeRelatedRecordId<TableName extends TDisputeRelatedTable>(
  ctx: QueryCtx,
  tableName: TableName,
  id: string,
): Id<TableName> {
  const normalizedId = ctx.db.normalizeId(tableName, id);
  if (!normalizedId) {
    throw new BadRequestError(
      `The ${getRelatedTableLabel(tableName)} reference must be a valid ${getRelatedTableLabel(tableName)} ID.`,
    );
  }

  return normalizedId;
}

function requireResolvedJobId(parent: TResolvedDisputeParent): Id<"jobs"> {
  if (!parent.jobId) {
    throw new BadRequestError("The disputed work is missing its parent job.");
  }

  return parent.jobId;
}

function assertRelatedParentId(
  ctx: QueryCtx,
  record: {
    parentType: TDisputeParentType;
    parentId: string;
  },
  parent: TResolvedDisputeParent,
  label: string,
) {
  const jobId = requireResolvedJobId(parent);

  if (record.parentType === "milestone") {
    const milestoneId = normalizeParentId(ctx, "milestones", record.parentId);
    if (!parent.milestoneId || milestoneId !== parent.milestoneId) {
      throw new BadRequestError(`${label} is linked to a different milestone.`);
    }
    return;
  }

  if (record.parentType === "escrow") {
    const escrowId = normalizeParentId(ctx, "escrows", record.parentId);
    if (escrowId !== parent.escrowId) {
      throw new BadRequestError(`${label} is linked to a different escrow.`);
    }
    return;
  }

  const recordJobId = normalizeParentId(ctx, "jobs", record.parentId);
  if (parent.milestoneId !== undefined) {
    throw new BadRequestError(`${label} does not identify the selected milestone.`);
  }
  if (recordJobId !== jobId) {
    throw new BadRequestError(`${label} is linked to a different job.`);
  }
}

function assertOptionalRelatedLink(
  ctx: QueryCtx,
  input: {
    value: string | undefined;
    tableName: "jobs" | "milestones" | "escrows";
    expected: string | undefined;
    label: string;
  },
) {
  if (input.value === undefined) {
    return;
  }

  const normalizedId = normalizeParentId(ctx, input.tableName, input.value);
  if (input.expected === undefined || normalizedId !== input.expected) {
    throw new BadRequestError(`${input.label} does not match the disputed work.`);
  }
}

function assertRelatedWorkLinks(
  ctx: QueryCtx,
  record: {
    jobId?: string;
    milestoneId?: string;
    escrowId?: string;
    onChainEscrowId?: string;
  },
  parent: TResolvedDisputeParent,
  label: string,
) {
  assertOptionalRelatedLink(ctx, {
    value: record.jobId,
    tableName: "jobs",
    expected: parent.jobId,
    label: `${label} job link`,
  });
  assertOptionalRelatedLink(ctx, {
    value: record.milestoneId,
    tableName: "milestones",
    expected: parent.milestoneId,
    label: `${label} milestone link`,
  });
  assertOptionalRelatedLink(ctx, {
    value: record.escrowId,
    tableName: "escrows",
    expected: parent.escrowId,
    label: `${label} escrow link`,
  });

  if (record.onChainEscrowId !== undefined && record.onChainEscrowId !== parent.onChainEscrowId) {
    throw new BadRequestError(`${label} on-chain escrow link does not match the disputed work.`);
  }
}

function assertRelatedParticipants(
  record: { clientWallet: string; freelancerWallet: string },
  parent: TResolvedDisputeParent,
  label: string,
) {
  if (
    normalizeWalletAddress(record.clientWallet) !== parent.clientWallet ||
    normalizeWalletAddress(record.freelancerWallet) !== parent.freelancerWallet
  ) {
    throw new ForbiddenError(`${label} participants do not match the disputed work.`);
  }
}

async function validateDisputeWorkSubmission(
  ctx: QueryCtx,
  input: { submissionId: string; parent: TResolvedDisputeParent },
) {
  const submissionId = normalizeRelatedRecordId(ctx, "workSubmissions", input.submissionId);
  const submission = await ctx.db.get(submissionId);
  if (!submission) {
    throw new NotFoundError("Work submission not found.");
  }

  assertRelatedParentId(ctx, submission, input.parent, "Work submission");
  assertRelatedWorkLinks(ctx, submission, input.parent, "Work submission");
  assertRelatedParticipants(submission, input.parent, "Work submission");

  return submission;
}

export async function validateDisputeWorkSubmissionIds(
  ctx: QueryCtx,
  input: { submissionIds: Id<"workSubmissions">[]; parent: TResolvedDisputeParent },
): Promise<Id<"workSubmissions">[]> {
  const submissionIds = input.submissionIds.map(String);
  const normalizedIds = submissionIds.map((submissionId) =>
    normalizeRelatedRecordId(ctx, "workSubmissions", submissionId),
  );

  for (const submissionId of normalizedIds) {
    await validateDisputeWorkSubmission(ctx, {
      submissionId,
      parent: input.parent,
    });
  }

  return normalizedIds;
}

export async function validateDisputeRevisionRequestIds(
  ctx: QueryCtx,
  input: { revisionRequestIds: Id<"revisionRequests">[]; parent: TResolvedDisputeParent },
): Promise<Id<"revisionRequests">[]> {
  const normalizedIds = input.revisionRequestIds.map((revisionRequestId) =>
    normalizeRelatedRecordId(ctx, "revisionRequests", String(revisionRequestId)),
  );

  for (const revisionRequestId of normalizedIds) {
    const revision = await ctx.db.get(revisionRequestId);
    if (!revision) {
      throw new NotFoundError("Revision request not found.");
    }

    assertRelatedParentId(ctx, revision, input.parent, "Revision request");
    assertRelatedWorkLinks(ctx, revision, input.parent, "Revision request");
    assertRelatedParticipants(revision, input.parent, "Revision request");

    const referencedSubmissionIds = [
      revision.workSubmissionId,
      revision.previousSubmissionId,
      revision.revisionSubmissionId,
    ].filter((submissionId): submissionId is Id<"workSubmissions"> => submissionId !== undefined);

    for (const submissionId of referencedSubmissionIds) {
      await validateDisputeWorkSubmission(ctx, {
        submissionId,
        parent: input.parent,
      });
    }
  }

  return normalizedIds;
}

function assertPreviousDisputeBelongsToWork(
  ctx: QueryCtx,
  previousDispute: Doc<"disputes">,
  parent: TResolvedDisputeParent,
) {
  assertRelatedParentId(ctx, previousDispute, parent, "Previous dispute");
  assertRelatedWorkLinks(ctx, previousDispute, parent, "Previous dispute");
}

function assertConversationIncludesParticipants(
  conversation: Pick<Doc<"conversations">, "participantWallets">,
  parent: TResolvedDisputeParent,
) {
  const participants = new Set(conversation.participantWallets.map(normalizeWalletAddress));
  if (!participants.has(parent.clientWallet) || !participants.has(parent.freelancerWallet)) {
    throw new ForbiddenError("Conversation must include both dispute participants.");
  }
}

async function assertDisputeConversationParent(
  ctx: QueryCtx,
  input: {
    conversation: Doc<"conversations">;
    relatedSubmissionIds: Id<"workSubmissions">[];
    parent: TResolvedDisputeParent;
  },
) {
  const { conversation, parent } = input;
  const jobId = requireResolvedJobId(parent);

  if (conversation.parentType === "direct") {
    throw new BadRequestError("Direct conversations cannot be used as dispute references.");
  }

  if (conversation.parentType === "job" || conversation.parentType === "micro_gig") {
    const conversationJobId = normalizeParentId(ctx, "jobs", conversation.parentId);
    if (conversationJobId !== jobId) {
      throw new BadRequestError("Conversation is linked to a different job.");
    }
    return;
  }

  if (conversation.parentType === "escrow") {
    const conversationEscrowId = normalizeParentId(ctx, "escrows", conversation.parentId);
    if (conversationEscrowId !== parent.escrowId) {
      throw new BadRequestError("Conversation is linked to a different escrow.");
    }
    return;
  }

  if (conversation.parentType === "milestone") {
    const conversationMilestoneId = normalizeParentId(ctx, "milestones", conversation.parentId);
    if (!parent.milestoneId || conversationMilestoneId !== parent.milestoneId) {
      throw new BadRequestError("Conversation is linked to a different milestone.");
    }
    return;
  }

  if (conversation.parentType === "work_submission") {
    const conversationSubmissionId = normalizeRelatedRecordId(
      ctx,
      "workSubmissions",
      conversation.parentId,
    );
    if (!input.relatedSubmissionIds.includes(conversationSubmissionId)) {
      throw new BadRequestError("Conversation is not linked to a related work submission.");
    }
    return;
  }

  if (conversation.parentType === "dispute") {
    const previousDisputeId = normalizeRelatedRecordId(ctx, "disputes", conversation.parentId);
    const previousDispute = await ctx.db.get(previousDisputeId);
    if (!previousDispute) {
      throw new NotFoundError("Previous dispute not found.");
    }
    assertPreviousDisputeBelongsToWork(ctx, previousDispute, parent);
    return;
  }

  throw new BadRequestError("Conversation is not linked to an eligible dispute parent.");
}

export async function validateDisputeMessageIds(
  ctx: QueryCtx,
  input: {
    messageIds: Id<"messages">[];
    relatedSubmissionIds: Id<"workSubmissions">[];
    parent: TResolvedDisputeParent;
  },
): Promise<Id<"messages">[]> {
  const normalizedIds = input.messageIds.map((messageId) =>
    normalizeRelatedRecordId(ctx, "messages", String(messageId)),
  );

  for (const messageId of normalizedIds) {
    const message = await ctx.db.get(messageId);
    if (!message || message.status !== "sent") {
      throw new NotFoundError("Message not found or no longer available.");
    }

    const conversationId = normalizeRelatedRecordId(
      ctx,
      "conversations",
      String(message.conversationId),
    );
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation not found.");
    }
    if (
      message.conversationId !== conversation._id ||
      message.parentType !== conversation.parentType ||
      message.parentId !== conversation.parentId
    ) {
      throw new BadRequestError("Message and conversation parent links do not match.");
    }

    await assertDisputeConversationParent(ctx, {
      conversation,
      relatedSubmissionIds: input.relatedSubmissionIds,
      parent: input.parent,
    });
    assertConversationIncludesParticipants(conversation, input.parent);

    if (message.senderWallet !== "system") {
      const senderWallet = normalizeWalletAddress(message.senderWallet);
      const conversationParticipants = new Set(
        conversation.participantWallets.map(normalizeWalletAddress),
      );
      if (!conversationParticipants.has(senderWallet)) {
        throw new ForbiddenError("Message sender is not a conversation participant.");
      }
    }
  }

  return normalizedIds;
}

export async function validateDisputeDeadlineEventIds(
  ctx: QueryCtx,
  input: { deadlineEventIds: Id<"deadlineAuditEvents">[]; parent: TResolvedDisputeParent },
): Promise<Id<"deadlineAuditEvents">[]> {
  const normalizedIds = input.deadlineEventIds.map((eventId) =>
    normalizeRelatedRecordId(ctx, "deadlineAuditEvents", String(eventId)),
  );
  const expectedParentType = input.parent.milestoneId !== undefined ? "milestone" : "micro_gig";
  const expectedParentId = input.parent.milestoneId ?? requireResolvedJobId(input.parent);

  for (const eventId of normalizedIds) {
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new NotFoundError("Deadline event not found.");
    }

    if (event.parentType !== expectedParentType) {
      throw new BadRequestError("Deadline event is linked to a different work parent.");
    }

    const eventParentId = normalizeParentId(
      ctx,
      expectedParentType === "milestone" ? "milestones" : "jobs",
      event.parentId,
    );
    if (eventParentId !== expectedParentId) {
      throw new BadRequestError("Deadline event is linked to a different work parent.");
    }
  }

  return normalizedIds;
}

export async function createDisputeEvent(
  ctx: MutationCtx,
  input: {
    disputeId: Id<"disputes">;
    type: TDisputeEventType;
    actorWallet: string;
    actorWalletType: TWalletType | "system";
    actorRole: TDisputeActorRole;
    message: string;
    attachmentIds?: Id<"attachments">[];
    oldStatus?: TDisputeStatus;
    newStatus?: TDisputeStatus;
    transactionHash?: string;
    metadata?: unknown;
    createdAt?: number;
  },
) {
  return await ctx.db.insert("disputeEvents", {
    disputeId: input.disputeId,
    type: input.type,
    actorWallet:
      input.actorWallet === "system" ? "system" : normalizeWalletAddress(input.actorWallet),
    actorWalletType: input.actorWalletType,
    actorRole: input.actorRole,
    message: sanitizeDisputeMessage(input.message),
    attachmentIds: input.attachmentIds ?? [],
    ...(input.oldStatus !== undefined ? { oldStatus: input.oldStatus } : {}),
    ...(input.newStatus !== undefined ? { newStatus: input.newStatus } : {}),
    ...(input.transactionHash !== undefined ? { transactionHash: input.transactionHash } : {}),
    createdAt: input.createdAt ?? Date.now(),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });
}

export async function createDisputeNotification(
  ctx: MutationCtx,
  input: {
    dispute: Doc<"disputes">;
    recipientWallet: string;
    recipientWalletType?: TWalletType;
    type:
      | "dispute_opened"
      | "dispute_on_chain_marked"
      | "dispute_on_chain_mark_failed"
      | "dispute_evidence_added"
      | "dispute_response_added"
      | "dispute_status_changed";
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
    parentType: input.dispute.milestoneId !== undefined ? "milestone" : "micro_gig",
    parentId: input.dispute.milestoneId ?? input.dispute.jobId ?? input.dispute.parentId,
    ...(input.dispute.jobId !== undefined ? { jobId: input.dispute.jobId } : {}),
    ...(input.dispute.milestoneId !== undefined ? { milestoneId: input.dispute.milestoneId } : {}),
    ...(input.dispute.escrowId !== undefined ? { escrowId: input.dispute.escrowId } : {}),
    createdAt: Date.now(),
    metadata: {
      disputeId: input.dispute._id,
      disputeNumber: input.dispute.disputeNumber,
      ...(input.metadata !== undefined ? { detail: input.metadata } : {}),
    },
  });
}

export async function createDisputeSystemMessage(
  ctx: MutationCtx,
  input: {
    dispute: Doc<"disputes">;
    eventType:
      | "dispute_opened"
      | "dispute_on_chain_marked"
      | "dispute_on_chain_mark_failed"
      | "dispute_evidence_added"
      | "dispute_status_changed"
      | "dispute_resolved";
    body: string;
    transactionHash?: string;
  },
) {
  if (input.dispute.escrowId === undefined) {
    return null;
  }

  try {
    return await createSystemMessageForEvent(ctx, {
      parentType: "escrow",
      parentId: input.dispute.escrowId,
      eventType: input.eventType,
      body: input.body,
      eventPayload: {
        disputeId: input.dispute._id,
        disputeNumber: input.dispute.disputeNumber,
        ...(input.transactionHash !== undefined ? { transactionHash: input.transactionHash } : {}),
      },
    });
  } catch {
    return null;
  }
}

export async function withDisputeAttachments(
  ctx: QueryCtx,
  dispute: Doc<"disputes">,
  viewerWallet?: string,
) {
  assertCanViewDispute(dispute, viewerWallet);
  const attachments = [];

  for (const attachmentId of dispute.evidenceAttachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) continue;
    try {
      await assertCanViewAttachment(ctx, attachment, viewerWallet);
      attachments.push(await serializeAttachmentForViewer(ctx, attachment, viewerWallet));
    } catch {
      // Hide inaccessible evidence.
    }
  }

  return { ...dispute, attachments };
}

export function buildDisputeNumber(now = Date.now()): string {
  return `DSP-${new Date(now).toISOString().slice(0, 10).replace(/-/g, "")}-${now.toString(36).toUpperCase()}`;
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
