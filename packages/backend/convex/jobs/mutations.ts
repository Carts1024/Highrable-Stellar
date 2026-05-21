import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  computeDeadlineStatus,
  resolveDeadlineParent,
  upsertDeadlineReminders,
  validateDeadlineAt,
} from "../deadlines/helpers";
import { validateRevisionPolicy } from "../revisions/helpers";
import { ensureOnboardedUser } from "../users/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  getJobOrThrow,
  sanitizeClientWallet,
  sanitizeCreateJobArgs,
  sanitizeFreelancerWallet,
} from "./helpers";
import { containsDisallowedJobPostLanguage, DISALLOWED_JOB_POST_MESSAGE } from "./scamSignals";

export const createJob = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    budget: v.number(),
    asset: v.string(),
    clientWallet: v.string(),
    deadlineAt: v.number(),
    revisionPolicy: v.optional(
      v.union(v.literal("none"), v.literal("fixed"), v.literal("unlimited")),
    ),
    revisionLimit: v.optional(v.union(v.number(), v.null())),
    jobHash: v.optional(v.string()),
    walletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const sanitizedArgs = sanitizeCreateJobArgs(args);

    if (containsDisallowedJobPostLanguage(sanitizedArgs)) {
      throw new ForbiddenError(DISALLOWED_JOB_POST_MESSAGE);
    }

    // TODO: Replace walletAddress trust with signed wallet session/auth.
    await ensureOnboardedUser(ctx, sanitizedArgs.clientWallet, args.walletType);

    const deadlineAt = validateDeadlineAt(args.deadlineAt);
    const revisionConfig = validateRevisionPolicy({
      revisionPolicy: args.revisionPolicy,
      revisionLimit: args.revisionLimit,
    });
    const now = Date.now();
    // TODO: Convert jobHash into the on-chain 32-byte format before contract calls.
    const jobId = await ctx.db.insert("jobs", {
      ...sanitizedArgs,
      jobType: "micro_gig",
      totalBudget: sanitizedArgs.budget,
      milestoneCount: 0,
      status: "open",
      deadlineAt,
      deadlineStatus: computeDeadlineStatus({ deadlineAt, workStatus: "open", now }),
      revisionPolicy: revisionConfig.revisionPolicy,
      revisionLimit: revisionConfig.revisionLimit,
      revisionCount: 0,
      revisionStatus: "none",
      createdAt: now,
    });

    await ctx.db.insert("deadlineAuditEvents", {
      parentType: "micro_gig",
      parentId: jobId,
      newDeadlineAt: deadlineAt,
      changedByWallet: sanitizedArgs.clientWallet,
      ...(args.walletType !== undefined ? { changedByWalletType: args.walletType } : {}),
      reason: "initial_deadline",
      createdAt: now,
    });

    await upsertDeadlineReminders(
      ctx,
      await resolveDeadlineParent(ctx, { parentType: "micro_gig", parentId: jobId }),
    );

    return jobId;
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

    await upsertDeadlineReminders(
      ctx,
      await resolveDeadlineParent(ctx, { parentType: "micro_gig", parentId: args.jobId }),
    );

    const updatedJob = await ctx.db.get(args.jobId);
    if (!updatedJob) {
      throw new NotFoundError("Job not found after update.");
    }

    return updatedJob;
  },
});
