import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { ConflictError, NotFoundError } from "./_shared/errors";
import {
  getJobReportCountForJob,
  sanitizeReporterWallet,
  sanitizeReportDetails,
  sanitizeReportReason,
} from "./reports/helpers";
import { jobReportReasonValidator } from "./reports/schema";

export const reportJob = mutation({
  args: {
    jobId: v.id("jobs"),
    reporterWallet: v.optional(v.string()),
    reason: jobReportReasonValidator,
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new NotFoundError("Job not found.");
    }

    // TODO: Replace walletAddress trust with signed wallet auth.
    const reporterWallet = sanitizeReporterWallet(args.reporterWallet);
    const reason = sanitizeReportReason(args.reason);
    const details = sanitizeReportDetails(args.details);

    if (reporterWallet !== undefined) {
      const existingReport = await ctx.db
        .query("jobReports")
        .withIndex("by_jobId_and_reporterWallet", (q) =>
          q.eq("jobId", args.jobId).eq("reporterWallet", reporterWallet),
        )
        .unique();

      if (existingReport) {
        throw new ConflictError("You already reported this job.");
      }
    }

    return await ctx.db.insert("jobReports", {
      jobId: args.jobId,
      ...(reporterWallet !== undefined ? { reporterWallet } : {}),
      reason,
      ...(details !== undefined ? { details } : {}),
      createdAt: Date.now(),
    });
  },
});

export const getJobReportCount = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await getJobReportCountForJob(ctx, args.jobId);
  },
});

export const listReportsByJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobReports")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(100);
  },
});
