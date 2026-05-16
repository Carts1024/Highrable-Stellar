import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { optionalNonEmptyString, requireNonEmptyString } from "../_shared/input";
import {
  sanitizeEscrowAmount,
  sanitizeEscrowAsset,
  sanitizeEscrowId,
  sanitizeOptionalTxHash,
} from "../escrows/helpers";
import { escrowStatusValidator, escrowTransactionTypeValidator } from "../escrows/schema";
import {
  containsDisallowedJobPostLanguage,
  DISALLOWED_JOB_POST_MESSAGE,
} from "../jobs/scamSignals";
import { ensureUserWithRole } from "../users/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  assertMilestoneAssignable,
  assertMilestoneProjectClient,
  deriveMilestoneApplicationGate,
  getPreviousMilestone,
  getMilestoneOrThrow,
  patchMilestoneForEscrowStatus,
  patchParentJobStatusForMilestoneProject,
  sanitizeMilestoneAmount,
  sanitizeMilestoneAsset,
  sanitizeMilestoneDescription,
  sanitizeMilestoneTitle,
  sanitizeMilestoneWallet,
} from "./helpers";

export const createMilestoneProject = mutation({
  args: {
    clientWallet: v.string(),
    title: v.string(),
    description: v.string(),
    asset: v.string(),
    walletType: v.optional(walletTypeValidator),
    milestones: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        amount: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const title = requireNonEmptyString(args.title, "title");
    const description = requireNonEmptyString(args.description, "description");
    const asset = sanitizeMilestoneAsset(args.asset);

    if (containsDisallowedJobPostLanguage({ title, description })) {
      throw new ForbiddenError(DISALLOWED_JOB_POST_MESSAGE);
    }

    if (args.milestones.length < 1) {
      throw new BadRequestError("At least one milestone is required.");
    }

    // TODO: Replace walletAddress trust with signed wallet session/auth.
    await ensureUserWithRole(ctx, clientWallet, "client", args.walletType);

    const sanitizedMilestones = args.milestones.map((milestone) => ({
      title: sanitizeMilestoneTitle(milestone.title),
      description: sanitizeMilestoneDescription(milestone.description),
      amount: sanitizeMilestoneAmount(milestone.amount),
    }));
    const totalBudget = sanitizedMilestones.reduce(
      (total, milestone) => total + milestone.amount,
      0,
    );

    if (totalBudget <= 0) {
      throw new BadRequestError("Total milestone budget must be greater than zero.");
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", {
      title,
      description,
      budget: totalBudget,
      asset,
      jobType: "milestone_project",
      totalBudget,
      milestoneCount: sanitizedMilestones.length,
      clientWallet,
      status: "open",
      jobHash: `project_${now}_${Math.random().toString(36).slice(2, 10)}`,
      createdAt: now,
    });

    for (const [index, milestone] of sanitizedMilestones.entries()) {
      await ctx.db.insert("milestones", {
        jobId,
        order: index + 1,
        title: milestone.title,
        ...(milestone.description !== undefined ? { description: milestone.description } : {}),
        amount: milestone.amount,
        asset,
        status: "open",
        applicationGateStatus: index === 0 ? "open" : "locked",
        createdAt: now,
        updatedAt: now,
      });
    }

    return jobId;
  },
});

export const addMilestoneToProject = mutation({
  args: {
    jobId: v.id("jobs"),
    clientWallet: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const job = await assertMilestoneProjectClient(ctx, { jobId: args.jobId, clientWallet });

    if (job.status === "completed" || job.status === "cancelled") {
      throw new ForbiddenError("Cannot add milestones to a completed or cancelled project.");
    }

    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_jobId_order", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .take(1);
    const now = Date.now();
    const nextOrder = (existing[0]?.order ?? 0) + 1;
    const amount = sanitizeMilestoneAmount(args.amount);

    const milestoneId = await ctx.db.insert("milestones", {
      jobId: args.jobId,
      order: nextOrder,
      title: sanitizeMilestoneTitle(args.title),
      ...(sanitizeMilestoneDescription(args.description) !== undefined
        ? { description: sanitizeMilestoneDescription(args.description) }
        : {}),
      amount,
      asset: job.asset,
      status: "open",
      applicationGateStatus: "locked",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.jobId, {
      budget: job.budget + amount,
      totalBudget: (job.totalBudget ?? job.budget) + amount,
      milestoneCount: (job.milestoneCount ?? existing.length) + 1,
    });

    return milestoneId;
  },
});

export const updateMilestone = mutation({
  args: {
    milestoneId: v.id("milestones"),
    clientWallet: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const milestone = await getMilestoneOrThrow(ctx, args.milestoneId);
    const job = await assertMilestoneProjectClient(ctx, {
      jobId: milestone.jobId,
      clientWallet,
    });

    if (milestone.status !== "open" && milestone.status !== "draft") {
      throw new ForbiddenError("Milestone can only be edited before escrow is created.");
    }

    const patch: {
      title?: string;
      description?: string;
      amount?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      patch.title = sanitizeMilestoneTitle(args.title);
    }

    if (args.description !== undefined) {
      patch.description = optionalNonEmptyString(args.description, "description");
    }

    if (args.amount !== undefined) {
      patch.amount = sanitizeMilestoneAmount(args.amount);
    }

    await ctx.db.patch(args.milestoneId, patch);

    if (patch.amount !== undefined) {
      const milestones = await ctx.db
        .query("milestones")
        .withIndex("by_jobId", (q) => q.eq("jobId", milestone.jobId))
        .take(500);
      const totalBudget = milestones.reduce(
        (total, row) => total + (row._id === args.milestoneId ? patch.amount! : row.amount),
        0,
      );
      await ctx.db.patch(job._id, { budget: totalBudget, totalBudget });
    }

    return await getMilestoneOrThrow(ctx, args.milestoneId);
  },
});

export const assignFreelancerToMilestone = mutation({
  args: {
    milestoneId: v.id("milestones"),
    clientWallet: v.string(),
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const freelancerWallet = sanitizeMilestoneWallet(args.freelancerWallet);
    const milestone = await getMilestoneOrThrow(ctx, args.milestoneId);
    const job = await assertMilestoneProjectClient(ctx, {
      jobId: milestone.jobId,
      clientWallet,
    });

    assertMilestoneAssignable(milestone.status);
    const applicationGate = await deriveMilestoneApplicationGate(ctx, milestone);
    if (!applicationGate.canApply) {
      throw new ForbiddenError(applicationGate.message);
    }

    if (job.clientWallet === freelancerWallet) {
      throw new ForbiddenError("Client cannot assign themselves to a milestone.");
    }

    await ctx.db.patch(args.milestoneId, {
      assignedFreelancerWallet: freelancerWallet,
      status: "assigned",
      applicationGateStatus: "closed",
      updatedAt: Date.now(),
    });

    await patchParentJobStatusForMilestoneProject(ctx, milestone.jobId);
    return await getMilestoneOrThrow(ctx, args.milestoneId);
  },
});

export const offerMilestoneContinuation = mutation({
  args: {
    milestoneId: v.id("milestones"),
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const milestone = await getMilestoneOrThrow(ctx, args.milestoneId);

    await assertMilestoneProjectClient(ctx, {
      jobId: milestone.jobId,
      clientWallet,
    });

    if (milestone.status !== "open") {
      throw new ForbiddenError("Continuation can only be offered for open milestones.");
    }

    if (milestone.applicationGateStatus === "continuation_pending") {
      throw new ConflictError("A continuation offer is already pending for this milestone.");
    }

    const applicationGate = await deriveMilestoneApplicationGate(ctx, milestone);
    if (applicationGate.reason !== "waiting_client_decision") {
      throw new ForbiddenError(applicationGate.message);
    }

    const previousMilestone = await getPreviousMilestone(ctx, milestone);
    if (!previousMilestone || previousMilestone.status !== "released") {
      throw new ForbiddenError("Previous milestone must be released before offering continuation.");
    }

    if (!previousMilestone.assignedFreelancerWallet) {
      throw new BadRequestError("Previous milestone has no assigned freelancer to retain.");
    }

    await ctx.db.patch(args.milestoneId, {
      applicationGateStatus: "continuation_pending",
      continuationOfferFreelancerWallet: previousMilestone.assignedFreelancerWallet,
      continuationOfferCreatedAt: Date.now(),
      continuationOfferRespondedAt: undefined,
      updatedAt: Date.now(),
    });

    return await getMilestoneOrThrow(ctx, args.milestoneId);
  },
});

export const openMilestoneForReplacement = mutation({
  args: {
    milestoneId: v.id("milestones"),
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const milestone = await getMilestoneOrThrow(ctx, args.milestoneId);

    await assertMilestoneProjectClient(ctx, {
      jobId: milestone.jobId,
      clientWallet,
    });

    if (milestone.status !== "open") {
      throw new ForbiddenError("Applications can only be opened for open milestones.");
    }

    const applicationGate = await deriveMilestoneApplicationGate(ctx, milestone);
    if (applicationGate.reason === "previous_milestone_unfinished") {
      throw new ForbiddenError(applicationGate.message);
    }

    if (applicationGate.reason === "continuation_offer_pending") {
      throw new ConflictError(
        "Wait for the pending continuation offer response before opening applications.",
      );
    }

    await ctx.db.patch(args.milestoneId, {
      applicationGateStatus: "open",
      continuationOfferFreelancerWallet: undefined,
      continuationOfferCreatedAt: undefined,
      continuationOfferRespondedAt: undefined,
      updatedAt: Date.now(),
    });

    return await getMilestoneOrThrow(ctx, args.milestoneId);
  },
});

export const respondToMilestoneContinuation = mutation({
  args: {
    milestoneId: v.id("milestones"),
    freelancerWallet: v.string(),
    response: v.union(v.literal("accepted"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeMilestoneWallet(args.freelancerWallet);
    const milestone = await getMilestoneOrThrow(ctx, args.milestoneId);

    if (milestone.status !== "open") {
      throw new ForbiddenError("Continuation offers can only be answered for open milestones.");
    }

    if (
      milestone.applicationGateStatus !== "continuation_pending" ||
      !milestone.continuationOfferFreelancerWallet
    ) {
      throw new ForbiddenError("No continuation offer is pending for this milestone.");
    }

    if (milestone.continuationOfferFreelancerWallet !== freelancerWallet) {
      throw new ForbiddenError("Only the offered freelancer can answer this continuation offer.");
    }

    const now = Date.now();

    if (args.response === "accepted") {
      await ctx.db.patch(args.milestoneId, {
        assignedFreelancerWallet: freelancerWallet,
        status: "assigned",
        applicationGateStatus: "closed",
        continuationOfferRespondedAt: now,
        updatedAt: now,
      });
      await patchParentJobStatusForMilestoneProject(ctx, milestone.jobId);
      return await getMilestoneOrThrow(ctx, args.milestoneId);
    }

    await ctx.db.patch(args.milestoneId, {
      applicationGateStatus: "continuation_rejected",
      continuationOfferRespondedAt: now,
      updatedAt: now,
    });

    return await getMilestoneOrThrow(ctx, args.milestoneId);
  },
});

export const assignFreelancerToMultipleMilestones = mutation({
  args: {
    jobId: v.id("jobs"),
    clientWallet: v.string(),
    freelancerWallet: v.string(),
    milestoneIds: v.array(v.id("milestones")),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const freelancerWallet = sanitizeMilestoneWallet(args.freelancerWallet);
    const job = await assertMilestoneProjectClient(ctx, { jobId: args.jobId, clientWallet });

    if (job.clientWallet === freelancerWallet) {
      throw new ForbiddenError("Client cannot assign themselves to milestones.");
    }

    if (args.milestoneIds.length === 0) {
      throw new BadRequestError("At least one milestone must be selected.");
    }

    const uniqueIds = new Set(args.milestoneIds);
    if (uniqueIds.size !== args.milestoneIds.length) {
      throw new BadRequestError("Milestone IDs must be unique.");
    }

    for (const milestoneId of args.milestoneIds) {
      const milestone = await getMilestoneOrThrow(ctx, milestoneId);
      if (milestone.jobId !== args.jobId) {
        throw new BadRequestError("All milestones must belong to the selected job.");
      }
      assertMilestoneAssignable(milestone.status);
      const applicationGate = await deriveMilestoneApplicationGate(ctx, milestone);
      if (!applicationGate.canApply) {
        throw new ForbiddenError(applicationGate.message);
      }
      await ctx.db.patch(milestoneId, {
        assignedFreelancerWallet: freelancerWallet,
        status: "assigned",
        applicationGateStatus: "closed",
        updatedAt: Date.now(),
      });
    }

    await patchParentJobStatusForMilestoneProject(ctx, args.jobId);
    return args.milestoneIds.length;
  },
});

export const createMilestoneEscrowRecord = mutation({
  args: {
    milestoneId: v.id("milestones"),
    jobId: v.id("jobs"),
    escrowId: v.string(),
    clientWallet: v.string(),
    freelancerWallet: v.string(),
    amount: v.number(),
    asset: v.string(),
    createTxHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const escrowId = sanitizeEscrowId(args.escrowId);
    const clientWallet = sanitizeMilestoneWallet(args.clientWallet);
    const freelancerWallet = sanitizeMilestoneWallet(args.freelancerWallet);
    const amount = sanitizeEscrowAmount(args.amount);
    const asset = sanitizeEscrowAsset(args.asset);
    const createTxHash = sanitizeOptionalTxHash(args.createTxHash);
    const milestone = await getMilestoneOrThrow(ctx, args.milestoneId);

    if (milestone.jobId !== args.jobId) {
      throw new BadRequestError("Milestone does not belong to the selected job.");
    }

    const job = await assertMilestoneProjectClient(ctx, { jobId: args.jobId, clientWallet });

    if (milestone.status !== "assigned") {
      throw new ForbiddenError("Milestone escrow can only be created after assignment.");
    }

    if (milestone.assignedFreelancerWallet !== freelancerWallet) {
      throw new ForbiddenError("freelancerWallet must match the assigned milestone freelancer.");
    }

    if (milestone.amount !== amount || milestone.asset !== asset || job.asset !== asset) {
      throw new BadRequestError("Escrow amount and asset must match the milestone.");
    }

    const existingEscrow = await ctx.db
      .query("escrows")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrowId))
      .unique();
    if (existingEscrow) {
      throw new ConflictError("Escrow with this escrowId already exists.");
    }

    const existingMilestoneEscrow = await ctx.db
      .query("escrows")
      .withIndex("by_milestoneId", (q) => q.eq("milestoneId", args.milestoneId))
      .unique();
    if (existingMilestoneEscrow) {
      throw new ConflictError("Escrow already exists for this milestone.");
    }

    const now = Date.now();
    const escrowRecordId = await ctx.db.insert("escrows", {
      jobId: args.jobId,
      milestoneId: args.milestoneId,
      escrowId,
      clientWallet,
      freelancerWallet,
      amount,
      asset,
      status: "created",
      createdAt: now,
      updatedAt: now,
      ...(createTxHash !== undefined ? { createTxHash } : {}),
    });

    await ctx.db.patch(args.milestoneId, {
      status: "escrow_created",
      escrowId,
      updatedAt: now,
      ...(createTxHash !== undefined ? { createTxHash } : {}),
    });
    await patchParentJobStatusForMilestoneProject(ctx, args.jobId);

    return escrowRecordId;
  },
});

export const updateMilestoneEscrowStatus = mutation({
  args: {
    milestoneId: v.id("milestones"),
    escrowId: v.string(),
    status: escrowStatusValidator,
    txHash: v.optional(v.string()),
    txType: v.optional(escrowTransactionTypeValidator),
  },
  handler: async (ctx, args) => {
    const escrowId = sanitizeEscrowId(args.escrowId);
    const txHash = sanitizeOptionalTxHash(args.txHash);

    if ((txHash && !args.txType) || (!txHash && args.txType)) {
      throw new BadRequestError("txHash and txType must both be provided together.");
    }

    const milestone = await getMilestoneOrThrow(ctx, args.milestoneId);
    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrowId))
      .unique();

    if (!escrow) {
      throw new NotFoundError("Escrow not found.");
    }

    if (escrow.milestoneId !== args.milestoneId || milestone.escrowId !== escrowId) {
      throw new BadRequestError("Escrow is not linked to this milestone.");
    }

    const escrowPatch: {
      status: typeof args.status;
      updatedAt: number;
      createTxHash?: string;
      fundTxHash?: string;
      assignTxHash?: string;
      submitTxHash?: string;
      releaseTxHash?: string;
      cancelTxHash?: string;
      disputeTxHash?: string;
    } = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (txHash && args.txType) {
      const txField =
        args.txType === "assign_freelancer"
          ? undefined
          : (
              {
                create_escrow: "createTxHash",
                fund_escrow: "fundTxHash",
                submit_work: "submitTxHash",
                release_payment: "releaseTxHash",
                cancel_escrow: "cancelTxHash",
                mark_disputed: "disputeTxHash",
              } as const
            )[args.txType];
      if (txField) {
        escrowPatch[txField] = txHash;
      }
    }

    await ctx.db.patch(escrow._id, escrowPatch);
    await patchMilestoneForEscrowStatus(ctx, {
      milestoneId: args.milestoneId,
      escrowId,
      status: args.status,
      ...(txHash !== undefined ? { txHash } : {}),
      ...(args.txType !== undefined ? { txType: args.txType } : {}),
    });

    return await ctx.db.get(escrow._id);
  },
});
