"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import React from "react";

import type { TDisputeOnChainStatus } from "../types";

export type TLocalMarkOutcome =
  | { kind: "pending"; transactionHash?: string }
  | { kind: "confirmed_sync_pending"; transactionHash: string; recordingFailed?: boolean };

export function getDisputeMarkingPresentation(
  status: TDisputeOnChainStatus,
  transactionHash?: string,
  localOutcome?: TLocalMarkOutcome | null,
  terminal = false,
) {
  if (status === "marked") {
    return {
      message: "Escrow dispute marking is confirmed on Stellar.",
      transactionHash,
      canRetry: false,
      tone: "success" as const,
    };
  }
  if (localOutcome?.kind === "confirmed_sync_pending") {
    return {
      message:
        "Stellar confirmed this transaction. Highrable is still recording the result. Do not submit another transaction.",
      transactionHash: localOutcome.transactionHash,
      canRetry: false,
      tone: "pending" as const,
    };
  }
  if (localOutcome?.kind === "pending") {
    return {
      message:
        "The transaction outcome is uncertain. Check Stellar Expert or wait for reconciliation before trying again.",
      transactionHash: localOutcome.transactionHash ?? transactionHash,
      canRetry: false,
      tone: "pending" as const,
    };
  }
  if (status === "marking") {
    return {
      message:
        "Escrow dispute marking is pending. Do not start another transaction until its outcome is known.",
      transactionHash,
      canRetry: false,
      tone: "pending" as const,
    };
  }
  if (status === "mark_failed" && transactionHash) {
    return {
      message:
        "The marking attempt has a recorded transaction hash. Reconcile its outcome before retrying.",
      transactionHash,
      canRetry: false,
      tone: "warning" as const,
    };
  }
  return {
    message:
      status === "mark_failed"
        ? terminal
          ? "Escrow dispute marking failed before a transaction hash was recorded. This dispute is closed."
          : "Escrow dispute marking failed before a transaction hash was recorded. You can retry."
        : terminal
          ? "The dispute is closed without a recorded escrow marking transaction."
          : "The dispute is saved, but escrow marking has not started. You can start it now.",
    transactionHash: undefined,
    canRetry: !terminal,
    tone: status === "mark_failed" ? ("warning" as const) : ("pending" as const),
  };
}

export function DisputeMarkingStatus({
  status,
  transactionHash,
  localOutcome,
  retryPhase,
  retryError,
  onRetry,
  onRetryRecording,
  terminal = false,
}: {
  readonly status: TDisputeOnChainStatus;
  readonly transactionHash?: string;
  readonly localOutcome?: TLocalMarkOutcome | null;
  readonly retryPhase: string | null;
  readonly retryError: string | null;
  readonly onRetry: () => void;
  readonly onRetryRecording?: () => void;
  readonly terminal?: boolean;
}) {
  const presentation = getDisputeMarkingPresentation(
    status,
    transactionHash,
    localOutcome,
    terminal,
  );
  const toneClass =
    presentation.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : presentation.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-[#d8d8d8] bg-[#fafafa] text-[#3f3f3f]";
  const hash = presentation.transactionHash?.trim();
  const pendingOutcomeReconciled = status === "marked" && localOutcome?.kind === "pending";

  return (
    <div className={`mt-4 space-y-3 rounded-lg border p-3 text-sm ${toneClass}`}>
      <p>{presentation.message}</p>
      {retryPhase ? <p role="status">{retryPhase}</p> : null}
      {retryError && !pendingOutcomeReconciled ? <p role="alert">{retryError}</p> : null}
      {hash ? (
        <AppButton asChild variant="secondary" size="sm">
          <a href={getTxExplorerUrl(hash)} target="_blank" rel="noopener noreferrer">
            View transaction on Stellar Expert
          </a>
        </AppButton>
      ) : null}
      {presentation.canRetry ? (
        <AppButton type="button" size="sm" disabled={Boolean(retryPhase)} onClick={onRetry}>
          {retryPhase ? "Marking escrow..." : "Retry escrow marking"}
        </AppButton>
      ) : null}
      {localOutcome?.kind === "confirmed_sync_pending" &&
      localOutcome.recordingFailed &&
      onRetryRecording ? (
        <AppButton
          type="button"
          size="sm"
          disabled={Boolean(retryPhase)}
          onClick={onRetryRecording}
        >
          {retryPhase ? "Recording..." : "Retry recording confirmation"}
        </AppButton>
      ) : null}
    </div>
  );
}
