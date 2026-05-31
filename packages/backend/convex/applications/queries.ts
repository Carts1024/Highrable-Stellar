import { v } from "convex/values";

import { query } from "../_generated/server";
import { sanitizeApplicationWallet } from "./helpers";

const SHOWCASEABLE_WORK_LIMIT = 100;

export const listApplicationsByJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(100);
  },
});

export const listApplicationsByMilestone = query({
  args: {
    milestoneId: v.id("milestones"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", args.milestoneId))
      .order("desc")
      .take(100);
  },
});

export const listApplicationsByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);

    return await ctx.db
      .query("applications")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .order("desc")
      .take(100);
  },
});

export const listAppliedJobIdsByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);
    const applications = await ctx.db
      .query("applications")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .order("desc")
      .take(1000);

    return applications
      .filter((application) => application.milestoneId === undefined)
      .map((application) => application.jobId);
  },
});

export const hasAppliedToJob = query({
  args: {
    jobId: v.id("jobs"),
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);
    const application = await ctx.db
      .query("applications")
      .withIndex("by_jobId_and_freelancerWallet", (q) =>
        q.eq("jobId", args.jobId).eq("freelancerWallet", freelancerWallet),
      )
      .first();

    return application !== null && application.milestoneId === undefined;
  },
});

export const listShowcaseableCompletedWorksByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeApplicationWallet(args.freelancerWallet);
    const escrows = await ctx.db
      .query("escrows")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .order("desc")
      .take(500);

    const releasedEscrows = escrows
      .filter((escrow) => escrow.status === "released")
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, SHOWCASEABLE_WORK_LIMIT);

    return await Promise.all(
      releasedEscrows.map(async (escrow) => {
        const [job, milestone] = await Promise.all([
          ctx.db.get(escrow.jobId),
          escrow.milestoneId ? ctx.db.get(escrow.milestoneId) : Promise.resolve(null),
        ]);

        return {
          escrowId: escrow.escrowId,
          jobTitle: job?.title ?? "Untitled Job",
          ...(milestone?.title ? { milestoneTitle: milestone.title } : {}),
          amount: escrow.amount,
          asset: escrow.asset,
          workType: escrow.milestoneId ? ("milestone" as const) : ("micro_gig" as const),
          updatedAt: escrow.updatedAt,
        };
      }),
    );
  },
});
