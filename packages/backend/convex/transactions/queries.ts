import { v } from "convex/values";

import { query } from "../_generated/server";
import { sanitizeRequiredTxHash, sanitizeTransactionWallet } from "./helpers";

export const listTransactionsByWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeTransactionWallet(args.walletAddress);

    return await ctx.db
      .query("transactions")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", walletAddress))
      .order("desc")
      .take(100);
  },
});

export const listWalletTransfersByWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeTransactionWallet(args.walletAddress);
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", walletAddress))
      .order("desc")
      .take(100);

    return transactions
      .filter((transaction) => transaction.type === "wallet_transfer")
      .slice(0, 12);
  },
});

export const getTransactionByHash = query({
  args: {
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    const txHash = sanitizeRequiredTxHash(args.txHash);

    return await ctx.db
      .query("transactions")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .unique();
  },
});

export const getGasRecoveryRecord = query({
  args: {
    walletAddress: v.string(),
    clientRequestId: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeTransactionWallet(args.walletAddress);
    const clientRequestId = args.clientRequestId.trim();
    if (!clientRequestId) {
      return null;
    }

    const transaction = await ctx.db
      .query("transactions")
      .withIndex("by_clientRequestId", (q) => q.eq("clientRequestId", clientRequestId))
      .unique();

    if (!transaction || transaction.walletAddress !== walletAddress) {
      return null;
    }

    return {
      clientRequestId: transaction.clientRequestId ?? clientRequestId,
      status: transaction.status,
      gasStatus: transaction.gasStatus ?? null,
      gasRequestId: transaction.gasRequestId ?? null,
      gasTransactionHash: transaction.gasTransactionHash ?? null,
      gasOuterTransactionHash: transaction.gasOuterTransactionHash ?? null,
      gasActualFeeStroops: transaction.gasActualFeeStroops ?? null,
      gasReconciliationRequired: transaction.gasReconciliationRequired ?? false,
      errorMessage: transaction.errorMessage ?? null,
    };
  },
});
