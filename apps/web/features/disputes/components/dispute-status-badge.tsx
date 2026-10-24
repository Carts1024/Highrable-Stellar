"use client";

import { StatusText } from "@/features/common/components/status-text";
import React from "react";

import type { TDisputeOnChainStatus, TDisputeStatus } from "../types";

import {
  getDisputeOnChainStatusLabel,
  getDisputeStatusLabel,
  isTerminalDisputeStatus,
} from "../lib";

export function DisputeStatusBadge({ status }: { readonly status: TDisputeStatus }) {
  const tone =
    status === "cancelled" ? "neutral" : isTerminalDisputeStatus(status) ? "success" : "warning";

  return <StatusText tone={tone}>{getDisputeStatusLabel(status)}</StatusText>;
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
  const tone =
    status === "marked" && !effectiveOutcome
      ? "success"
      : status === "mark_failed" && !effectiveOutcome
        ? "danger"
        : "neutral";

  return (
    <StatusText tone={tone}>
      Chain:{" "}
      {effectiveOutcome === "pending"
        ? "Outcome Pending"
        : effectiveOutcome === "confirmed_sync_pending"
          ? "Recording Confirmation"
          : (status === "mark_failed" || status === "not_marked") && transactionHash
            ? "Reconciliation Required"
            : getDisputeOnChainStatusLabel(status)}
    </StatusText>
  );
}
