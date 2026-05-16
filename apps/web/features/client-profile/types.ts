import type { TMarketplaceStatus } from "@/features/marketplace/lib/escrow-status";
import type { TConvexId } from "@repo/convex-client";

export type TAssetAmount = {
  readonly asset: string;
  readonly amount: number;
};

export type TClientProfile = {
  readonly walletAddress: string;
  readonly name?: string;
  readonly companyName?: string;
  readonly bio?: string;
  readonly websiteUrl?: string;
  readonly location?: string;
  readonly walletType?: "external_wallet" | "passkey_smart_account";
  readonly createdAt: number;
  readonly updatedAt?: number;
};

export type TClientTrustStats = {
  readonly jobsPosted: number;
  readonly microGigsPosted: number;
  readonly milestoneProjectsPosted: number;
  readonly totalMilestonesCreated: number;
  readonly selectedFreelancers: number;
  readonly escrowsCreated: number;
  readonly fundedEscrows: number;
  readonly completedEscrows: number;
  readonly completedMicroGigs: number;
  readonly completedMilestones: number;
  readonly activeEscrows: number;
  readonly disputedEscrows: number;
  readonly cancelledEscrows: number;
  readonly totalEscrowFundedByAsset: TAssetAmount[];
  readonly totalPaidByAsset: TAssetAmount[];
  readonly fundingReliabilityRate: number | null;
  readonly completionRate: number | null;
  readonly disputeRate: number | null;
  readonly cancellationRate: number | null;
};

export type TClientRecentJob = {
  readonly jobId: TConvexId<"jobs">;
  readonly jobType: "micro_gig" | "milestone_project";
  readonly title: string;
  readonly status: TMarketplaceStatus;
  readonly totalBudget: number;
  readonly asset: string;
  readonly createdAt: number;
};

export type TClientEscrowActivity = {
  readonly escrowId: string;
  readonly jobId: TConvexId<"jobs">;
  readonly milestoneId?: TConvexId<"milestones">;
  readonly jobTitle: string;
  readonly milestoneTitle?: string;
  readonly freelancerWallet?: string;
  readonly amount: number;
  readonly asset: string;
  readonly status: "created" | "funded" | "submitted" | "released" | "cancelled" | "disputed";
  readonly fundTxHash?: string;
  readonly releaseTxHash?: string;
  readonly updatedAt: number;
};

export type TReportedJobsSummary = {
  readonly totalReports: number;
  readonly reportedJobsCount: number;
};

export type TClientTrustProfileResponse = {
  readonly profile: TClientProfile;
  readonly stats: TClientTrustStats;
  readonly recentJobs: TClientRecentJob[];
  readonly recentFundedEscrows: TClientEscrowActivity[];
  readonly recentCompletedPayments: TClientEscrowActivity[];
  readonly reportedJobsSummary?: TReportedJobsSummary;
};
