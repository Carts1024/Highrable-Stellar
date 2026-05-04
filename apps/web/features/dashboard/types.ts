import type { TConvexId } from "@repo/convex-client";

export type TAssetAmount = {
  asset: string;
  amount: number;
};

export type TRecentPayout = {
  escrowId: string;
  jobId: TConvexId<"jobs">;
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

export type TFreelancerIncomeSummary = {
  totalEarnedByAsset: TAssetAmount[];
  pendingEscrowByAsset: TAssetAmount[];
  completedJobs: number;
  activeJobs: number;
  awaitingFunding: number;
  recentPayouts: TRecentPayout[];
};
