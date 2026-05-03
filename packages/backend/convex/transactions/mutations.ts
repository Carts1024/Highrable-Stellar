import { v } from "convex/values";

import { mutation } from "../_generated/server";
import {
  assertTransactionLookupKey,
  getTransactionByLookupOrThrow,
  sanitizeOptionalTransactionRef,
  sanitizeTransactionWallet,
} from "./helpers";
import { transactionStatusValidator, transactionTypeValidator } from "./schema";

export const createTransaction = mutation({
  args: {
    walletAddress: v.string(),
    type: transactionTypeValidator,
    txHash: v.optional(v.string()),
    clientRequestId: v.optional(v.string()),
    escrowId: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
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
      type: args.type,
      status: args.status,
      createdAt: now,
      updatedAt: now,
      ...(txHash !== undefined ? { txHash } : {}),
      ...(clientRequestId !== undefined ? { clientRequestId } : {}),
      ...(escrowId !== undefined ? { escrowId } : {}),
      ...(args.jobId !== undefined ? { jobId: args.jobId } : {}),
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

    const transaction = await getTransactionByLookupOrThrow(ctx, txHash, clientRequestId);

    await ctx.db.patch(transaction._id, {
      status: args.status,
      updatedAt: Date.now(),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });

    return transaction._id;
  },
});
