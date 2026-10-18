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
        : "border-amber-300 bg-amber-100 text-amber-900";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase ${className}`}
    >
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
  const effectiveOutcome =
    status === "marked" && localOutcome === "pending" ? undefined : localOutcome;
  const className =
    status === "marked" && !effectiveOutcome
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "mark_failed" && !effectiveOutcome
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-[#d8d8d8] bg-[#fafafa] text-[#5f5f5f]";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase ${className}`}
    >
      Chain:{" "}
      {effectiveOutcome === "pending"
        ? "Outcome Pending"
        : effectiveOutcome === "confirmed_sync_pending"
          ? "Recording Confirmation"
          : (status === "mark_failed" || status === "not_marked") && transactionHash
            ? "Reconciliation Required"
            : getDisputeOnChainStatusLabel(status)}
    </span>
  );
}
