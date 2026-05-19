import type { TConvexDoc } from "@repo/convex-client";

export type TJobStatus =
  | "open"
  | "selected"
  | "funded"
  | "submitted"
  | "completed"
  | "cancelled"
  | "disputed";

export type TEscrowStatus =
  | "created"
  | "funded"
  | "submitted"
  | "released"
  | "cancelled"
  | "disputed";

export type TJobType = "micro_gig" | "milestone_project";

export type TMilestoneStatus =
  | "draft"
  | "open"
  | "assigned"
  | "escrow_created"
  | "funded"
  | "submitted"
  | "released"
  | "cancelled"
  | "disputed";

export type TApplicationGateStatus =
  | "locked"
  | "open"
  | "continuation_pending"
  | "continuation_rejected"
  | "closed";

export type TMilestoneApplicationGateReason =
  | "first_milestone_open"
  | "previous_milestone_unfinished"
  | "waiting_client_decision"
  | "replacement_applications_open"
  | "continuation_offer_pending"
  | "continuation_offer_rejected"
  | "milestone_closed";

export type TMilestoneApplicationGate = {
  status: TApplicationGateStatus;
  canApply: boolean;
  reason: TMilestoneApplicationGateReason;
  message: string;
  previousMilestoneId?: string;
  previousFreelancerWallet?: string;
  continuationOfferFreelancerWallet?: string;
};

export type TActorRole = "client" | "selectedFreelancer" | "applicant" | "other" | "guest";

export type TCreateJobFormState = {
  title: string;
  description: string;
  budget: string;
  asset: string;
  fundEscrowNow: boolean;
  jobType: TJobType;
  milestones: TCreateMilestoneFormState[];
};

export type TCreateMilestoneFormState = {
  id: string;
  title: string;
  description: string;
  amount: string;
};

export type TCreateJobFormErrors = {
  title?: string;
  description?: string;
  budget?: string;
  asset?: string;
  milestones?: string;
  submit?: string;
};

export type TApplyFormState = {
  proposal: string;
};

export type TShowcaseableCompletedWork = {
  readonly escrowId: string;
  readonly jobTitle: string;
  readonly milestoneTitle?: string;
  readonly amount: number;
  readonly asset: string;
  readonly workType: "micro_gig" | "milestone";
  readonly updatedAt: number;
};

export type TMarketplaceJobRow = {
  job: TConvexDoc<"jobs">;
  escrow: TConvexDoc<"escrows"> | null;
};
