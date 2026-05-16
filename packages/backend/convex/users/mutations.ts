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
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeUserWalletAddress(args.walletAddress);
    const name = sanitizeUserName(args.name);
    const existingUser = await findUserByWallet(ctx, walletAddress);

    if (existingUser) {
      const patch: {
        role: (typeof args)["role"];
        name?: string;
        walletType?: (typeof args)["walletType"];
      } = {
        role: args.role,
      };
      if (name !== undefined) {
        patch.name = name;
      }
      if (args.walletType !== undefined) {
        patch.walletType = args.walletType;
      }

      await ctx.db.patch(existingUser._id, patch);
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      walletAddress,
      role: args.role,
      createdAt: Date.now(),
      ...(name !== undefined ? { name } : {}),
      ...(args.walletType !== undefined ? { walletType: args.walletType } : {}),
    });
  },
});

export const recordWalletIdentity = mutation({
  args: {
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    role: v.optional(roleValidator),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeUserWalletAddress(args.walletAddress);
    const existingUser = await findUserByWallet(ctx, walletAddress);

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        walletType: args.walletType,
        ...(args.role !== undefined ? { role: args.role } : {}),
      });
      return existingUser._id;
    }

    if (args.role === undefined) {
      return null;
    }

    return await ctx.db.insert("users", {
      walletAddress,
      role: args.role,
      walletType: args.walletType,
      createdAt: Date.now(),
    });
  },
});
