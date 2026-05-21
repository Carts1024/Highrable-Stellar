import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { isConfiguredAdminWallet } from "../_shared/adminAuth";
import {
  assertPublicHandleAvailable,
  ensureUserIdentity,
  findUserByWallet,
  sanitizeOnboardingProfile,
  sanitizeUserName,
  sanitizeUserWalletAddress,
} from "./helpers";
import { roleValidator, walletTypeValidator } from "./schema";

export const upsertUser = mutation({
  args: {
    walletAddress: v.string(),
    role: v.optional(roleValidator),
    name: v.optional(v.string()),
    walletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeUserWalletAddress(args.walletAddress);
    const name = sanitizeUserName(args.name);
    const existingUser = await findUserByWallet(ctx, walletAddress);
    const role = isConfiguredAdminWallet(walletAddress) ? "admin" : existingUser?.role;

    if (existingUser) {
      const patch: {
        role?: (typeof args)["role"];
        name?: string;
        walletType?: (typeof args)["walletType"];
        updatedAt: number;
      } = {
        ...(role !== undefined ? { role } : {}),
        updatedAt: Date.now(),
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
      ...(role !== undefined ? { role } : {}),
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
  },
  handler: async (ctx, args) => {
    return await ensureUserIdentity(ctx, args.walletAddress, args.walletType);
  },
});

export const completeOnboarding = mutation({
  args: {
    walletAddress: v.string(),
    walletType: v.optional(walletTypeValidator),
    firstName: v.string(),
    middleName: v.optional(v.string()),
    lastName: v.string(),
    publicHandle: v.string(),
    coreSkills: v.array(v.string()),
    discordHandle: v.optional(v.string()),
    xHandle: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const walletAddress = sanitizeUserWalletAddress(args.walletAddress);
    const existingUser = await findUserByWallet(ctx, walletAddress);
    const profile = await sanitizeOnboardingProfile(ctx, args);

    await assertPublicHandleAvailable(ctx, profile.normalizedPublicHandle, existingUser?._id);

    const now = Date.now();
    const role = isConfiguredAdminWallet(walletAddress) ? "admin" : existingUser?.role;
    const patch = {
      walletAddress,
      ...(role !== undefined ? { role } : {}),
      ...(args.walletType !== undefined ? { walletType: args.walletType } : {}),
      ...profile,
      skills: profile.coreSkills,
      onboardingCompletedAt: existingUser?.onboardingCompletedAt ?? now,
      updatedAt: now,
    };

    if (existingUser) {
      await ctx.db.patch(existingUser._id, patch);
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      ...patch,
      createdAt: now,
    });
  },
});
