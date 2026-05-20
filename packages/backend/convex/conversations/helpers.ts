import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TWalletType } from "../users/schema";
import type {
  TConversationParentType,
  TMessageEventType,
  TMessageKind,
  TMessageSenderRole,
} from "./schema";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress, optionalNonEmptyString } from "../_shared/input";

const MAX_MESSAGE_BODY_LENGTH = 4000;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;

export type TConversationParticipant = {
  walletAddress: string;
  walletType?: TWalletType;
};

export type TResolvedConversationParent = {
  parentType: TConversationParentType;
  parentId: string;
  jobId?: Id<"jobs">;
  microGigId?: Id<"jobs">;
  milestoneId?: Id<"milestones">;
  escrowId?: Id<"escrows">;
  workSubmissionId?: Id<"workSubmissions">;
  disputeId?: string;
  clientWallet?: string;
  freelancerWallet?: string;
  title?: string;
  participants: TConversationParticipant[];
};

export function normalizeMessageBody(body: string): string {
  return body.replace(/\r\n/g, "\n").replace(/\s+$/g, "").slice(0, MAX_MESSAGE_BODY_LENGTH);
}

export function buildMessagePreview(input: {
  body: string;
  attachmentCount: number;
  kind?: TMessageKind;
  eventType?: TMessageEventType;
}): string {
  const body = normalizeMessageBody(input.body).replace(/\s+/g, " ").trim();
  if (body.length > 0) {
    return body.length > 140 ? `${body.slice(0, 137)}...` : body;
  }

  if (input.kind === "event" && input.eventType) {
    return formatEventMessage(input.eventType);
  }

  if (input.attachmentCount > 0) {
    return `${input.attachmentCount} attachment${input.attachmentCount === 1 ? "" : "s"}`;
  }

  return "Message";
}

export function formatEventMessage(eventType: TMessageEventType): string {
  const labels: Record<TMessageEventType, string> = {
    escrow_created: "Escrow was created.",
    escrow_funded: "Escrow was funded.",
    work_submitted: "Proof of work was submitted.",
    preview_submitted: "Work preview was submitted.",
    preview_accepted: "Work preview was accepted for final submission.",
    proof_anchored: "Proof hash was anchored on-chain.",
    work_approved: "Work was approved.",
    escrow_released: "Escrow payment was released.",
    escrow_cancelled: "Escrow was cancelled.",
    revision_requested: "Revision was requested.",
    revision_submitted: "Revision was submitted.",
    deadline_warning: "Deadline warning.",
    deadline_missed: "Deadline missed.",
    dispute_opened: "Dispute was opened.",
    dispute_on_chain_marked: "Escrow was marked disputed on-chain.",
    dispute_on_chain_mark_failed: "On-chain dispute marking failed.",
    dispute_evidence_added: "Dispute evidence was added.",
    dispute_status_changed: "Dispute status changed.",
    dispute_resolved: "Dispute was resolved.",
    cancellation_requested: "Cancellation was requested.",
    cancellation_accepted: "Cancellation was accepted.",
    cancellation_rejected: "Cancellation was rejected.",
    cancellation_approved: "Cancellation was approved for on-chain execution.",
    cancellation_on_chain_started: "On-chain cancellation started.",
    cancellation_on_chain_succeeded: "Escrow cancellation was confirmed.",
    cancellation_on_chain_failed: "On-chain cancellation failed.",
    cancellation_withdrawn: "Cancellation request was withdrawn.",
    cancellation_expired: "Cancellation request expired.",
  };

  return labels[eventType];
}

export function getParticipantWallets(participants: readonly TConversationParticipant[]) {
  return Array.from(new Set(participants.map((participant) => participant.walletAddress))).sort();
}

function getSenderRole(
  walletAddress: string,
  conversation: Pick<Doc<"conversations">, "clientWallet" | "freelancerWallet">,
): TMessageSenderRole {
  if (conversation.clientWallet === walletAddress) {
    return "client";
  }
  if (conversation.freelancerWallet === walletAddress) {
    return "freelancer";
  }

  throw new ForbiddenError("Only the client and assigned freelancer can use this chat.");
}

export function assertParticipant(
  conversation: Pick<Doc<"conversations">, "participantWallets">,
  walletAddress: string,
) {
  const normalizedWallet = normalizeWalletAddress(walletAddress);
  if (!conversation.participantWallets.includes(normalizedWallet)) {
    throw new ForbiddenError("You do not have access to this conversation.");
  }

  return normalizedWallet;
}

export function assertCanSendMessage(
  conversation: Pick<
    Doc<"conversations">,
    "participantWallets" | "status" | "clientWallet" | "freelancerWallet"
  >,
  walletAddress: string,
) {
  const normalizedWallet = assertParticipant(conversation, walletAddress);
  if (conversation.status === "locked") {
    throw new ForbiddenError("This conversation is locked.");
  }
  if (conversation.status === "archived") {
    throw new ForbiddenError("This conversation is archived.");
  }

  return {
    walletAddress: normalizedWallet,
    senderRole: getSenderRole(normalizedWallet, conversation),
  };
}

export async function getConversationOrThrow(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    throw new NotFoundError("Conversation not found.");
  }

  return conversation;
}

export async function getConversationByParent(
  ctx: QueryCtx,
  parentType: TConversationParentType,
  parentId: string,
) {
  return await ctx.db
    .query("conversations")
    .withIndex("by_parent", (q) => q.eq("parentType", parentType).eq("parentId", parentId))
    .first();
}

function ensureRelationshipParticipants(input: {
  clientWallet?: string;
  freelancerWallet?: string;
  parentLabel: string;
}) {
  if (!input.clientWallet || !input.freelancerWallet) {
    throw new ForbiddenError(
      `${input.parentLabel} chat is available after a client and freelancer are assigned.`,
    );
  }

  const clientWallet = normalizeWalletAddress(input.clientWallet);
  const freelancerWallet = normalizeWalletAddress(input.freelancerWallet);

  return {
    clientWallet,
    freelancerWallet,
    participants: [{ walletAddress: clientWallet }, { walletAddress: freelancerWallet }],
  };
}

export async function resolveConversationParticipants(
  ctx: QueryCtx,
  input: { parentType: TConversationParentType; parentId: string },
): Promise<TResolvedConversationParent> {
  const parentId = optionalNonEmptyString(input.parentId, "parentId");
  if (!parentId) {
    throw new BadRequestError("Parent context is required.");
  }

  if (input.parentType === "job" || input.parentType === "micro_gig") {
    const job = await ctx.db.get(parentId as Id<"jobs">);
    if (!job) {
      throw new NotFoundError("Parent job was not found.");
    }
    const participants = ensureRelationshipParticipants({
      clientWallet: job.clientWallet,
      freelancerWallet: job.selectedFreelancerWallet,
      parentLabel: "Work",
    });
    return {
      parentType: input.parentType,
      parentId,
      jobId: job._id,
      ...(input.parentType === "micro_gig" ? { microGigId: job._id } : {}),
      clientWallet: participants.clientWallet,
      freelancerWallet: participants.freelancerWallet,
      title: job.title,
      participants: participants.participants,
    };
  }

  if (input.parentType === "milestone") {
    const milestone = await ctx.db.get(parentId as Id<"milestones">);
    if (!milestone) {
      throw new NotFoundError("Parent milestone was not found.");
    }
    const job = await ctx.db.get(milestone.jobId);
    if (!job) {
      throw new NotFoundError("Parent job was not found.");
    }
    const participants = ensureRelationshipParticipants({
      clientWallet: job.clientWallet,
      freelancerWallet: milestone.assignedFreelancerWallet,
      parentLabel: "Milestone",
    });
    return {
      parentType: "milestone",
      parentId,
      jobId: job._id,
      milestoneId: milestone._id,
      clientWallet: participants.clientWallet,
      freelancerWallet: participants.freelancerWallet,
      title: milestone.title,
      participants: participants.participants,
    };
  }

  if (input.parentType === "escrow") {
    const escrow = await ctx.db.get(parentId as Id<"escrows">);
    if (!escrow) {
      throw new NotFoundError("Parent escrow was not found.");
    }
    const job = await ctx.db.get(escrow.jobId);
    const participants = ensureRelationshipParticipants({
      clientWallet: escrow.clientWallet,
      freelancerWallet: escrow.freelancerWallet,
      parentLabel: "Escrow",
    });
    return {
      parentType: "escrow",
      parentId,
      jobId: escrow.jobId,
      ...(job?.jobType === "micro_gig" ? { microGigId: escrow.jobId } : {}),
      ...(escrow.milestoneId !== undefined ? { milestoneId: escrow.milestoneId } : {}),
      escrowId: escrow._id,
      clientWallet: participants.clientWallet,
      freelancerWallet: participants.freelancerWallet,
      title: job?.title ?? `Escrow ${escrow.escrowId}`,
      participants: participants.participants,
    };
  }

  if (input.parentType === "work_submission") {
    const submission = await ctx.db.get(parentId as Id<"workSubmissions">);
    if (!submission || submission.status === "cancelled") {
      throw new NotFoundError("Proof submission was not found.");
    }
    const participants = ensureRelationshipParticipants({
      clientWallet: submission.clientWallet,
      freelancerWallet: submission.freelancerWallet,
      parentLabel: "Proof",
    });
    return {
      parentType: "work_submission",
      parentId,
      ...(submission.jobId !== undefined ? { jobId: submission.jobId } : {}),
      ...(submission.milestoneId !== undefined ? { milestoneId: submission.milestoneId } : {}),
      ...(submission.escrowId !== undefined ? { escrowId: submission.escrowId } : {}),
      workSubmissionId: submission._id,
      clientWallet: participants.clientWallet,
      freelancerWallet: participants.freelancerWallet,
      title: "Proof submission",
      participants: participants.participants,
    };
  }

  if (input.parentType === "dispute") {
    const dispute = await ctx.db.get(parentId as Id<"disputes">);
    if (!dispute) {
      throw new NotFoundError("Dispute was not found.");
    }
    const participants = ensureRelationshipParticipants({
      clientWallet: dispute.clientWallet,
      freelancerWallet: dispute.freelancerWallet,
      parentLabel: "Dispute",
    });
    return {
      parentType: "dispute",
      parentId,
      ...(dispute.jobId !== undefined ? { jobId: dispute.jobId } : {}),
      ...(dispute.microGigId !== undefined ? { microGigId: dispute.microGigId } : {}),
      ...(dispute.milestoneId !== undefined ? { milestoneId: dispute.milestoneId } : {}),
      ...(dispute.escrowId !== undefined ? { escrowId: dispute.escrowId } : {}),
      disputeId: dispute._id,
      clientWallet: participants.clientWallet,
      freelancerWallet: participants.freelancerWallet,
      title: dispute.title,
      participants: participants.participants,
    };
  }

  throw new BadRequestError("This conversation parent type is not supported yet.");
}

export function validateMessagePayload(input: {
  body: string;
  attachmentIds: Id<"attachments">[];
}) {
  const body = normalizeMessageBody(input.body);
  if (input.attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new BadRequestError("Attach 10 files or fewer per message.");
  }
  if (body.trim().length === 0 && input.attachmentIds.length === 0) {
    throw new BadRequestError("Write a message or attach a file before sending.");
  }

  return body;
}

export async function assertCanAttachToMessage(
  ctx: MutationCtx,
  input: {
    attachmentIds: Id<"attachments">[];
    walletAddress: string;
    messageId: Id<"messages">;
  },
) {
  const normalizedWallet = normalizeWalletAddress(input.walletAddress);
  const now = Date.now();

  for (const attachmentId of input.attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.status !== "active") {
      throw new BadRequestError("One or more attachments could not be sent.");
    }
    if (attachment.uploadedByWallet !== normalizedWallet) {
      throw new ForbiddenError("You cannot attach files owned by another wallet.");
    }
    if (attachment.parentType !== "unknown") {
      throw new BadRequestError("Attachment is already linked to another parent.");
    }

    await ctx.db.patch(attachmentId, {
      parentType: "chat_message",
      parentId: input.messageId,
      visibility: "participants",
      updatedAt: now,
    });
  }
}

export async function insertSystemMessage(
  ctx: MutationCtx,
  input: {
    conversation: Doc<"conversations">;
    eventType: TMessageEventType;
    body?: string;
    eventPayload?: unknown;
    createdAt?: number;
  },
) {
  const now = input.createdAt ?? Date.now();
  const body = normalizeMessageBody(input.body ?? formatEventMessage(input.eventType));
  const messageId = await ctx.db.insert("messages", {
    conversationId: input.conversation._id,
    parentType: input.conversation.parentType,
    parentId: input.conversation.parentId,
    senderWallet: "system",
    senderWalletType: "system",
    senderRole: "system",
    kind: "event",
    body,
    attachmentIds: [],
    eventType: input.eventType,
    ...(input.eventPayload !== undefined ? { eventPayload: input.eventPayload } : {}),
    status: "sent",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.patch(input.conversation._id, {
    lastMessageId: messageId,
    lastMessagePreview: buildMessagePreview({
      body,
      attachmentCount: 0,
      kind: "event",
      eventType: input.eventType,
    }),
    lastMessageAt: now,
    updatedAt: now,
  });

  return messageId;
}

export async function createSystemMessageForEvent(
  ctx: MutationCtx,
  input: {
    parentType: TConversationParentType;
    parentId: string;
    eventType: TMessageEventType;
    body?: string;
    eventPayload?: unknown;
  },
) {
  let conversation = await getConversationByParent(ctx, input.parentType, input.parentId);
  if (!conversation) {
    const resolved = await resolveConversationParticipants(ctx, input);
    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      parentType: resolved.parentType,
      parentId: resolved.parentId,
      ...(resolved.jobId !== undefined ? { jobId: resolved.jobId } : {}),
      ...(resolved.microGigId !== undefined ? { microGigId: resolved.microGigId } : {}),
      ...(resolved.milestoneId !== undefined ? { milestoneId: resolved.milestoneId } : {}),
      ...(resolved.escrowId !== undefined ? { escrowId: resolved.escrowId } : {}),
      ...(resolved.workSubmissionId !== undefined
        ? { workSubmissionId: resolved.workSubmissionId }
        : {}),
      ...(resolved.disputeId !== undefined ? { disputeId: resolved.disputeId } : {}),
      participantWallets: getParticipantWallets(resolved.participants),
      participantWalletTypes: resolved.participants,
      ...(resolved.clientWallet !== undefined ? { clientWallet: resolved.clientWallet } : {}),
      ...(resolved.freelancerWallet !== undefined
        ? { freelancerWallet: resolved.freelancerWallet }
        : {}),
      ...(resolved.title !== undefined ? { title: resolved.title } : {}),
      status: "active",
      createdByWallet: "system",
      createdAt: now,
      updatedAt: now,
    });
    conversation = await getConversationOrThrow(ctx, conversationId);
  }

  return await insertSystemMessage(ctx, {
    conversation,
    eventType: input.eventType,
    body: input.body,
    eventPayload: input.eventPayload,
  });
}
