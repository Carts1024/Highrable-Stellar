export type TDeadlineStatus =
  | "no_deadline"
  | "upcoming"
  | "due_soon"
  | "due_very_soon"
  | "overdue"
  | "submitted_on_time"
  | "submitted_late"
  | "completed_on_time"
  | "completed_late"
  | "cancelled"
  | "disputed"
  | "released";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_DEADLINE_LEAD_MS = 30 * 60 * 1000;

export function getLocalTimezoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";
}

export function toDatetimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function parseDatetimeLocalValue(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function validateDeadlineTimestamp(timestamp: number | null, now = Date.now()): string | null {
  if (timestamp === null) {
    return "Deadline is required.";
  }
  if (timestamp <= now) {
    return "Deadline must be in the future.";
  }
  if (timestamp - now < MIN_DEADLINE_LEAD_MS) {
    return "Deadline must be at least 30 minutes in the future.";
  }
  return null;
}

export function computeDeadlineStatus(input: {
  deadlineAt?: number;
  submittedAt?: number;
  completedAt?: number;
  approvedAt?: number;
  escrowStatus?: string;
  workStatus?: string;
  now?: number;
}): TDeadlineStatus {
  if (input.escrowStatus === "cancelled" || input.workStatus === "cancelled") return "cancelled";
  if (input.escrowStatus === "disputed" || input.workStatus === "disputed") return "disputed";

  const completedAt = input.approvedAt ?? input.completedAt;
  if (
    input.escrowStatus === "released" ||
    input.workStatus === "released" ||
    input.workStatus === "completed"
  ) {
    if (!input.deadlineAt || !completedAt) return "released";
    return completedAt <= input.deadlineAt ? "completed_on_time" : "completed_late";
  }

  if (!input.deadlineAt) return "no_deadline";
  if (input.submittedAt !== undefined) {
    return input.submittedAt <= input.deadlineAt ? "submitted_on_time" : "submitted_late";
  }

  const remainingMs = input.deadlineAt - (input.now ?? Date.now());
  if (remainingMs <= 0) return "overdue";
  if (remainingMs <= HOUR_MS) return "due_very_soon";
  if (remainingMs <= DAY_MS) return "due_soon";
  return "upcoming";
}

export function getRemainingTimeLabel(deadlineAt?: number, now = Date.now()): string {
  if (!deadlineAt) return "No deadline";

  const diff = deadlineAt - now;
  const absoluteMs = Math.abs(diff);
  const hours = Math.floor(absoluteMs / HOUR_MS);
  const minutes = Math.max(1, Math.round((absoluteMs % HOUR_MS) / (60 * 1000)));

  if (diff <= 0) {
    if (hours >= 24) return `${Math.floor(hours / 24)}d overdue`;
    return hours > 0 ? `${hours}h overdue` : `${minutes}m overdue`;
  }

  if (hours >= 24) return `${Math.floor(hours / 24)}d remaining`;
  return hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
}

export function formatDeadline(timestamp?: number): string {
  if (!timestamp) return "No deadline";
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function getDeadlineStatusLabel(status: TDeadlineStatus): string {
  return status.replace(/_/g, " ");
}
