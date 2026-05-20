import { v } from "convex/values";

import type { TUserRole } from "./schema";

import { mutation } from "../_generated/server";
import { isConfiguredAdminWallet } from "../_shared/adminAuth";
import { findUserByWallet, sanitizeUserName, sanitizeUserWalletAddress } from "./helpers";
import { roleValidator, walletTypeValidator } from "./schema";

const FALLBACK_NON_ADMIN_ROLE: TUserRole = "client";

function resolveUserRoleForWallet(args: {
  walletAddress: string;
  requestedRole: TUserRole | undefined;
  existingRole: TUserRole | undefined;
}): TUserRole {
  if (isConfiguredAdminWallet(args.walletAddress)) {
    return "admin";
  }

  if (args.requestedRole && args.requestedRole !== "admin") {
    return args.requestedRole;
  }

  if (args.existingRole && args.existingRole !== "admin") {
    return args.existingRole;
  }

  return FALLBACK_NON_ADMIN_ROLE;
}

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
    const nextRole = resolveUserRoleForWallet({
      walletAddress,
      requestedRole: args.role,
      existingRole: existingUser?.role,
    });

    if (existingUser) {
      const patch: {
        role: (typeof args)["role"];
        name?: string;
        walletType?: (typeof args)["walletType"];
      } = {
        role: nextRole,
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
      role: nextRole,
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
    const nextRole = resolveUserRoleForWallet({
      walletAddress,
      requestedRole: args.role,
      existingRole: existingUser?.role,
    });

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        walletType: args.walletType,
        role: nextRole,
      });
      return existingUser._id;
    }

    if (args.role === undefined) {
      return null;
    }

    return await ctx.db.insert("users", {
      walletAddress,
      role: nextRole,
      walletType: args.walletType,
      createdAt: Date.now(),
    });
  },
});
