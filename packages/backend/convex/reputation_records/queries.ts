import { v } from "convex/values";

import { query } from "../_generated/server";
import { normalizeWalletAddress, requireNonEmptyString } from "../_shared/input";

export const listReputationByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);

    return await ctx.db
      .query("reputationRecords")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .order("desc")
      .take(100);
  },
});

export const getReputationByEscrowId = query({
  args: {
    escrowId: v.string(),
  },
  handler: async (ctx, args) => {
    const escrowId = requireNonEmptyString(args.escrowId, "escrowId");

    return await ctx.db
      .query("reputationRecords")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrowId))
      .unique();
  },
});

export const getVerifiedReviewForJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const [job, escrow] = await Promise.all([
      ctx.db.get(args.jobId),
      ctx.db
        .query("escrows")
        .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
        .take(1)
        .then((rows) => rows[0] ?? null),
    ]);

    if (!job || !escrow) {
      return null;
    }

    if (escrow.milestoneId !== undefined) {
      return null;
    }

    const reputationRecord = await ctx.db
      .query("reputationRecords")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow.escrowId))
      .unique();

    return {
      job,
      escrow,
      reputationRecord,
    };
  },
});

export const getVerifiedReviewForMilestone = query({
  args: {
    milestoneId: v.id("milestones"),
  },
  handler: async (ctx, args) => {
    const milestone = await ctx.db.get(args.milestoneId);

    if (!milestone?.escrowId) {
      return null;
    }

    const [job, escrow] = await Promise.all([
      ctx.db.get(milestone.jobId),
      ctx.db
        .query("escrows")
        .withIndex("by_escrowId", (q) => q.eq("escrowId", milestone.escrowId!))
        .unique(),
    ]);

    if (!job || !escrow) {
      return null;
    }

    const reputationRecord = await ctx.db
      .query("reputationRecords")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow.escrowId))
      .unique();

    return {
      job,
      milestone,
      escrow,
      reputationRecord,
    };
  },
});
