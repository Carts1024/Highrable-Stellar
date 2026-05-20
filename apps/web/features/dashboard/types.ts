import type { TConvexId } from "@repo/convex-client";

export type TAssetAmount = {
  asset: string;
  amount: number;
};

export type TDashboardRole = "client" | "freelancer";
export type TDashboardMode = "client" | "freelancer";

export type TDerivedApplicationStatus =
  | "pending"
  | "selected"
  | "funded"
  | "submitted"
  | "completed"
  | "cancelled"
  | "disputed"
  | "not_selected";

export type TConvexPaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

export interface IAppliedJobItem {
  readonly applicationId: TConvexId<"applications">;
  readonly jobId: TConvexId<"jobs">;
  readonly milestoneId: TConvexId<"milestones"> | undefined;
  readonly applicationCreatedAt: number;
  readonly proposalPreview: string;
  readonly title: string;
  readonly milestoneTitle: string | undefined;
  readonly budget: number;
  readonly asset: string;
  readonly jobStatus: string;
  readonly derivedApplicationStatus: TDerivedApplicationStatus;
  readonly selectedFreelancerWallet: string | undefined;
  readonly escrowStatus: string | undefined;
  readonly escrowUpdatedAt: number | undefined;
}

export interface IOngoingJobItem {
  readonly escrowId: string;
  readonly jobId: TConvexId<"jobs">;
  readonly milestoneId: TConvexId<"milestones"> | undefined;
  readonly title: string;
  readonly milestoneTitle: string | undefined;
  readonly budget: number;
  readonly asset: string;
  readonly clientWallet: string;
  readonly escrowStatus: "funded" | "submitted";
  readonly updatedAt: number;
  readonly deadlineAt: number | undefined;
  readonly submittedAt: number | undefined;
  readonly completedAt: number | undefined;
  readonly approvedAt: number | undefined;
}

export interface IPostedJobItem {
  readonly jobId: TConvexId<"jobs">;
  readonly title: string;
  readonly budget: number;
  readonly asset: string;
  readonly createdAt: number;
  readonly jobStatus: string;
  readonly selectedFreelancerWallet: string | undefined;
  readonly applicationCount: number;
  readonly escrowStatus: string | undefined;
  readonly deadlineAt: number | undefined;
  readonly submittedAt: number | undefined;
  readonly completedAt: number | undefined;
  readonly approvedAt: number | undefined;
}

export type TRecentPayout = {
  escrowId: string;
  jobId: TConvexId<"jobs">;
  milestoneId: TConvexId<"milestones"> | undefined;
  jobTitle: string | undefined;
  milestoneTitle: string | undefined;
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

export interface IPaginatedDashboardState<TItem> {
  readonly items: TItem[];
  readonly status: TConvexPaginationStatus;
  readonly isInitialLoading: boolean;
  readonly canLoadMore: boolean;
  readonly isLoadingMore: boolean;
  readonly loadMore: (numItems: number) => void;
}

export interface IDashboardModeState {
  readonly selectedMode: TDashboardMode;
  readonly isReady: boolean;
  readonly setSelectedMode: (mode: TDashboardMode) => void;
}
