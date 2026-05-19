import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { ensureUserWithRole } from "../users/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanApplyToJob,
  assertCanApplyToMilestone,
  sanitizeApplicationWallet,
  sanitizeProposal,
  sanitizeShowcasedWorkEscrowId,
  validateShowcasedWorkEscrowId,
} from "./helpers";

export const applyToJob = mutation({
  args: {
    jobId: v.id("jobs"),
    freelancerWallet: v.string(),
    proposal: v.string(),
    showcasedWorkEscrowId: v.optional(v.string()),
    walletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);
    const proposal = sanitizeProposal(args.proposal);

    await assertCanApplyToJob(ctx, args.jobId, freelancerWallet);
    const showcasedWorkEscrowId = await validateShowcasedWorkEscrowId(
      ctx,
      freelancerWallet,
      sanitizeShowcasedWorkEscrowId(args.showcasedWorkEscrowId),
    );

    // TODO: Replace walletAddress trust with signed wallet session/auth.
    await ensureUserWithRole(ctx, freelancerWallet, "freelancer", args.walletType);

    return await ctx.db.insert("applications", {
      jobId: args.jobId,
      freelancerWallet,
      proposal,
      ...(showcasedWorkEscrowId !== undefined ? { showcasedWorkEscrowId } : {}),
      createdAt: Date.now(),
    });
  },
});

export const applyToMilestone = mutation({
  args: {
    jobId: v.id("jobs"),
    milestoneId: v.id("milestones"),
    freelancerWallet: v.string(),
    proposal: v.string(),
    showcasedWorkEscrowId: v.optional(v.string()),
    walletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);
    const proposal = sanitizeProposal(args.proposal);

    await assertCanApplyToMilestone(ctx, args.jobId, args.milestoneId, freelancerWallet);
    const showcasedWorkEscrowId = await validateShowcasedWorkEscrowId(
      ctx,
      freelancerWallet,
      sanitizeShowcasedWorkEscrowId(args.showcasedWorkEscrowId),
    );

    // TODO: Replace walletAddress trust with signed wallet session/auth.
    await ensureUserWithRole(ctx, freelancerWallet, "freelancer", args.walletType);

    return await ctx.db.insert("applications", {
      jobId: args.jobId,
      milestoneId: args.milestoneId,
      freelancerWallet,
      proposal,
      ...(showcasedWorkEscrowId !== undefined ? { showcasedWorkEscrowId } : {}),
      createdAt: Date.now(),
    });
  },
});
