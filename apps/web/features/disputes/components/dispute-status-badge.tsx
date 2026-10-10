"use client";

import React from "react";

import type { TDisputeOnChainStatus, TDisputeStatus } from "../types";

import {
  getDisputeOnChainStatusLabel,
  getDisputeStatusLabel,
  isTerminalDisputeStatus,
} from "../lib";

export function DisputeStatusBadge({ status }: { readonly status: TDisputeStatus }) {
  const className =
    status === "cancelled"
      ? "border-[#d8d8d8] bg-[#f5f5f5] text-[#5f5f5f]"
      : isTerminalDisputeStatus(status)
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-[#FF7003]/30 bg-orange-50 text-[#9a3f00]";

  return (
    <span className={`rounded-md border px-2 py-1 font-mono text-xs uppercase ${className}`}>
      {getDisputeStatusLabel(status)}
    </span>
  );
}

export function DisputeOnChainStatusBadge({
  status,
  transactionHash,
  localOutcome,
}: {
  readonly status: TDisputeOnChainStatus;
  readonly transactionHash?: string;
  readonly localOutcome?: "pending" | "confirmed_sync_pending";
}) {
  const className =
    status === "marked"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "mark_failed" && !localOutcome
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-[#d8d8d8] bg-[#fafafa] text-[#5f5f5f]";

  return (
    <span className={`rounded-md border px-2 py-1 font-mono text-xs uppercase ${className}`}>
      Chain:{" "}
      {status === "marked"
        ? getDisputeOnChainStatusLabel(status)
        : localOutcome === "pending"
          ? "Outcome Pending"
          : localOutcome === "confirmed_sync_pending"
            ? "Recording Confirmation"
            : status === "mark_failed" && transactionHash
              ? "Reconciliation Required"
              : getDisputeOnChainStatusLabel(status)}
    </span>
  );
}
