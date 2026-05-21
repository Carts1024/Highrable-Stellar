import type { TDisputeOnChainStatus, TDisputeReasonCategory, TDisputeStatus } from "./types";

export const DISPUTE_REASON_OPTIONS: Array<{ value: TDisputeReasonCategory; label: string }> = [
  { value: "work_not_delivered", label: "Work not delivered" },
  { value: "work_quality_issue", label: "Work quality issue" },
  { value: "client_unresponsive", label: "Client unresponsive" },
  { value: "freelancer_unresponsive", label: "Freelancer unresponsive" },
  { value: "missed_deadline", label: "Missed deadline" },
  { value: "revision_disagreement", label: "Revision disagreement" },
  { value: "payment_release_disagreement", label: "Payment release disagreement" },
  { value: "scope_disagreement", label: "Scope disagreement" },
  { value: "other", label: "Other" },
];

export function getDisputeReasonLabel(reason: TDisputeReasonCategory): string {
  return DISPUTE_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? "Other";
}

export function getDisputeStatusLabel(status: TDisputeStatus): string {
  const labels: Record<TDisputeStatus, string> = {
    open: "Open",
    under_review: "Under Review",
    awaiting_client_response: "Awaiting Client",
    awaiting_freelancer_response: "Awaiting Freelancer",
    resolved_client: "Resolved: Client",
    resolved_freelancer: "Resolved: Freelancer",
    split_resolution: "Split Resolution",
    cancelled: "Cancelled",
  };

  return labels[status];
}

export function getDisputeOnChainStatusLabel(status: TDisputeOnChainStatus): string {
  const labels: Record<TDisputeOnChainStatus, string> = {
    not_marked: "Not Marked",
    marking: "Marking",
    marked: "Marked",
    mark_failed: "Retry Required",
  };

  return labels[status];
}

export function formatDisputeDate(timestamp?: number): string {
  if (!timestamp) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
