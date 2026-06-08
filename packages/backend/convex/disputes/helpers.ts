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

async function getEscrowForDisputeParent(
  ctx: QueryCtx,
  input: { parentType: TDisputeParentType; parentId: string },
) {
  if (input.parentType === "escrow") {
    return await ctx.db.get(input.parentId as Id<"escrows">);
  }
  if (input.parentType === "milestone") {
    return await ctx.db
      .query("escrows")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", input.parentId as Id<"milestones">))
      .first();
  }
  if (input.parentType === "micro_gig" || input.parentType === "job") {
    return await ctx.db
      .query("escrows")
      .withIndex("by_jobId", (q) => q.eq("jobId", input.parentId as Id<"jobs">))
      .first();
  }

  return null;
}

export async function resolveDisputeParticipants(
  ctx: QueryCtx,
  input: { parentType: TDisputeParentType; parentId: string },
): Promise<TResolvedDisputeParent> {
  const parentId = requireNonEmptyString(input.parentId, "parentId");
  const escrow = await getEscrowForDisputeParent(ctx, { parentType: input.parentType, parentId });
  if (!escrow) {
    throw new NotFoundError("Active escrow not found for this dispute.");
  }
  if (!escrow.escrowId) {
    throw new BadRequestError("This escrow is missing its on-chain escrow id.");
  }
  if (!escrow.freelancerWallet) {
    throw new ForbiddenError("Only assigned escrow work can be disputed.");
  }

  const job = await ctx.db.get(escrow.jobId);
  if (!job) {
    throw new NotFoundError("Parent job not found.");
  }
  const milestone = escrow.milestoneId !== undefined ? await ctx.db.get(escrow.milestoneId) : null;

  const canonicalParentType: TDisputeParentType =
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
  if (wallet === dispute.clientWallet) return "client";
  if (wallet === dispute.freelancerWallet) return "freelancer";
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
  const disputes = await ctx.db
    .query("disputes")
    .withIndex("by_escrow_status", (q) => q.eq("escrowId", escrowId))
    .take(50);

  return disputes.find((dispute) => isActiveDisputeStatus(dispute.status)) ?? null;
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
    const milestoneDisputes = await ctx.db
      .query("disputes")
      .withIndex("by_milestone_status", (q) => q.eq("milestoneId", input.milestoneId))
      .take(50);
    if (milestoneDisputes.some((dispute) => isActiveDisputeStatus(dispute.status))) {
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

  if (openedByWallet !== parent.clientWallet && openedByWallet !== parent.freelancerWallet) {
    throw new ForbiddenError("Only the client or assigned freelancer can open a dispute.");
  }
  if (parent.escrowStatus === "released") {
    throw new BadRequestError("You cannot dispute an escrow that has already been released.");
  }
  if (parent.escrowStatus === "cancelled") {
    throw new BadRequestError("You cannot dispute an escrow that has already been cancelled.");
  }
  if (parent.escrowStatus !== "funded" && parent.escrowStatus !== "submitted") {
    throw new BadRequestError("Disputes require an active funded escrow.");
  }

  await assertNoActiveDispute(ctx, {
    escrowId: parent.escrowId,
    ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
  });
  const openedByRole: TDisputeParticipantRole =
    openedByWallet === parent.clientWallet ? "client" : "freelancer";

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
      attachment.parentType !== "unknown" &&
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
