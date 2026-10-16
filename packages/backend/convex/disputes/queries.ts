import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { assertCanViewAttachment, serializeAttachmentForViewer } from "../attachments/helpers";
import {
  assertCanOpenDispute,
  assertCanRespondToDispute,
  assertCanViewDispute,
  assertCurrentDisputeAccess,
  getActiveDisputeForEscrowId,
  isActiveDisputeStatus,
  validateDisputeDeadlineEventIds,
  validateDisputeRevisionRequestIds,
  validateDisputeWorkSubmissionIds,
  resolveDisputeParticipants,
} from "./helpers";
import { disputeParentTypeValidator } from "./schema";

function hasViewerWallet(viewerWallet?: string): viewerWallet is string {
  return viewerWallet !== undefined && viewerWallet.trim().length > 0;
}

async function withDisputeAttachments(
  ctx: QueryCtx,
  dispute: Doc<"disputes">,
  viewerWallet?: string,
) {
  await assertCanViewDispute(ctx, dispute, viewerWallet);
  const attachments = [];

  for (const attachmentId of dispute.evidenceAttachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) continue;
    try {
      await assertCanViewAttachment(ctx, attachment, viewerWallet, dispute._id);
      attachments.push(await serializeAttachmentForViewer(ctx, attachment, viewerWallet));
    } catch {
      // Hide inaccessible evidence.
    }
  }

  return { ...dispute, attachments };
}

async function withEventAttachments(
  ctx: QueryCtx,
  event: Doc<"disputeEvents">,
  viewerWallet?: string,
) {
  const attachments = [];
  for (const attachmentId of event.attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) continue;
    try {
      await assertCanViewAttachment(ctx, attachment, viewerWallet, event.disputeId);
      attachments.push(await serializeAttachmentForViewer(ctx, attachment, viewerWallet));
    } catch {
      // Hide inaccessible event evidence.
    }
  }
  return { ...event, attachments };
}

export const getDispute = query({
  args: {
    disputeId: v.id("disputes"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!hasViewerWallet(args.viewerWallet)) return null;
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) return null;
    return await withDisputeAttachments(ctx, dispute, args.viewerWallet);
  },
});

export const getDisputeByParent = query({
  args: {
    parentType: disputeParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!hasViewerWallet(args.viewerWallet)) return null;
    const disputes = await ctx.db
      .query("disputes")
      .withIndex("by_parent_status", (q) =>
        q.eq("parentType", args.parentType).eq("parentId", args.parentId),
      )
      .order("desc")
      .take(20);

    for (const dispute of disputes) {
      if (!isActiveDisputeStatus(dispute.status)) continue;
      try {
        return await withDisputeAttachments(ctx, dispute, args.viewerWallet);
      } catch {
        continue;
      }
    }

    return null;
  },
});

export const getActiveDisputeForEscrow = query({
  args: {
    escrowId: v.id("escrows"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!hasViewerWallet(args.viewerWallet)) return null;
    const dispute = await getActiveDisputeForEscrowId(ctx, args.escrowId);
    if (!dispute) return null;
    try {
      return await withDisputeAttachments(ctx, dispute, args.viewerWallet);
    } catch {
      return null;
    }
  },
});

export const getDisputesForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.walletAddress.trim().length === 0) return [];
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [clientDisputes, freelancerDisputes] = await Promise.all([
      ctx.db
        .query("disputes")
        .withIndex("by_client", (q) => q.eq("clientWallet", walletAddress))
        .order("desc")
        .take(50),
      ctx.db
        .query("disputes")
        .withIndex("by_freelancer", (q) => q.eq("freelancerWallet", walletAddress))
        .order("desc")
        .take(50),
    ]);

    const byId = new Map<string, Doc<"disputes">>();
    for (const dispute of [...clientDisputes, ...freelancerDisputes]) {
      try {
        await assertCurrentDisputeAccess(ctx, dispute, walletAddress);
        byId.set(dispute._id, dispute);
      } catch {
        // Omit disputes whose saved participants or parent graph is stale.
      }
    }

    return Array.from(byId.values()).sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const getDisputeTimeline = query({
  args: {
    disputeId: v.id("disputes"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) return [];
    await assertCanViewDispute(ctx, dispute, args.viewerWallet);

    const events = await ctx.db
      .query("disputeEvents")
      .withIndex("by_dispute", (q) => q.eq("disputeId", args.disputeId))
      .order("asc")
      .take(200);

    return await Promise.all(
      events.map((event) => withEventAttachments(ctx, event, args.viewerWallet)),
    );
  },
});

export const getDisputeEvidence = query({
  args: {
    disputeId: v.id("disputes"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) return [];
    return (await withDisputeAttachments(ctx, dispute, args.viewerWallet)).attachments;
  },
});

export const canOpenDispute = query({
  args: {
    parentType: disputeParentTypeValidator,
    parentId: v.string(),
    openedByWallet: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const result = await assertCanOpenDispute(ctx, args);
      return {
        allowed: true,
        reason: null,
        openedByRole: result.openedByRole,
        escrowId: result.parent.escrowId,
        onChainEscrowId: result.parent.onChainEscrowId,
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Dispute cannot be opened.",
        openedByRole: null,
        escrowId: null,
        onChainEscrowId: null,
      };
    }
  },
});

export const canViewDispute = query({
  args: {
    disputeId: v.id("disputes"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) return { allowed: false, reason: "Dispute not found." };
    try {
      const role = await assertCanViewDispute(ctx, dispute, args.viewerWallet);
      return { allowed: true, reason: null, role };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "You cannot view this dispute.",
        role: null,
      };
    }
  },
});

export const canRespondToDispute = query({
  args: {
    disputeId: v.id("disputes"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) return { allowed: false, reason: "Dispute not found.", role: null };
    try {
      const role = await assertCanRespondToDispute(ctx, dispute, args.walletAddress);
      return { allowed: true, reason: null, role };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "You cannot respond to this dispute.",
        role: null,
      };
    }
  },
});

export const getDisputeContextByParent = query({
  args: {
    parentType: disputeParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!hasViewerWallet(args.viewerWallet)) return null;
    const parent = await resolveDisputeParticipants(ctx, args);
    const viewer = normalizeWalletAddress(args.viewerWallet);
    if (viewer !== parent.clientWallet && viewer !== parent.freelancerWallet) {
      return null;
    }

    const [submissions, revisions, deadlineEvents] = await Promise.all([
      ctx.db
        .query("workSubmissions")
        .withIndex("by_convex_escrow", (q) => q.eq("escrowId", parent.escrowId))
        .take(50),
      ctx.db
        .query("revisionRequests")
        .withIndex("by_escrow", (q) => q.eq("escrowId", parent.escrowId))
        .take(50),
      ctx.db
        .query("deadlineAuditEvents")
        .withIndex("by_parent", (q) =>
          q
            .eq("parentType", parent.milestoneId ? "milestone" : "micro_gig")
            .eq("parentId", parent.milestoneId ?? parent.jobId ?? parent.parentId),
        )
        .take(50),
    ]);

    const validSubmissions = [];
    for (const submission of submissions) {
      try {
        await validateDisputeWorkSubmissionIds(ctx, {
          submissionIds: [submission._id],
          parent,
        });
        validSubmissions.push(submission);
      } catch {
        // Omit stale or contradictory protected context.
      }
    }

    const validRevisions = [];
    for (const revision of revisions) {
      try {
        await validateDisputeRevisionRequestIds(ctx, {
          revisionRequestIds: [revision._id],
          parent,
        });
        validRevisions.push(revision);
      } catch {
        // Omit stale or contradictory protected context.
      }
    }

    const validDeadlineEvents = [];
    for (const deadlineEvent of deadlineEvents) {
      try {
        await validateDisputeDeadlineEventIds(ctx, {
          deadlineEventIds: [deadlineEvent._id],
          parent,
        });
        validDeadlineEvents.push(deadlineEvent);
      } catch {
        // Omit stale or contradictory protected context.
      }
    }

    return {
      parent,
      submissions: validSubmissions,
      revisions: validRevisions,
      deadlineEvents: validDeadlineEvents,
    };
  },
});
