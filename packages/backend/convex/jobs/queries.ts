import { v } from "convex/values";

import { query } from "../_generated/server";
import { sanitizeClientWallet, sanitizeFreelancerWallet } from "./helpers";

const MARKETPLACE_JOB_STATUSES = [
  "open",
  "selected",
  "funded",
  "submitted",
  "revision_requested",
  "revision_submitted",
] as const;
const MARKETPLACE_STATUS_LIMIT = 75;

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

export const listMarketplaceJobs = query({
  args: {},
  handler: async (ctx) => {
    const jobsByStatus = await Promise.all(
      MARKETPLACE_JOB_STATUSES.map((status) =>
        ctx.db
          .query("jobs")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(MARKETPLACE_STATUS_LIMIT),
      ),
    );

    const jobs = jobsByStatus.flat();
    const rows = await Promise.all(
      jobs.map(async (job) => {
        const escrows = await ctx.db
          .query("escrows")
          .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
          .take(1);

        return {
          job,
          escrow: escrows[0] ?? null,
        };
      }),
    );

    return rows;
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
