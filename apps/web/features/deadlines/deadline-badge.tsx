import { StatusText } from "@/features/common/components/status-text";
import React from "react";

import type { TDeadlineStatus } from "./lib";
import type { TStatusTone } from "@/features/common/components/status-text";

import {
  computeDeadlineStatus,
  formatDeadline,
  getDeadlineStatusLabel,
  getLocalTimezoneLabel,
  getRemainingTimeLabel,
} from "./lib";

const STATUS_TONE: Record<TDeadlineStatus, TStatusTone> = {
  no_deadline: "neutral",
  upcoming: "neutral",
  due_soon: "warning",
  due_very_soon: "warning",
  overdue: "danger",
  submitted_on_time: "success",
  submitted_late: "warning",
  completed_on_time: "success",
  completed_late: "warning",
  cancelled: "neutral",
  disputed: "danger",
  released: "success",
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
  const tone = STATUS_TONE[status];

  if (compact) {
    return <StatusText tone={tone}>{getDeadlineStatusLabel(status)}</StatusText>;
  }

  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusText tone={tone}>{getDeadlineStatusLabel(status)}</StatusText>
        <span className="hr-text-secondary text-xs">{getRemainingTimeLabel(deadlineAt)}</span>
      </div>
      <p className="hr-text-secondary text-xs">
        {formatDeadline(deadlineAt)}{" "}
        <span className="hr-text-muted">({getLocalTimezoneLabel()})</span>
      </p>
    </div>
  );
}
