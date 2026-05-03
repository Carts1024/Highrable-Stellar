import { v } from "convex/values";

import { query } from "../_generated/server";
import { normalizeWalletAddress, requireNonEmptyString } from "../_shared/input";

export const listReputationByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);

    return await ctx.db
      .query("reputationRecords")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .order("desc")
      .take(100);
  },
});

export const getReputationByEscrowId = query({
  args: {
    escrowId: v.string(),
  },
  handler: async (ctx, args) => {
    const escrowId = requireNonEmptyString(args.escrowId, "escrowId");

    return await ctx.db
      .query("reputationRecords")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrowId))
      .unique();
  },
});
