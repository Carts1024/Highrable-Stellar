import { v } from "convex/values";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { getEscrowByEscrowId as findEscrowByEscrowId, sanitizeEscrowId } from "./helpers";

const TRUST_FUNDED_STATUSES = new Set(["funded", "submitted", "released"] as const);

type TAssetAmountRow = {
  asset: string;
  amount: number;
};

function sumByAsset(escrows: Array<{ asset: string; amount: number }>): TAssetAmountRow[] {
  const byAsset = new Map<string, number>();

  for (const escrow of escrows) {
    byAsset.set(escrow.asset, (byAsset.get(escrow.asset) ?? 0) + escrow.amount);
  }

  return Array.from(byAsset.entries()).map(([asset, amount]) => ({ asset, amount }));
}

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

export const getClientTrustStats = query({
  args: {
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = normalizeWalletAddress(args.clientWallet);
    const [jobs, escrows] = await Promise.all([
      ctx.db
        .query("jobs")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", clientWallet))
        .take(500),
      ctx.db
        .query("escrows")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", clientWallet))
        .take(500),
    ]);

    const fundedEscrows = escrows.filter((escrow) =>
      TRUST_FUNDED_STATUSES.has(escrow.status as "funded" | "submitted" | "released"),
    );

    return {
      jobsPosted: jobs.length,
      fundedJobs: fundedEscrows.length,
      completedJobs: escrows.filter((escrow) => escrow.status === "released").length,
      disputedJobs: escrows.filter((escrow) => escrow.status === "disputed").length,
      totalEscrowFundedByAsset: sumByAsset(fundedEscrows),
    };
  },
});
