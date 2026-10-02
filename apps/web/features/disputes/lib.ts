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

export const DISPUTE_STATUS_LABELS = {
  open: "Open",
  under_review: "Under Review",
  awaiting_client_response: "Awaiting Client",
  awaiting_freelancer_response: "Awaiting Freelancer",
  resolved_client: "Resolved: Client",
  resolved_freelancer: "Resolved: Freelancer",
  split_resolution: "Split Resolution",
  cancelled: "Cancelled",
} as const satisfies Record<TDisputeStatus, string>;

export const DISPUTE_ON_CHAIN_STATUS_LABELS = {
  not_marked: "Not Marked",
  marking: "Marking",
  marked: "Marked",
  mark_failed: "Retry Required",
} as const satisfies Record<TDisputeOnChainStatus, string>;

export const DISPUTE_STATUS_OPTIONS = [
  { value: "open", label: DISPUTE_STATUS_LABELS.open },
  { value: "under_review", label: DISPUTE_STATUS_LABELS.under_review },
  { value: "awaiting_client_response", label: DISPUTE_STATUS_LABELS.awaiting_client_response },
  {
    value: "awaiting_freelancer_response",
    label: DISPUTE_STATUS_LABELS.awaiting_freelancer_response,
  },
  { value: "resolved_client", label: DISPUTE_STATUS_LABELS.resolved_client },
  { value: "resolved_freelancer", label: DISPUTE_STATUS_LABELS.resolved_freelancer },
  { value: "split_resolution", label: DISPUTE_STATUS_LABELS.split_resolution },
  { value: "cancelled", label: DISPUTE_STATUS_LABELS.cancelled },
] as const satisfies ReadonlyArray<{ value: TDisputeStatus; label: string }>;

export const DISPUTE_ON_CHAIN_STATUS_OPTIONS = [
  { value: "not_marked", label: DISPUTE_ON_CHAIN_STATUS_LABELS.not_marked },
  { value: "marking", label: DISPUTE_ON_CHAIN_STATUS_LABELS.marking },
  { value: "marked", label: DISPUTE_ON_CHAIN_STATUS_LABELS.marked },
  { value: "mark_failed", label: DISPUTE_ON_CHAIN_STATUS_LABELS.mark_failed },
] as const satisfies ReadonlyArray<{ value: TDisputeOnChainStatus; label: string }>;

export const TERMINAL_DISPUTE_STATUSES = [
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const satisfies readonly TDisputeStatus[];

export function getDisputeReasonLabel(reason: TDisputeReasonCategory): string {
  return DISPUTE_REASON_OPTIONS.find((option) => option.value === reason)?.label ?? "Other";
}

export function getDisputeStatusLabel(status: TDisputeStatus): string {
  return DISPUTE_STATUS_LABELS[status];
}

export function getDisputeOnChainStatusLabel(status: TDisputeOnChainStatus): string {
  return DISPUTE_ON_CHAIN_STATUS_LABELS[status];
}

export function isTerminalDisputeStatus(status: TDisputeStatus): boolean {
  return TERMINAL_DISPUTE_STATUSES.some((terminalStatus) => terminalStatus === status);
}

export function isDisputeStatus(value: string): value is TDisputeStatus {
  return Object.hasOwn(DISPUTE_STATUS_LABELS, value);
}

export function isDisputeOnChainStatus(value: string): value is TDisputeOnChainStatus {
  return Object.hasOwn(DISPUTE_ON_CHAIN_STATUS_LABELS, value);
}

export function formatDisputeDate(timestamp?: number): string {
  if (!timestamp) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
