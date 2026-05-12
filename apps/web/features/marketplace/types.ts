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

export type TActorRole = "client" | "selectedFreelancer" | "applicant" | "other" | "guest";

export type TCreateJobFormState = {
  title: string;
  description: string;
  budget: string;
  asset: string;
};

export type TCreateJobFormErrors = {
  title?: string;
  description?: string;
  budget?: string;
  asset?: string;
  submit?: string;
};

export type TApplyFormState = {
  proposal: string;
};

export type TMarketplaceJobRow = {
  job: TConvexDoc<"jobs">;
  escrow: TConvexDoc<"escrows"> | null;
};
