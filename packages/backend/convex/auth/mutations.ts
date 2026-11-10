import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { isConfiguredAdminWallet } from "../_shared/adminAuth";
import { normalizeWalletAddress } from "../_shared/input";
import { assertMemberServiceSecret } from "../_shared/serviceAuth";
import { findUserByWallet } from "../users/helpers";
import { authMethodValidator, authWalletTypeValidator } from "./schema";

const MAX_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

function assertNotExpired(expiresAt: number, now: number): void {
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error("Authentication challenge has expired.");
  }
}

export const createChallenge = mutation({
  args: {
    serviceSecret: v.string(),
    challengeId: v.string(),
    nonce: v.string(),
    message: v.optional(v.string()),
    webauthnChallenge: v.optional(v.string()),
    walletAddress: v.string(),
    walletType: authWalletTypeValidator,
    authMethod: authMethodValidator,
    browserBinding: v.string(),
    credentialId: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    const now = Date.now();
    assertNotExpired(args.expiresAt, now);
    const walletAddress = normalizeWalletAddress(args.walletAddress);

    const existing = await ctx.db
      .query("authChallenges")
      .withIndex("by_challengeId", (q) => q.eq("challengeId", args.challengeId))
      .unique();
    if (existing) {
      throw new Error("Authentication challenge already exists.");
    }

    await ctx.db.insert("authChallenges", {
      challengeId: args.challengeId,
      nonce: args.nonce,
      ...(args.message !== undefined ? { message: args.message } : {}),
      ...(args.webauthnChallenge !== undefined
        ? { webauthnChallenge: args.webauthnChallenge }
        : {}),
      walletAddress,
      walletType: args.walletType,
      authMethod: args.authMethod,
      browserBinding: args.browserBinding,
      ...(args.credentialId !== undefined ? { credentialId: args.credentialId } : {}),
      createdAt: now,
      expiresAt: args.expiresAt,
    });

    return { challengeId: args.challengeId, expiresAt: args.expiresAt };
  },
});

export const consumeChallengeAndCreateSession = mutation({
  args: {
    serviceSecret: v.string(),
    challengeId: v.string(),
    browserBinding: v.string(),
    walletAddress: v.string(),
    walletType: authWalletTypeValidator,
    authMethod: authMethodValidator,
    nonce: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const challenge = await ctx.db
      .query("authChallenges")
      .withIndex("by_challengeId", (q) => q.eq("challengeId", args.challengeId))
      .unique();
    const now = Date.now();

    if (!challenge || challenge.consumedAt !== undefined) {
      throw new Error("Authentication challenge has already been used or was not found.");
    }
    if (challenge.expiresAt <= now) {
      throw new Error("Authentication challenge has expired.");
    }
    if (
      challenge.browserBinding !== args.browserBinding ||
      challenge.walletAddress !== walletAddress ||
      challenge.walletType !== args.walletType ||
      challenge.authMethod !== args.authMethod ||
      challenge.nonce !== args.nonce
    ) {
      throw new Error("Authentication challenge payload mismatch.");
    }

    const existingSession = await ctx.db
      .query("authSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (existingSession) {
      throw new Error("Authentication session already exists.");
    }

    await ctx.db.patch(challenge._id, { consumedAt: now });

    const existingUser = await findUserByWallet(ctx, walletAddress);
    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        walletType: args.walletType,
        ...(isConfiguredAdminWallet(walletAddress) ? { role: "admin" as const } : {}),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("users", {
        walletAddress,
        walletType: args.walletType,
        ...(isConfiguredAdminWallet(walletAddress) ? { role: "admin" as const } : {}),
        createdAt: now,
        updatedAt: now,
      });
    }

    const expiresAt = now + 24 * 60 * 60 * 1000;
    await ctx.db.insert("authSessions", {
      sessionId: args.sessionId,
      walletAddress,
      walletType: args.walletType,
      authMethod: args.authMethod,
      createdAt: now,
      expiresAt,
    });

    return { sessionId: args.sessionId, walletAddress: args.walletAddress, expiresAt };
  },
});

export const revokeSession = mutation({
  args: { serviceSecret: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (!session || session.revokedAt !== undefined) {
      return false;
    }

    await ctx.db.patch(session._id, { revokedAt: Date.now() });
    return true;
  },
});

export const consumeRateLimit = mutation({
  args: {
    serviceSecret: v.string(),
    key: v.string(),
    limit: v.number(),
    windowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    const now = Date.now();
    const windowMs = Math.min(Math.max(args.windowMs ?? 60_000, 1_000), MAX_RATE_LIMIT_WINDOW_MS);
    const existing = await ctx.db
      .query("authRateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (!existing || existing.windowStartedAt + windowMs <= now) {
      if (existing) {
        await ctx.db.patch(existing._id, { windowStartedAt: now, count: 1 });
      } else {
        await ctx.db.insert("authRateLimits", { key: args.key, windowStartedAt: now, count: 1 });
      }
      return { allowed: true, remaining: Math.max(args.limit - 1, 0) };
    }

    if (existing.count >= args.limit) {
      return { allowed: false, remaining: 0 };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { allowed: true, remaining: Math.max(args.limit - existing.count - 1, 0) };
  },
});
