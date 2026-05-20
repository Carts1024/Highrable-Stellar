import type { TConvexDoc, TConvexId } from "@repo/convex-client";

export type TAdminReviewStatus =
  | "under_review"
  | "awaiting_client_response"
  | "awaiting_freelancer_response";

export type TAdminResolutionStatus =
  | "resolved_client"
  | "resolved_freelancer"
  | "split_resolution";

export interface IAdminDisputeListItem {
  readonly disputeId: TConvexId<"disputes">;
  readonly disputeNumber: string;
  readonly title: string;
  readonly status: TConvexDoc<"disputes">["status"];
  readonly onChainStatus: TConvexDoc<"disputes">["onChainStatus"];
  readonly reasonCategory: TConvexDoc<"disputes">["reasonCategory"];
  readonly clientWallet: string;
  readonly freelancerWallet: string;
  readonly openedAt: number;
  readonly updatedAt: number;
}

export interface IAdminDashboardMetrics {
  readonly generatedAt: number;
  readonly isTruncated: boolean;
  readonly users: {
    readonly total: number;
    readonly byRole: Record<"client" | "freelancer" | "admin", number>;
  };
  readonly jobs: {
    readonly total: number;
    readonly byStatus: Record<string, number>;
  };
  readonly escrows: {
    readonly total: number;
    readonly byStatus: Record<string, number>;
  };
  readonly disputes: {
    readonly total: number;
    readonly byStatus: Record<string, number>;
    readonly byOnChainStatus: Record<string, number>;
  };
  readonly workSubmissions: {
    readonly total: number;
    readonly byStatus: Record<string, number>;
    readonly byOnChainStatus: Record<string, number>;
  };
  readonly revisions: {
    readonly total: number;
    readonly byStatus: Record<string, number>;
  };
  readonly deadlineReminders: {
    readonly total: number;
    readonly byStatus: Record<string, number>;
    readonly overdueCount: number;
  };
  readonly recentDisputes: IAdminDisputeListItem[];
}

export interface IAdminDisputeDetail {
  readonly dispute: TConvexDoc<"disputes"> & {
    readonly attachments?: Array<
      TConvexDoc<"attachments"> & {
        readonly url?: string | null;
      }
    >;
  };
  readonly timeline: Array<
    TConvexDoc<"disputeEvents"> & {
      readonly attachments?: Array<
        TConvexDoc<"attachments"> & {
          readonly url?: string | null;
        }
      >;
    }
  >;
  readonly job: TConvexDoc<"jobs"> | null;
  readonly milestone: TConvexDoc<"milestones"> | null;
  readonly escrow: TConvexDoc<"escrows"> | null;
}

export interface IAdminDisputesResponse {
  readonly disputes: IAdminDisputeListItem[];
}

export interface IAdminResolutionRequestStarted {
  readonly phase: "started";
  readonly status: TAdminResolutionStatus;
  readonly freelancerShareBps: number;
  readonly resolutionNote?: string;
}

export interface IAdminResolutionRequestSucceeded {
  readonly phase: "succeeded";
  readonly status: TAdminResolutionStatus;
  readonly freelancerShareBps: number;
  readonly transactionHash: string;
  readonly stellarExpertUrl?: string;
  readonly resolutionNote?: string;
}

export interface IAdminResolutionRequestFailed {
  readonly phase: "failed";
  readonly status: TAdminResolutionStatus;
  readonly freelancerShareBps: number;
  readonly errorMessage: string;
  readonly resolutionNote?: string;
}

export type TAdminResolutionRequest =
  | IAdminResolutionRequestStarted
  | IAdminResolutionRequestSucceeded
  | IAdminResolutionRequestFailed;
