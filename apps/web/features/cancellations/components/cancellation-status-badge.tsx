"use client";

import { Badge } from "@repo/ui/components/ui/badge";

import type { TConvexDoc } from "@repo/convex-client";

interface ICancellationStatusBadgeProps {
  readonly status: TConvexDoc<"cancellationRequests">["status"];
}

const STATUS_LABELS: Record<TConvexDoc<"cancellationRequests">["status"], string> = {
  draft: "Draft",
  pending_freelancer_response: "Freelancer response",
  approved_for_cancel: "Approved",
  rejected_by_freelancer: "Rejected",
  cancel_pending_on_chain: "On-chain pending",
  cancelled_on_chain: "Cancelled",
  cancel_failed: "Retry needed",
  blocked: "Blocked",
  expired: "Expired",
  withdrawn: "Withdrawn",
};

export function CancellationStatusBadge({ status }: ICancellationStatusBadgeProps) {
  const tone =
    status === "cancelled_on_chain"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "cancel_failed" || status === "blocked" || status === "rejected_by_freelancer"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "pending_freelancer_response" || status === "cancel_pending_on_chain"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-[#d8d8d8] bg-white text-[#3f3f3f]";

  return (
    <Badge variant="outline" className={`rounded-md font-mono text-[11px] ${tone}`}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
