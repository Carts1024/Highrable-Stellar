import { v } from "convex/values";

import { query } from "../_generated/server";
import { sanitizeClientWallet, sanitizeFreelancerWallet } from "./helpers";

export const getJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const listOpenJobs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(100);
  },
});

export const listJobsByClient = query({
  args: {
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeClientWallet(args.clientWallet);

    return await ctx.db
      .query("jobs")
      .withIndex("by_clientWallet", (q) => q.eq("clientWallet", clientWallet))
      .order("desc")
      .take(100);
  },
});

export const listJobsByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeFreelancerWallet(args.freelancerWallet);

    return await ctx.db
      .query("jobs")
      .withIndex("by_selectedFreelancerWallet", (q) =>
        q.eq("selectedFreelancerWallet", freelancerWallet),
      )
      .order("desc")
      .take(100);
  },
});
