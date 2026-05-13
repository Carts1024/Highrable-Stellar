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

export type TMarketplaceJobRow = {
  job: TConvexDoc<"jobs">;
  escrow: TConvexDoc<"escrows"> | null;
};
