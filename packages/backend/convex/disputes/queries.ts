import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { assertCanViewAttachment } from "../attachments/helpers";
import {
  assertCanOpenDispute,
  assertCanRespondToDispute,
  assertCanViewDispute,
  getActiveDisputeForEscrowId,
  isActiveDisputeStatus,
  resolveDisputeParticipants,
  withDisputeAttachments,
} from "./helpers";
import { disputeParentTypeValidator } from "./schema";

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
      await assertCanViewAttachment(ctx, attachment, viewerWallet);
      attachments.push({
        ...attachment,
        url: attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null,
      });
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
        return null;
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
    const dispute = await getActiveDisputeForEscrowId(ctx, args.escrowId);
    if (!dispute) return null;
    return await withDisputeAttachments(ctx, dispute, args.viewerWallet);
  },
});

export const getDisputesForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
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
      byId.set(dispute._id, dispute);
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
    assertCanViewDispute(dispute, args.viewerWallet);

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
      const role = assertCanViewDispute(dispute, args.viewerWallet);
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
      const role = assertCanRespondToDispute(dispute, args.walletAddress);
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
    const parent = await resolveDisputeParticipants(ctx, args);
    if (args.viewerWallet) {
      const viewer = normalizeWalletAddress(args.viewerWallet);
      if (viewer !== parent.clientWallet && viewer !== parent.freelancerWallet) {
        return null;
      }
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

    return { parent, submissions, revisions, deadlineEvents };
  },
});
