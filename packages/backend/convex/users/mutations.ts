import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { findUserByWallet, sanitizeUserName, sanitizeUserWalletAddress } from "./helpers";
import { roleValidator } from "./schema";

export const upsertUser = mutation({
  args: {
    walletAddress: v.string(),
    role: roleValidator,
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeUserWalletAddress(args.walletAddress);
    const name = sanitizeUserName(args.name);
    const existingUser = await findUserByWallet(ctx, walletAddress);

    if (existingUser) {
      const patch: { role: (typeof args)["role"]; name?: string } = { role: args.role };
      if (name !== undefined) {
        patch.name = name;
      }

      await ctx.db.patch(existingUser._id, patch);
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      walletAddress,
      role: args.role,
      createdAt: Date.now(),
      ...(name !== undefined ? { name } : {}),
    });
  },
});
