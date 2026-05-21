export type TDisputeReasonCategory =
  | "work_not_delivered"
  | "work_quality_issue"
  | "client_unresponsive"
  | "freelancer_unresponsive"
  | "missed_deadline"
  | "revision_disagreement"
  | "payment_release_disagreement"
  | "scope_disagreement"
  | "other";

export type TDisputeParentType = "micro_gig" | "milestone" | "escrow" | "job";

export type TDisputeStatus =
  | "open"
  | "under_review"
  | "awaiting_client_response"
  | "awaiting_freelancer_response"
  | "resolved_client"
  | "resolved_freelancer"
  | "split_resolution"
  | "cancelled";

export type TDisputeOnChainStatus = "not_marked" | "marking" | "marked" | "mark_failed";
