import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { ForbiddenError, NotFoundError } from "../_shared/errors";
import { ensureUserWithRole } from "../users/helpers";
import {
  getJobOrThrow,
  sanitizeClientWallet,
  sanitizeCreateJobArgs,
  sanitizeFreelancerWallet,
} from "./helpers";

export const createJob = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    budget: v.number(),
    asset: v.string(),
    clientWallet: v.string(),
    jobHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sanitizedArgs = sanitizeCreateJobArgs(args);

    await ensureUserWithRole(ctx, sanitizedArgs.clientWallet, "client");

    // TODO: Convert jobHash into the on-chain 32-byte format before contract calls.
    return await ctx.db.insert("jobs", {
      ...sanitizedArgs,
      status: "open",
      createdAt: Date.now(),
    });
  },
});

export const selectFreelancer = mutation({
  args: {
    jobId: v.id("jobs"),
    clientWallet: v.string(),
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeClientWallet(args.clientWallet);
    const freelancerWallet = sanitizeFreelancerWallet(args.freelancerWallet);
    const job = await getJobOrThrow(ctx, args.jobId);

    // TODO: Replace walletAddress trust with signed wallet session/auth.
    if (job.clientWallet !== clientWallet) {
      throw new ForbiddenError("Only the job client can select a freelancer.");
    }

    if (job.status !== "open") {
      throw new ForbiddenError("Freelancer can only be selected for open jobs.");
    }

    await ctx.db.patch(args.jobId, {
      selectedFreelancerWallet: freelancerWallet,
      status: "selected",
    });

    const updatedJob = await ctx.db.get(args.jobId);
    if (!updatedJob) {
      throw new NotFoundError("Job not found after update.");
    }

    return updatedJob;
  },
});
