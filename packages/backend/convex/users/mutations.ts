import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { findUserByWallet, sanitizeUserName, sanitizeUserWalletAddress } from "./helpers";
import { roleValidator, walletTypeValidator } from "./schema";

export const upsertUser = mutation({
  args: {
    walletAddress: v.string(),
    role: roleValidator,
    name: v.optional(v.string()),
    walletType: v.optional(walletTypeValidator),
    smartAccountAddress: v.optional(v.string()),
    createdWithPasskey: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeUserWalletAddress(args.walletAddress);
    const smartAccountAddress =
      args.smartAccountAddress !== undefined
        ? sanitizeUserWalletAddress(args.smartAccountAddress)
        : undefined;
    const name = sanitizeUserName(args.name);
    const existingUser = await findUserByWallet(ctx, walletAddress);

    if (existingUser) {
      const patch: {
        role: (typeof args)["role"];
        name?: string;
        walletType?: (typeof args)["walletType"];
        smartAccountAddress?: string;
        createdWithPasskey?: boolean;
      } = { role: args.role };
      if (name !== undefined) {
        patch.name = name;
      }
      if (args.walletType !== undefined) {
        patch.walletType = args.walletType;
      }
      if (smartAccountAddress !== undefined) {
        patch.smartAccountAddress = smartAccountAddress;
      }
      if (args.createdWithPasskey !== undefined) {
        patch.createdWithPasskey = args.createdWithPasskey;
      }

      await ctx.db.patch(existingUser._id, patch);
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      walletAddress,
      role: args.role,
      ...(args.walletType !== undefined ? { walletType: args.walletType } : {}),
      ...(smartAccountAddress !== undefined ? { smartAccountAddress } : {}),
      ...(args.createdWithPasskey !== undefined
        ? { createdWithPasskey: args.createdWithPasskey }
        : {}),
      createdAt: Date.now(),
      ...(name !== undefined ? { name } : {}),
    });
  },
});
