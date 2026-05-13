import { v } from "convex/values";

import { mutation } from "../_generated/server";
import {
  assertCanApplyToJob,
  assertCanApplyToMilestone,
  sanitizeApplicationWallet,
  sanitizeProposal,
} from "./helpers";

export const applyToJob = mutation({
  args: {
    jobId: v.id("jobs"),
    freelancerWallet: v.string(),
    proposal: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);
    const proposal = sanitizeProposal(args.proposal);

    await assertCanApplyToJob(ctx, args.jobId, freelancerWallet);

    return await ctx.db.insert("applications", {
      jobId: args.jobId,
      freelancerWallet,
      proposal,
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
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);
    const proposal = sanitizeProposal(args.proposal);

    await assertCanApplyToMilestone(ctx, args.jobId, args.milestoneId, freelancerWallet);

    return await ctx.db.insert("applications", {
      jobId: args.jobId,
      milestoneId: args.milestoneId,
      freelancerWallet,
      proposal,
      createdAt: Date.now(),
    });
  },
});
