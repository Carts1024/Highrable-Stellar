import {
  computeDeadlineStatus,
  formatDeadline,
  getDeadlineStatusLabel,
  getLocalTimezoneLabel,
  getRemainingTimeLabel,
} from "./lib";

import type { TDeadlineStatus } from "./lib";

const STATUS_CLASS: Record<TDeadlineStatus, string> = {
  no_deadline: "border-gray-200 bg-gray-50 text-gray-700",
  upcoming: "border-gray-200 bg-white text-[#3f3f3f]",
  due_soon: "border-amber-200 bg-amber-50 text-amber-800",
  due_very_soon: "border-orange-300 bg-orange-50 text-orange-800",
  overdue: "border-red-200 bg-red-50 text-red-700",
  submitted_on_time: "border-emerald-200 bg-emerald-50 text-emerald-700",
  submitted_late: "border-amber-300 bg-amber-50 text-amber-900",
  completed_on_time: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed_late: "border-amber-300 bg-amber-50 text-amber-900",
  cancelled: "border-gray-200 bg-gray-50 text-gray-600",
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

  return (
    <div className={`rounded-lg border ${statusClass} ${compact ? "px-2 py-1" : "p-3"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase">
          {getDeadlineStatusLabel(status)}
        </span>
        {!compact ? (
          <span className="font-mono text-[11px]">{getRemainingTimeLabel(deadlineAt)}</span>
        ) : null}
      </div>
      {!compact ? (
        <p className="mt-1 text-xs">
          {formatDeadline(deadlineAt)}{" "}
          <span className="font-mono text-[11px]">({getLocalTimezoneLabel()})</span>
        </p>
      ) : null}
    </div>
  );
}
