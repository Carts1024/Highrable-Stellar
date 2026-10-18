"use client";

import { StatusText } from "@/features/common/components/status-text";
import React from "react";

import type { TConvexDoc } from "@repo/convex-client";

interface ICancellationStatusBadgeProps {
  readonly status: TConvexDoc<"cancellationRequests">["status"];
}

const STATUS_LABELS: Record<TConvexDoc<"cancellationRequests">["status"], string> = {
  draft: "Draft",
  pending_freelancer_response: "Freelancer response",
  approved_for_cancel: "Approved",
  rejected_by_freelancer: "Rejected",
  cancel_pending_on_chain: "On the network pending",
  cancelled_on_chain: "Cancelled",
  cancel_failed: "Retry needed",
  blocked: "Blocked",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

export function CancellationStatusBadge({ status }: ICancellationStatusBadgeProps) {
  const tone =
    status === "cancelled_on_chain"
      ? "success"
      : status === "cancel_failed" || status === "blocked" || status === "rejected_by_freelancer"
        ? "danger"
        : status === "pending_freelancer_response" || status === "cancel_pending_on_chain"
          ? "warning"
          : "neutral";

  return <StatusText tone={tone}>{STATUS_LABELS[status]}</StatusText>;
}
