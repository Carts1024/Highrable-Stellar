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

export const createEscrowRecord = mutation({
  args: {
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
    const clientWallet = sanitizeEscrowWallet(args.clientWallet);
    const freelancerWallet = sanitizeEscrowWallet(args.freelancerWallet);
    const amount = sanitizeEscrowAmount(args.amount);
    const asset = sanitizeEscrowAsset(args.asset);
    const createTxHash = sanitizeOptionalTxHash(args.createTxHash);

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
      status: "created",
      createdAt: now,
      updatedAt: now,
      ...(createTxHash !== undefined ? { createTxHash } : {}),
    });

    if (job.status === "open") {
      await ctx.db.patch(args.jobId, {
        selectedFreelancerWallet: freelancerWallet,
        status: "selected",
      });
    }

    return escrowRecordId;
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

    if (
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
