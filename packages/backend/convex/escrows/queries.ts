import { v } from "convex/values";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { getEscrowByEscrowId as findEscrowByEscrowId, sanitizeEscrowId } from "./helpers";

export const getEscrowByEscrowId = query({
  args: {
    escrowId: v.string(),
  },
  handler: async (ctx, args) => {
    const escrowId = sanitizeEscrowId(args.escrowId);
    return await findEscrowByEscrowId(ctx, escrowId);
  },
});

export const getEscrowByJobId = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const escrows = await ctx.db
      .query("escrows")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .take(1);

    return escrows[0] ?? null;
  },
});

export const listEscrowsByWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [asClient, asFreelancer] = await Promise.all([
      ctx.db
        .query("escrows")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", walletAddress))
        .take(100),
      ctx.db
        .query("escrows")
        .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", walletAddress))
        .take(100),
    ]);

    const byId = new Map<(typeof asClient)[number]["_id"], (typeof asClient)[number]>();
    for (const escrow of asClient) {
      byId.set(escrow._id, escrow);
    }
    for (const escrow of asFreelancer) {
      byId.set(escrow._id, escrow);
    }

    return Array.from(byId.values()).sort((left, right) => right.updatedAt - left.updatedAt);
  },
});
