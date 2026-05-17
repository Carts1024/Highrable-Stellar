import { v } from "convex/values";

import { mutation } from "../_generated/server";
import {
  assertTransactionLookupKey,
  getTransactionByLookup,
  sanitizeOptionalTransactionRef,
  sanitizeTransactionWallet,
} from "./helpers";
import {
  transactionStatusValidator,
  transactionTypeValidator,
  walletTypeValidator,
} from "./schema";

export const createTransaction = mutation({
  args: {
    walletAddress: v.string(),
    walletType: v.optional(walletTypeValidator),
    type: transactionTypeValidator,
    txHash: v.optional(v.string()),
    clientRequestId: v.optional(v.string()),
    escrowId: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    milestoneId: v.optional(v.id("milestones")),
    status: transactionStatusValidator,
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeTransactionWallet(args.walletAddress);
    const txHash = sanitizeOptionalTransactionRef(args.txHash, "txHash");
    const clientRequestId = sanitizeOptionalTransactionRef(args.clientRequestId, "clientRequestId");
    const escrowId = sanitizeOptionalTransactionRef(args.escrowId, "escrowId");
    const errorMessage = sanitizeOptionalTransactionRef(args.errorMessage, "errorMessage");

    assertTransactionLookupKey(txHash, clientRequestId);

    const now = Date.now();
    return await ctx.db.insert("transactions", {
      walletAddress,
      ...(args.walletType !== undefined ? { walletType: args.walletType } : {}),
      type: args.type,
      status: args.status,
      createdAt: now,
      updatedAt: now,
      ...(txHash !== undefined ? { txHash } : {}),
      ...(clientRequestId !== undefined ? { clientRequestId } : {}),
      ...(escrowId !== undefined ? { escrowId } : {}),
      ...(args.jobId !== undefined ? { jobId: args.jobId } : {}),
      ...(args.milestoneId !== undefined ? { milestoneId: args.milestoneId } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });
  },
});

export const updateTransactionStatus = mutation({
  args: {
    txHash: v.optional(v.string()),
    clientRequestId: v.optional(v.string()),
    status: transactionStatusValidator,
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const txHash = sanitizeOptionalTransactionRef(args.txHash, "txHash");
    const clientRequestId = sanitizeOptionalTransactionRef(args.clientRequestId, "clientRequestId");
    const errorMessage = sanitizeOptionalTransactionRef(args.errorMessage, "errorMessage");

    assertTransactionLookupKey(txHash, clientRequestId);

    const transaction = await getTransactionByLookup(ctx, txHash, clientRequestId);

    if (!transaction) {
      return null;
    }

    await ctx.db.patch(transaction._id, {
      status: args.status,
      updatedAt: Date.now(),
      ...(txHash !== undefined ? { txHash } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });

    return transaction._id;
  },
});
