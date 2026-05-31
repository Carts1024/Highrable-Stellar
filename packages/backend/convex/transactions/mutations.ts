import { v } from "convex/values";

import { mutation } from "../_generated/server";
import {
  assertTransactionLookupKey,
  getTransactionByLookup,
  sanitizeOptionalTransactionRef,
  sanitizeTransactionWallet,
} from "./helpers";
import {
  feePathValidator,
  transactionStatusValidator,
  transactionTypeValidator,
  walletTypeValidator,
} from "./schema";

export const createTransaction = mutation({
  args: {
    walletAddress: v.string(),
    walletType: v.optional(walletTypeValidator),
    transactionHash: v.optional(v.string()),
    type: transactionTypeValidator,
    txHash: v.optional(v.string()),
    clientRequestId: v.optional(v.string()),
    escrowId: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    milestoneId: v.optional(v.id("milestones")),
    onChainEscrowId: v.optional(v.string()),
    proofHash: v.optional(v.string()),
    recipientAddress: v.optional(v.string()),
    recipientType: v.optional(v.union(v.literal("classic_account"), v.literal("contract_account"))),
    asset: v.optional(v.union(v.literal("XLM"), v.literal("USDC"))),
    amount: v.optional(v.string()),
    network: v.optional(v.string()),
    feePath: v.optional(feePathValidator),
    sourceAccount: v.optional(v.string()),
    status: transactionStatusValidator,
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeTransactionWallet(args.walletAddress);
    const txHash = sanitizeOptionalTransactionRef(args.txHash, "txHash");
    const transactionHash = sanitizeOptionalTransactionRef(args.transactionHash, "transactionHash");
    const clientRequestId = sanitizeOptionalTransactionRef(args.clientRequestId, "clientRequestId");
    const escrowId = sanitizeOptionalTransactionRef(args.escrowId, "escrowId");
    const onChainEscrowId = sanitizeOptionalTransactionRef(args.onChainEscrowId, "onChainEscrowId");
    const proofHash = sanitizeOptionalTransactionRef(args.proofHash, "proofHash");
    const recipientAddress = sanitizeOptionalTransactionRef(
      args.recipientAddress,
      "recipientAddress",
    );
    const amount = sanitizeOptionalTransactionRef(args.amount, "amount");
    const network = sanitizeOptionalTransactionRef(args.network, "network");
    const sourceAccount = sanitizeOptionalTransactionRef(args.sourceAccount, "sourceAccount");
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
      ...(transactionHash !== undefined ? { transactionHash } : {}),
      ...(clientRequestId !== undefined ? { clientRequestId } : {}),
      ...(escrowId !== undefined ? { escrowId } : {}),
      ...(onChainEscrowId !== undefined ? { onChainEscrowId } : {}),
      ...(proofHash !== undefined ? { proofHash } : {}),
      ...(recipientAddress !== undefined ? { recipientAddress } : {}),
      ...(args.recipientType !== undefined ? { recipientType: args.recipientType } : {}),
      ...(args.asset !== undefined ? { asset: args.asset } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(network !== undefined ? { network } : {}),
      ...(args.feePath !== undefined ? { feePath: args.feePath } : {}),
      ...(sourceAccount !== undefined ? { sourceAccount } : {}),
      ...(args.jobId !== undefined ? { jobId: args.jobId } : {}),
      ...(args.milestoneId !== undefined ? { milestoneId: args.milestoneId } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });
  },
});

export const updateTransactionStatus = mutation({
  args: {
    txHash: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
    clientRequestId: v.optional(v.string()),
    status: transactionStatusValidator,
    errorMessage: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const txHash = sanitizeOptionalTransactionRef(args.txHash, "txHash");
    const transactionHash = sanitizeOptionalTransactionRef(args.transactionHash, "transactionHash");
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
      ...(args.confirmedAt !== undefined ? { confirmedAt: args.confirmedAt } : {}),
      ...(txHash !== undefined ? { txHash } : {}),
      ...(transactionHash !== undefined ? { transactionHash } : {}),
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });

    return transaction._id;
  },
});
