import { v } from "convex/values";

import type { TMilestoneStatus } from "./schema";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { getMilestoneOrThrow } from "./helpers";

type TMilestoneCountsByStatus = Record<TMilestoneStatus, number>;

function createEmptyCounts(): TMilestoneCountsByStatus {
  return {
    draft: 0,
    open: 0,
    assigned: 0,
    escrow_created: 0,
    funded: 0,
    submitted: 0,
    released: 0,
    cancelled: 0,
    disputed: 0,
  };
}

export const listMilestonesByJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("milestones")
      .withIndex("by_jobId_order", (q) => q.eq("jobId", args.jobId))
      .order("asc")
      .take(500);
  },
});

export const getMilestone = query({
  args: {
    milestoneId: v.id("milestones"),
  },
  handler: async (ctx, args) => {
    return await getMilestoneOrThrow(ctx, args.milestoneId);
  },
});

export const listMilestonesByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);

    return await ctx.db
      .query("milestones")
      .withIndex("by_assignedFreelancerWallet", (q) =>
        q.eq("assignedFreelancerWallet", freelancerWallet),
      )
      .order("desc")
      .take(100);
  },
});

export const getMilestoneProjectSummary = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const [job, milestones] = await Promise.all([
      ctx.db.get(args.jobId),
      ctx.db
        .query("milestones")
        .withIndex("by_jobId_order", (q) => q.eq("jobId", args.jobId))
        .order("asc")
        .take(500),
    ]);

    const milestoneCountsByStatus = createEmptyCounts();
    let totalBudget = 0;
    let totalReleased = 0;

    for (const milestone of milestones) {
      totalBudget += milestone.amount;
      milestoneCountsByStatus[milestone.status] += 1;
      if (milestone.status === "released") {
        totalReleased += milestone.amount;
      }
    }

    return {
      job,
      milestones,
      totalBudget,
      totalReleased,
      totalPending: totalBudget - totalReleased,
      milestoneCountsByStatus,
    };
  },
});
