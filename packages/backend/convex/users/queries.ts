import { v } from "convex/values";

import { query } from "../_generated/server";
import { findUserByWallet, sanitizeUserWalletAddress } from "./helpers";
import { roleValidator } from "./schema";

export const getUserByWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeUserWalletAddress(args.walletAddress);
    return await findUserByWallet(ctx, walletAddress);
  },
});

export const listUsersByRole = query({
  args: {
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .take(100);
  },
});
