import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { TWalletType } from "../users/schema";

import { mutation } from "../_generated/server";
import { isConfiguredAdminWallet } from "../_shared/adminAuth";
import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress, optionalNonEmptyString } from "../_shared/input";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanOpenDispute,
  assertCanRespondToDispute,
  attachEvidenceToDispute,
  buildDisputeNumber,
  createDisputeEvent,
  createDisputeNotification,
  createDisputeSystemMessage,
  getDisputeReasonLabel,
  getDisputeRole,
  getStellarExpertUrl,
  isActiveDisputeStatus,
  sanitizeDisputeDescription,
  sanitizeDisputeMessage,
  sanitizeDisputeTitle,
  sanitizeOptionalProofHash,
  validateDisputeAttachmentIds,
  validateRelatedIds,
} from "./helpers";
import {
  disputeReasonCategoryValidator,
  disputeStatusValidator,
  disputeParentTypeValidator,
} from "./schema";

async function getDisputeOrThrow(ctx: MutationCtx, disputeId: Id<"disputes">) {
  const dispute = await ctx.db.get(disputeId);
  if (!dispute) {
    throw new NotFoundError("Dispute not found.");
  }
  return dispute;
}

async function changeDisputeStatusInternal(
  ctx: MutationCtx,
  args: {
    disputeId: Id<"disputes">;
    actorWallet: string;
    actorWalletType: TWalletType;
    status:
      | "open"
      | "under_review"
      | "awaiting_client_response"
      | "awaiting_freelancer_response"
      | "resolved_client"
      | "resolved_freelancer"
      | "split_resolution"
      | "cancelled";
    message?: string;
  },
) {
  const dispute = await getDisputeOrThrow(ctx, args.disputeId);
  const actorWallet = normalizeWalletAddress(args.actorWallet);
  const isParticipant =
    actorWallet === dispute.clientWallet || actorWallet === dispute.freelancerWallet;
  if (!isParticipant) {
    throw new ForbiddenError("Only authorized dispute participants can update this dispute.");
  }
  if (
    args.status === "resolved_client" ||
    args.status === "resolved_freelancer" ||
    args.status === "split_resolution"
  ) {
    throw new ForbiddenError("Resolution actions require moderator tools in a future phase.");
  }

  const oldStatus = dispute.status;
  const now = Date.now();
  await ctx.db.patch(dispute._id, {
    status: args.status,
    updatedAt: now,
    ...(args.status === "cancelled" ? { cancelledAt: now } : {}),
  });

  await createDisputeEvent(ctx, {
    disputeId: dispute._id,
    type: args.status === "cancelled" ? "cancelled" : "status_changed",
    actorWallet,
    actorWalletType: args.actorWalletType,
    actorRole: getDisputeRole(actorWallet, dispute),
    message:
      args.message !== undefined
        ? sanitizeDisputeMessage(args.message)
        : `Dispute status changed to ${args.status}.`,
    oldStatus,
    newStatus: args.status,
  });

  const updated = await getDisputeOrThrow(ctx, args.disputeId);
  await createDisputeNotification(ctx, {
    dispute: updated,
    recipientWallet: updated.clientWallet,
    type: "dispute_status_changed",
    title: "Dispute status changed",
    body: `Dispute status changed to ${args.status}.`,
  });
  await createDisputeNotification(ctx, {
    dispute: updated,
    recipientWallet: updated.freelancerWallet,
    type: "dispute_status_changed",
    title: "Dispute status changed",
    body: `Dispute status changed to ${args.status}.`,
  });
  await createDisputeSystemMessage(ctx, {
    dispute: updated,
    eventType: isActiveDisputeStatus(args.status) ? "dispute_status_changed" : "dispute_resolved",
    body: `Dispute status changed to ${args.status}.`,
  });

  return true;
}

function resolveOnChainMarkActorRole(args: {
  actorWallet: string;
  dispute: {
    clientWallet: string;
    freelancerWallet: string;
  };
}) {
  try {
    return getDisputeRole(args.actorWallet, args.dispute);
  } catch {
    if (isConfiguredAdminWallet(args.actorWallet)) {
      return "moderator" as const;
    }

    throw new ForbiddenError(
      "Only dispute participants or the configured admin wallet can update on-chain dispute state.",
    );
  }
}

export const createDispute = mutation({
  args: {
    parentType: disputeParentTypeValidator,
    parentId: v.string(),
    openedByWallet: v.string(),
    openedByWalletType: walletTypeValidator,
    reasonCategory: disputeReasonCategoryValidator,
    title: v.string(),
    description: v.string(),
    evidenceAttachmentIds: v.optional(v.array(v.id("attachments"))),
    relatedWorkSubmissionIds: v.optional(v.array(v.id("workSubmissions"))),
    relatedRevisionRequestIds: v.optional(v.array(v.id("revisionRequests"))),
    relatedMessageIds: v.optional(v.array(v.id("messages"))),
    relatedDeadlineEventIds: v.optional(v.array(v.id("deadlineAuditEvents"))),
    proofHash: v.optional(v.string()),
    escrowContractId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const title = sanitizeDisputeTitle(args.title);
    const description = sanitizeDisputeDescription(args.description);
    const evidenceAttachmentIds = args.evidenceAttachmentIds ?? [];
    const { parent, openedByWallet, openedByRole } = await assertCanOpenDispute(ctx, args);

    await validateDisputeAttachmentIds(ctx, {
      attachmentIds: evidenceAttachmentIds,
      walletAddress: openedByWallet,
    });

    const now = Date.now();
    const disputeId = await ctx.db.insert("disputes", {
      disputeNumber: buildDisputeNumber(now),
      parentType: parent.parentType,
      parentId: parent.parentId,
      ...(parent.jobId !== undefined ? { jobId: parent.jobId } : {}),
      ...(parent.microGigId !== undefined ? { microGigId: parent.microGigId } : {}),
      ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
      escrowId: parent.escrowId,
      onChainEscrowId: parent.onChainEscrowId,
      ...(optionalNonEmptyString(args.escrowContractId, "escrowContractId") !== undefined
        ? { escrowContractId: optionalNonEmptyString(args.escrowContractId, "escrowContractId") }
        : {}),
      clientWallet: parent.clientWallet,
      freelancerWallet: parent.freelancerWallet,
      openedByWallet,
      openedByWalletType: args.openedByWalletType,
      openedByRole,
      reasonCategory: args.reasonCategory,
      title,
      description,
      evidenceAttachmentIds,
      relatedWorkSubmissionIds: validateRelatedIds(
        args.relatedWorkSubmissionIds ?? [],
        "Proof references",
      ),
      relatedRevisionRequestIds: validateRelatedIds(
        args.relatedRevisionRequestIds ?? [],
        "Revision references",
      ),
      ...(args.relatedMessageIds !== undefined
        ? { relatedMessageIds: validateRelatedIds(args.relatedMessageIds, "Message references") }
        : {}),
      ...(args.relatedDeadlineEventIds !== undefined
        ? {
            relatedDeadlineEventIds: validateRelatedIds(
              args.relatedDeadlineEventIds,
              "Deadline references",
            ),
          }
        : {}),
      ...(sanitizeOptionalProofHash(args.proofHash) !== undefined
        ? { proofHash: sanitizeOptionalProofHash(args.proofHash) }
        : {}),
      status: "open",
      onChainStatus: "not_marked",
      openedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });

    await attachEvidenceToDispute(ctx, { attachmentIds: evidenceAttachmentIds, disputeId });

    await createDisputeEvent(ctx, {
      disputeId,
      type: "dispute_opened",
      actorWallet: openedByWallet,
      actorWalletType: args.openedByWalletType,
      actorRole: openedByRole,
      message: `${openedByRole === "client" ? "Client" : "Freelancer"} opened a platform-reviewed dispute: ${getDisputeReasonLabel(args.reasonCategory)}.`,
      attachmentIds: evidenceAttachmentIds,
      newStatus: "open",
      metadata: { description },
      createdAt: now,
    });

    const dispute = await getDisputeOrThrow(ctx, disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute,
      eventType: "dispute_opened",
      body: `Dispute opened: ${openedByRole === "client" ? "Client" : "Freelancer"} opened a dispute for this escrow.`,
    });

    const recipientWallet =
      openedByRole === "client" ? dispute.freelancerWallet : dispute.clientWallet;
    await createDisputeNotification(ctx, {
      dispute,
      recipientWallet,
      type: "dispute_opened",
      title: "Dispute opened",
      body: `${openedByRole === "client" ? "Client" : "Freelancer"} opened a platform-reviewed dispute.`,
    });

    return disputeId;
  },
});

export const markDisputeOnChainStarted = mutation({
  args: {
    disputeId: v.id("disputes"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    const actorRole = resolveOnChainMarkActorRole({
      actorWallet: args.actorWallet,
      dispute,
    });

    await ctx.db.patch(dispute._id, {
      onChainStatus: "marking",
      updatedAt: Date.now(),
    });
    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "on_chain_mark_started",
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole,
      message: "On-chain dispute marking started.",
    });
    return true;
  },
});

export const markDisputeOnChainSucceeded = mutation({
  args: {
    disputeId: v.id("disputes"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    transactionHash: v.string(),
    stellarExpertUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    const actorRole = resolveOnChainMarkActorRole({
      actorWallet: args.actorWallet,
      dispute,
    });
    const transactionHash = optionalNonEmptyString(args.transactionHash, "transactionHash");
    if (!transactionHash) {
      throw new BadRequestError("transactionHash is required.");
    }
    const now = Date.now();
    const stellarExpertUrl = args.stellarExpertUrl ?? getStellarExpertUrl(transactionHash);

    await ctx.db.patch(dispute._id, {
      onChainStatus: "marked",
      transactionHash,
      stellarExpertUrl,
      markedDisputedAt: now,
      updatedAt: now,
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "on_chain_mark_succeeded",
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole,
      message: "On-chain update: Escrow was marked as disputed.",
      transactionHash,
    });

    const updated = await getDisputeOrThrow(ctx, args.disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute: updated,
      eventType: "dispute_on_chain_marked",
      body: "On-chain update: Escrow was marked as disputed.",
      transactionHash,
    });
    await createDisputeNotification(ctx, {
      dispute: updated,
      recipientWallet: updated.clientWallet,
      type: "dispute_on_chain_marked",
      title: "Escrow marked disputed",
      body: "The escrow was marked as disputed on-chain.",
    });
    await createDisputeNotification(ctx, {
      dispute: updated,
      recipientWallet: updated.freelancerWallet,
      type: "dispute_on_chain_marked",
      title: "Escrow marked disputed",
      body: "The escrow was marked as disputed on-chain.",
    });

    return true;
  },
});

export const markDisputeOnChainFailed = mutation({
  args: {
    disputeId: v.id("disputes"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    errorMessage: v.string(),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    const actorRole = resolveOnChainMarkActorRole({
      actorWallet: args.actorWallet,
      dispute,
    });
    const transactionHash = optionalNonEmptyString(args.transactionHash, "transactionHash");
    await ctx.db.patch(dispute._id, {
      onChainStatus: "mark_failed",
      ...(transactionHash !== undefined ? { transactionHash } : {}),
      updatedAt: Date.now(),
      metadata: {
        ...(typeof dispute.metadata === "object" && dispute.metadata !== null
          ? dispute.metadata
          : {}),
        onChainMarkError: sanitizeDisputeMessage(args.errorMessage),
      },
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "on_chain_mark_failed",
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole,
      message:
        "Dispute evidence was saved, but on-chain escrow dispute marking failed. Retry required.",
      ...(transactionHash !== undefined ? { transactionHash } : {}),
      metadata: { errorMessage: sanitizeDisputeMessage(args.errorMessage) },
    });
    const updated = await getDisputeOrThrow(ctx, args.disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute: updated,
      eventType: "dispute_on_chain_mark_failed",
      body: "Dispute update: on-chain dispute marking failed. Retry required.",
      ...(transactionHash !== undefined ? { transactionHash } : {}),
    });
    await createDisputeNotification(ctx, {
      dispute: updated,
      recipientWallet: updated.openedByWallet,
      type: "dispute_on_chain_mark_failed",
      title: "On-chain dispute mark failed",
      body: "Dispute evidence was saved, but on-chain marking failed. Please retry.",
    });

    return true;
  },
});

export const addDisputeEvidence = mutation({
  args: {
    disputeId: v.id("disputes"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    attachmentIds: v.array(v.id("attachments")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    const actorRole = assertCanRespondToDispute(dispute, args.actorWallet);
    await validateDisputeAttachmentIds(ctx, {
      attachmentIds: args.attachmentIds,
      walletAddress: args.actorWallet,
      parentId: dispute._id,
    });
    await attachEvidenceToDispute(ctx, {
      attachmentIds: args.attachmentIds,
      disputeId: dispute._id,
    });

    const evidenceAttachmentIds = Array.from(
      new Set([...dispute.evidenceAttachmentIds, ...args.attachmentIds]),
    );
    await ctx.db.patch(dispute._id, {
      evidenceAttachmentIds,
      updatedAt: Date.now(),
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "evidence_added",
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole,
      message: args.message
        ? sanitizeDisputeMessage(args.message)
        : `${actorRole === "client" ? "Client" : "Freelancer"} added dispute evidence.`,
      attachmentIds: args.attachmentIds,
    });

    const recipientWallet =
      actorRole === "client" ? dispute.freelancerWallet : dispute.clientWallet;
    await createDisputeNotification(ctx, {
      dispute,
      recipientWallet,
      type: "dispute_evidence_added",
      title: "Dispute evidence added",
      body: `${actorRole === "client" ? "Client" : "Freelancer"} added dispute evidence.`,
    });
    await createDisputeSystemMessage(ctx, {
      dispute,
      eventType: "dispute_evidence_added",
      body: `Dispute update: ${actorRole === "client" ? "Client" : "Freelancer"} added evidence.`,
    });
    return true;
  },
});

export const addDisputeResponse = mutation({
  args: {
    disputeId: v.id("disputes"),
    responderWallet: v.string(),
    responderWalletType: walletTypeValidator,
    message: v.string(),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  handler: async (ctx, args) => {
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    const responderRole = assertCanRespondToDispute(dispute, args.responderWallet);
    const attachmentIds = args.attachmentIds ?? [];

    await validateDisputeAttachmentIds(ctx, {
      attachmentIds,
      walletAddress: args.responderWallet,
      parentId: dispute._id,
    });
    await attachEvidenceToDispute(ctx, { attachmentIds, disputeId: dispute._id });
    const evidenceAttachmentIds = Array.from(
      new Set([...dispute.evidenceAttachmentIds, ...attachmentIds]),
    );
    await ctx.db.patch(dispute._id, {
      evidenceAttachmentIds,
      updatedAt: Date.now(),
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: responderRole === "client" ? "client_response_added" : "freelancer_response_added",
      actorWallet: args.responderWallet,
      actorWalletType: args.responderWalletType,
      actorRole: responderRole,
      message: sanitizeDisputeMessage(args.message),
      attachmentIds,
    });

    const recipientWallet =
      responderRole === "client" ? dispute.freelancerWallet : dispute.clientWallet;
    await createDisputeNotification(ctx, {
      dispute,
      recipientWallet,
      type: "dispute_response_added",
      title: "Dispute response added",
      body: `${responderRole === "client" ? "Client" : "Freelancer"} responded to the dispute.`,
    });

    return true;
  },
});

export const changeDisputeStatus = mutation({
  args: {
    disputeId: v.id("disputes"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    status: disputeStatusValidator,
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await changeDisputeStatusInternal(ctx, args);
  },
});

export const cancelDispute = mutation({
  args: {
    disputeId: v.id("disputes"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await changeDisputeStatusInternal(ctx, {
      disputeId: args.disputeId,
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      status: "cancelled",
      ...(args.message !== undefined ? { message: args.message } : {}),
    });
  },
});

export const addModeratorNote = mutation({
  args: {
    disputeId: v.id("disputes"),
    moderatorWallet: v.string(),
    moderatorWalletType: walletTypeValidator,
    message: v.string(),
  },
  handler: async () => {
    throw new ForbiddenError("Manual review tools will be added in a future phase.");
  },
});

export const recordDisputeResolution = mutation({
  args: {
    disputeId: v.id("disputes"),
    moderatorWallet: v.string(),
    moderatorWalletType: walletTypeValidator,
    status: v.union(
      v.literal("resolved_client"),
      v.literal("resolved_freelancer"),
      v.literal("split_resolution"),
    ),
    message: v.string(),
  },
  handler: async () => {
    throw new ForbiddenError(
      "Resolution recorded in Highrable review workflow is not automated in this phase.",
    );
  },
});
