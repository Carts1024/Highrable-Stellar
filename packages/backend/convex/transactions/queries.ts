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
