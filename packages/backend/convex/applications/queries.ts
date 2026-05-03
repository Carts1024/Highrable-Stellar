import { v } from "convex/values";

import { query } from "../_generated/server";
import { sanitizeApplicationWallet } from "./helpers";

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
