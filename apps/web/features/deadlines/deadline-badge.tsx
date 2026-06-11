import type { TDeadlineStatus } from "./lib";

import {
  computeDeadlineStatus,
  formatDeadline,
  getDeadlineStatusLabel,
  getLocalTimezoneLabel,
  getRemainingTimeLabel,
} from "./lib";

const STATUS_CLASS: Record<TDeadlineStatus, string> = {
  no_deadline: "border-border bg-muted text-muted-foreground",
  upcoming: "border-border bg-card hr-text-secondary",
  due_soon: "border-amber-200 bg-amber-50 text-amber-800",
  due_very_soon: "border-orange-300 bg-orange-50 text-orange-800",
  overdue: "border-red-200 bg-red-50 text-red-700",
  submitted_on_time: "border-emerald-200 bg-emerald-50 text-emerald-700",
  submitted_late: "border-amber-300 bg-amber-50 text-amber-900",
  completed_on_time: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed_late: "border-amber-300 bg-amber-50 text-amber-900",
  cancelled: "border-border bg-muted text-muted-foreground",
  disputed: "border-red-200 bg-red-50 text-red-700",
  released: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function DeadlineBadge({
  deadlineAt,
  submittedAt,
  completedAt,
  approvedAt,
  escrowStatus,
  workStatus,
  compact = false,
}: {
  readonly deadlineAt?: number;
  readonly submittedAt?: number;
  readonly completedAt?: number;
  readonly approvedAt?: number;
  readonly escrowStatus?: string;
  readonly workStatus?: string;
  readonly compact?: boolean;
}) {
  const status = computeDeadlineStatus({
    deadlineAt,
    submittedAt,
    completedAt,
    approvedAt,
    escrowStatus,
    workStatus,
  });
  const statusClass = STATUS_CLASS[status];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] tracking-[0.06em] uppercase ${statusClass}`}
      >
        {getDeadlineStatusLabel(status)}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border p-3 ${statusClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
          {getDeadlineStatusLabel(status)}
        </span>
        <span className="font-mono text-[11px]">{getRemainingTimeLabel(deadlineAt)}</span>
      </div>
      <p className="mt-1 text-xs">
        {formatDeadline(deadlineAt)}{" "}
        <span className="font-mono text-[11px]">({getLocalTimezoneLabel()})</span>
      </p>
    </div>
  );
}
