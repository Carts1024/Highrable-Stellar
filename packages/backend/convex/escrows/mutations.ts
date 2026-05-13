import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, NotFoundError } from "../_shared/errors";
import {
  assertEscrowCreationAllowed,
  getEscrowByEscrowIdOrThrow,
  getEscrowTxFieldByType,
  getJobStatusFromEscrowStatus,
  sanitizeEscrowAmount,
  sanitizeEscrowAsset,
  sanitizeEscrowId,
  sanitizeEscrowWallet,
  sanitizeOptionalTxHash,
} from "./helpers";
import { escrowStatusValidator, escrowTransactionTypeValidator } from "./schema";
import { patchMilestoneForEscrowStatus } from "../milestones/helpers";

export const createEscrowRecord = mutation({
  args: {
    jobId: v.id("jobs"),
    escrowId: v.string(),
    clientWallet: v.string(),
    freelancerWallet: v.optional(v.string()),
    amount: v.number(),
    asset: v.string(),
    status: v.optional(escrowStatusValidator),
    createTxHash: v.optional(v.string()),
    fundTxHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const escrowId = sanitizeEscrowId(args.escrowId);
    const clientWallet = sanitizeEscrowWallet(args.clientWallet);
    const freelancerWallet =
      args.freelancerWallet !== undefined ? sanitizeEscrowWallet(args.freelancerWallet) : undefined;
    const amount = sanitizeEscrowAmount(args.amount);
    const asset = sanitizeEscrowAsset(args.asset);
    const status = args.status ?? "created";
    const createTxHash = sanitizeOptionalTxHash(args.createTxHash);
    const fundTxHash = sanitizeOptionalTxHash(args.fundTxHash);

    if (status !== "created" && status !== "funded") {
      throw new BadRequestError("New escrow records must start in created or funded status.");
    }

    if (status === "funded" && !fundTxHash) {
      throw new BadRequestError("fundTxHash is required for pre-funded escrow records.");
    }

    const job = await assertEscrowCreationAllowed(ctx, {
      jobId: args.jobId,
      escrowId,
      clientWallet,
      freelancerWallet,
    });

    const now = Date.now();
    const escrowRecordId = await ctx.db.insert("escrows", {
      jobId: args.jobId,
      escrowId,
      clientWallet,
      freelancerWallet,
      amount,
      asset,
      status,
      createdAt: now,
      updatedAt: now,
      ...(createTxHash !== undefined ? { createTxHash } : {}),
      ...(fundTxHash !== undefined ? { fundTxHash } : {}),
    });

    if (status === "funded") {
      await ctx.db.patch(args.jobId, {
        status: "funded",
        ...(freelancerWallet !== undefined ? { selectedFreelancerWallet: freelancerWallet } : {}),
      });
    } else if (job.status === "open" && freelancerWallet !== undefined) {
      await ctx.db.patch(args.jobId, {
        selectedFreelancerWallet: freelancerWallet,
        status: "selected",
      });
    }

    return escrowRecordId;
  },
});

export const assignFreelancerToEscrow = mutation({
  args: {
    jobId: v.id("jobs"),
    clientWallet: v.string(),
    freelancerWallet: v.string(),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeEscrowWallet(args.clientWallet);
    const freelancerWallet = sanitizeEscrowWallet(args.freelancerWallet);
    const txHash = sanitizeOptionalTxHash(args.txHash);

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new NotFoundError("Job not found.");
    }

    if (job.clientWallet !== clientWallet) {
      throw new BadRequestError("clientWallet must match the job client.");
    }

    const escrows = await ctx.db
      .query("escrows")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .take(1);
    const escrow = escrows[0];

    if (!escrow) {
      throw new NotFoundError("Escrow not found for job.");
    }

    if (escrow.clientWallet !== clientWallet) {
      throw new BadRequestError("clientWallet must match the escrow client.");
    }

    if (escrow.freelancerWallet !== undefined) {
      throw new BadRequestError("Escrow already has an assigned freelancer.");
    }

    await ctx.db.patch(escrow._id, {
      freelancerWallet,
      updatedAt: Date.now(),
      ...(txHash !== undefined ? { assignTxHash: txHash } : {}),
    });

    await ctx.db.patch(args.jobId, {
      selectedFreelancerWallet: freelancerWallet,
      status: escrow.status === "funded" ? "funded" : "selected",
    });

    return await getEscrowByEscrowIdOrThrow(ctx, escrow.escrowId);
  },
});

export const updateEscrowStatus = mutation({
  args: {
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

    const escrow = await getEscrowByEscrowIdOrThrow(ctx, escrowId);
    const escrowPatch: {
      status: (typeof args)["status"];
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
      const txField = getEscrowTxFieldByType(args.txType);
      escrowPatch[txField] = txHash;
    }

    await ctx.db.patch(escrow._id, escrowPatch);

    if (escrow.milestoneId !== undefined) {
      await patchMilestoneForEscrowStatus(ctx, {
        milestoneId: escrow.milestoneId,
        escrowId,
        status: args.status,
        ...(txHash !== undefined ? { txHash } : {}),
        ...(args.txType !== undefined ? { txType: args.txType } : {}),
      });
    } else if (
      args.status === "funded" ||
      args.status === "submitted" ||
      args.status === "released" ||
      args.status === "cancelled" ||
      args.status === "disputed"
    ) {
      await ctx.db.patch(escrow.jobId, {
        status: getJobStatusFromEscrowStatus(args.status),
      });
    }

    const updatedEscrow = await getEscrowByEscrowIdOrThrow(ctx, escrowId);
    if (!updatedEscrow) {
      throw new NotFoundError("Escrow not found after update.");
    }

    return updatedEscrow;
  },
});
