import { v } from "convex/values";

import { query } from "../_generated/server";
import { assertMemberServiceSecret } from "../_shared/serviceAuth";
import { findUserByWallet } from "../users/helpers";

export const getChallenge = query({
  args: { serviceSecret: v.string(), challengeId: v.string(), browserBinding: v.string() },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    const challenge = await ctx.db
      .query("authChallenges")
      .withIndex("by_challengeId", (q) => q.eq("challengeId", args.challengeId))
      .unique();
    if (!challenge || challenge.browserBinding !== args.browserBinding) {
      return null;
    }
    return challenge;
  },
});

export const getSession = query({
  args: { serviceSecret: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    const now = Date.now();
    if (!session || session.revokedAt !== undefined || session.expiresAt <= now) {
      return null;
    }

    const user = await findUserByWallet(ctx, session.walletAddress);
    return {
      sessionId: session.sessionId,
      walletAddress: session.walletAddress,
      walletType: session.walletType,
      authMethod: session.authMethod,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      profile: user
        ? {
            name: user.name ?? null,
            onboardingCompletedAt: user.onboardingCompletedAt ?? null,
            role: user.role ?? null,
          }
        : null,
    };
  },
});

