"use client";

import type { TDisputeOnChainStatus, TDisputeStatus } from "../types";

import { getDisputeOnChainStatusLabel, getDisputeStatusLabel } from "../lib";

export function DisputeStatusBadge({ status }: { readonly status: TDisputeStatus }) {
  const className =
    status === "cancelled"
      ? "border-[#d8d8d8] bg-[#f5f5f5] text-[#5f5f5f]"
      : status.startsWith("resolved") || status === "split_resolution"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-[#FF7003]/30 bg-orange-50 text-[#9a3f00]";

  return (
    <span className={`rounded-md border px-2 py-1 font-mono text-xs uppercase ${className}`}>
      {getDisputeStatusLabel(status)}
    </span>
  );
}

export function DisputeOnChainStatusBadge({ status }: { readonly status: TDisputeOnChainStatus }) {
  const className =
    status === "marked"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "mark_failed"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-[#d8d8d8] bg-[#fafafa] text-[#5f5f5f]";

  return (
    <span className={`rounded-md border px-2 py-1 font-mono text-xs uppercase ${className}`}>
      Chain: {getDisputeOnChainStatusLabel(status)}
    </span>
  );
}
