import type { TConvexId } from "@repo/convex-client";

export type TAssetAmount = {
  readonly asset: string;
  readonly amount: number;
};

export type TFreelancerWorkType = "micro_gig" | "milestone";

export type TFreelancerProfile = {
  readonly walletAddress: string;
  readonly name?: string;
  readonly bio?: string;
  readonly skills: string[];
  readonly avatarUrl?: string;
  readonly portfolioUrl?: string;
  readonly websiteUrl?: string;
  readonly location?: string;
  readonly walletType?: "external_wallet" | "passkey_smart_account";
  readonly createdAt: number;
  readonly updatedAt?: number;
};

export type TFreelancerProfileStats = {
  readonly completedContracts: number;
  readonly completedMicroGigs: number;
  readonly completedMilestones: number;
  readonly activeContracts: number;
  readonly activeMilestones: number;
  readonly pendingEscrowByAsset: TAssetAmount[];
  readonly totalEarnedByAsset: TAssetAmount[];
  readonly averageRating: number | null;
  readonly totalReviews: number;
  readonly disputedContracts: number;
};

export type TVerifiedFreelancerReview = {
  readonly escrowId: string;
  readonly jobId: TConvexId<"jobs">;
  readonly milestoneId?: TConvexId<"milestones">;
  readonly jobTitle: string;
  readonly milestoneTitle?: string;
  readonly workType: TFreelancerWorkType;
  readonly clientWallet: string;
  readonly freelancerWallet: string;
  readonly amount: number;
  readonly asset: string;
  readonly rating: number;
  readonly reviewText?: string;
  readonly reviewHash?: string;
  readonly txHash?: string;
  readonly createdAt: number;
};

export type TFreelancerRecentContract = {
  readonly escrowId: string;
  readonly jobId: TConvexId<"jobs">;
  readonly milestoneId?: TConvexId<"milestones">;
  readonly jobTitle: string;
  readonly milestoneTitle?: string;
  readonly workType: TFreelancerWorkType;
  readonly clientWallet: string;
  readonly amount: number;
  readonly asset: string;
  readonly status: "created" | "funded" | "submitted" | "released" | "cancelled" | "disputed";
  readonly releaseTxHash?: string;
  readonly updatedAt: number;
};

export type TFreelancerProfileResponse = {
  readonly profile: TFreelancerProfile;
  readonly stats: TFreelancerProfileStats;
  readonly verifiedReviews: TVerifiedFreelancerReview[];
  readonly recentContracts: TFreelancerRecentContract[];
};
