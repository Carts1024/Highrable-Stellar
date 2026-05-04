import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";

const RELEASED_STATUS = "released" as const;
const PENDING_STATUSES = new Set(["funded", "submitted"] as const);
const AWAITING_FUNDING_STATUS = "created" as const;
const RECENT_PAYOUTS_LIMIT = 5;

type TAssetAmountRow = { asset: string; amount: number };

type TRecentPayoutRow = {
  escrowId: string;
  jobId: Id<"jobs">;
  jobTitle: string | undefined;
  clientWallet: string;
  freelancerWallet: string;
  amount: number;
  asset: string;
  releaseTxHash: string | undefined;
  releasedAt: number | undefined;
  rating: number | undefined;
  reviewText: string | undefined;
};

type TFreelancerIncomeSummaryResult = {
  totalEarnedByAsset: TAssetAmountRow[];
  pendingEscrowByAsset: TAssetAmountRow[];
  completedJobs: number;
  activeJobs: number;
  awaitingFunding: number;
  recentPayouts: TRecentPayoutRow[];
};

function sumByAsset(escrows: Array<{ asset: string; amount: number }>): TAssetAmountRow[] {
  const byAsset = new Map<string, number>();

  for (const escrow of escrows) {
    byAsset.set(escrow.asset, (byAsset.get(escrow.asset) ?? 0) + escrow.amount);
  }

  return Array.from(byAsset.entries()).map(([asset, amount]) => ({ asset, amount }));
}

async function buildRecentPayoutRow(
  ctx: QueryCtx,
  escrow: {
    escrowId: string;
    jobId: Id<"jobs">;
    clientWallet: string;
    freelancerWallet: string;
    amount: number;
    asset: string;
    releaseTxHash?: string;
    updatedAt: number;
  },
): Promise<TRecentPayoutRow> {
  const [job, reputationRecord] = await Promise.all([
    ctx.db.get(escrow.jobId),
    ctx.db
      .query("reputationRecords")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow.escrowId))
      .unique(),
  ]);

  return {
    escrowId: escrow.escrowId,
    jobId: escrow.jobId,
    jobTitle: job?.title,
    clientWallet: escrow.clientWallet,
    freelancerWallet: escrow.freelancerWallet,
    amount: escrow.amount,
    asset: escrow.asset,
    releaseTxHash: escrow.releaseTxHash,
    releasedAt: escrow.updatedAt,
    rating: reputationRecord?.rating,
    reviewText: reputationRecord?.reviewText,
  };
}

export const getFreelancerIncomeSummary = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args): Promise<TFreelancerIncomeSummaryResult> => {
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);

    const allEscrows = await ctx.db
      .query("escrows")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .take(200);

    const releasedEscrows = allEscrows.filter((e) => e.status === RELEASED_STATUS);
    const pendingEscrows = allEscrows.filter((e) =>
      PENDING_STATUSES.has(e.status as "funded" | "submitted"),
    );
    const awaitingFundingCount = allEscrows.filter(
      (e) => e.status === AWAITING_FUNDING_STATUS,
    ).length;

    const sortedRecent = [...releasedEscrows]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, RECENT_PAYOUTS_LIMIT);

    // NOTE: N+1 reads here are acceptable for MVP (at most 5 × 2 extra reads).
    // TODO: Batch with a single query per table post-MVP if dataset grows.
    const recentPayouts = await Promise.all(sortedRecent.map((e) => buildRecentPayoutRow(ctx, e)));

    return {
      totalEarnedByAsset: sumByAsset(releasedEscrows),
      pendingEscrowByAsset: sumByAsset(pendingEscrows),
      completedJobs: releasedEscrows.length,
      activeJobs: pendingEscrows.length,
      awaitingFunding: awaitingFundingCount,
      recentPayouts,
    };
  },
});
