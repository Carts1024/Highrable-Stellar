"use client";

import { Spinner } from "@repo/ui/components/ui/spinner";
import React from "react";

import type { TMarketplaceEscrowProgress } from "../types";

const PROGRESS_LABELS: Record<TMarketplaceEscrowProgress, string> = {
  preparing: "Preparing transaction…",
  simulating: "Checking the transaction…",
  awaiting_signature: "Waiting for your wallet signature…",
  submitting: "Submitting to Stellar…",
  confirming: "Waiting for Stellar confirmation…",
  recovering_escrow_id: "Recovering the payment hold ID…",
  recording: "Recording the confirmed payment hold…",
};

export function EscrowActionProgress({
  progress,
}: {
  progress: TMarketplaceEscrowProgress | null;
}) {
  if (!progress) {
    return null;
  }

  return (
    <p
      className="flex items-center gap-2 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
      <span>{PROGRESS_LABELS[progress]}</span>
    </p>
  );
}
