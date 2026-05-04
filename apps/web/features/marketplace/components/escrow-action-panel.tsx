"use client";

import { UsdcOnboardingCard } from "@/core/stellar/components/usdc-onboarding-card";
import { useUsdcTrustline } from "@/core/stellar/hooks/use-usdc-trustline";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { useEscrowActions } from "@/features/marketplace/hooks/use-escrow-actions";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { useState } from "react";

import type { TEscrowStatus, TJobStatus } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

import { StatusBadge } from "./status-badge";

function getCurrentStatus(
  job: TConvexDoc<"jobs">,
  escrow: TConvexDoc<"escrows"> | null | undefined,
): TJobStatus | TEscrowStatus {
  if (escrow) {
    return escrow.status;
  }

  return job.status;
}

function getActionButtonLabel(label: string, isPending: boolean, pendingLabel: string): string {
  return isPending ? pendingLabel : label;
}

function TransactionStatus({
  error,
  success,
  txExplorerUrl,
}: {
  error: string | null;
  success: string | null;
  txExplorerUrl: string | null;
}) {
  if (!error && !success && !txExplorerUrl) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}
      {txExplorerUrl ? (
        <a
          href={txExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          View transaction in Stellar explorer
        </a>
      ) : null}
    </div>
  );
}

function SyncStatusSection({ escrow }: { escrow: TConvexDoc<"escrows"> }) {
  const { isSyncing, syncMessage, syncResult, syncEscrowAndReputation, syncReputationRecord } =
    useSyncActions({ escrow });

  const isReleased = escrow.status === "released";
  const syncButtonClass =
    "rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400";

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="mb-2 text-xs font-medium tracking-wide text-gray-400 uppercase">
        Sync Utilities
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isSyncing}
          onClick={() => void syncEscrowAndReputation()}
          className={syncButtonClass}
        >
          {isSyncing ? "Syncing…" : "Sync Escrow Status"}
        </button>

        {isReleased ? (
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => void syncReputationRecord()}
            className={syncButtonClass}
          >
            {isSyncing ? "Syncing…" : "Sync Reputation Record"}
          </button>
        ) : null}
      </div>

      {syncMessage ? (
        <p className={`mt-2 text-xs ${syncResult?.ok ? "text-emerald-700" : "text-red-600"}`}>
          {syncMessage}
        </p>
      ) : null}
    </div>
  );
}

export function EscrowActionPanel({
  job,
  escrow,
  applications,
}: {
  job: TConvexDoc<"jobs">;
  escrow: TConvexDoc<"escrows"> | null | undefined;
  applications: TConvexDoc<"applications">[];
}) {
  const [releaseRating, setReleaseRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const { address, walletState, fundTestnetAccount } = useWallet();
  const usdcTrustline = useUsdcTrustline(address);
  const {
    role,
    isPending,
    pendingAction,
    error,
    success,
    txExplorerUrl,
    createEscrow,
    fundEscrow,
    submitWork,
    approveAndRelease,
    cancelEscrow,
    markDisputed,
  } = useEscrowActions({
    job,
    escrow,
    applications,
    hasUsdcPaymentsEnabled: usdcTrustline.hasTrustline,
  });
  const currentStatus = getCurrentStatus(job, escrow);
  const showUsdcOnboarding =
    walletState.isConnected && (usdcTrustline.isChecking || usdcTrustline.hasTrustline === false);
  const isUsdcActionDisabled = isPending || usdcTrustline.hasTrustline !== true;
  const buttonClass =
    "rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500";
  const secondaryButtonClass =
    "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400";
  const dangerButtonClass =
    "rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Escrow Action Panel</h2>
        <StatusBadge label={currentStatus} />
      </div>

      {showUsdcOnboarding ? (
        <div className="mb-4">
          <UsdcOnboardingCard
            isChecking={usdcTrustline.isChecking}
            isEnabling={usdcTrustline.isEnabling}
            isEnabled={usdcTrustline.hasTrustline === true}
            error={usdcTrustline.error}
            isWalletFunded={walletState.isFunded}
            onEnable={() => void usdcTrustline.enableUsdcPayments()}
            onFundTestnetAccount={() => void fundTestnetAccount()}
            onRefresh={() => void usdcTrustline.refreshTrustlineStatus()}
          />
        </div>
      ) : null}

      {currentStatus === "open" ? (
        <p className="text-sm text-gray-700">Waiting for client to select a freelancer.</p>
      ) : null}

      {currentStatus === "selected" && !escrow ? (
        <div className="space-y-3">
          {role === "client" ? (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => void createEscrow()}
                className={buttonClass}
              >
                {getActionButtonLabel(
                  "Create Escrow",
                  pendingAction === "create_escrow",
                  "Creating Escrow...",
                )}
              </button>
              <p className="text-sm text-gray-600">
                Creates the Stellar escrow record for the selected freelancer.
              </p>
            </>
          ) : null}

          {role === "selectedFreelancer" ? (
            <p className="text-sm text-amber-800">
              Waiting for client to create and fund escrow. Do not start work yet.
            </p>
          ) : null}

          {role !== "client" && role !== "selectedFreelancer" ? (
            <p className="text-sm text-gray-700">
              Client has selected a freelancer. Escrow setup is next.
            </p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "created" ? (
        <div className="space-y-3">
          {role === "client" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isUsdcActionDisabled}
                  onClick={() => void fundEscrow()}
                  className={buttonClass}
                >
                  {getActionButtonLabel(
                    "Fund Escrow",
                    pendingAction === "fund_escrow",
                    "Funding Escrow...",
                  )}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void cancelEscrow()}
                  className={secondaryButtonClass}
                >
                  {getActionButtonLabel(
                    "Cancel Escrow",
                    pendingAction === "cancel_escrow",
                    "Cancelling...",
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-600">
                Verified funded means the client has locked mock USDC on Stellar.
              </p>
              {usdcTrustline.hasTrustline !== true ? (
                <p className="text-sm text-amber-800">Enable USDC payments before using escrow.</p>
              ) : null}
            </>
          ) : null}

          {role === "selectedFreelancer" ? (
            <p className="text-sm text-amber-800">Escrow created. Waiting for client to fund.</p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "funded" ? (
        <div className="space-y-3">
          {role === "selectedFreelancer" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void submitWork()}
                  className={buttonClass}
                >
                  {getActionButtonLabel(
                    "Submit Work",
                    pendingAction === "submit_work",
                    "Submitting Work...",
                  )}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void markDisputed()}
                  className={dangerButtonClass}
                >
                  {getActionButtonLabel(
                    "Mark Disputed",
                    pendingAction === "mark_disputed",
                    "Marking Disputed...",
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-600">
                Submit only after the funded escrow covers the agreed work.
              </p>
            </>
          ) : null}

          {role === "client" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Escrow funded. Waiting for freelancer submission.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void cancelEscrow()}
                  className={secondaryButtonClass}
                >
                  {getActionButtonLabel(
                    "Cancel Escrow",
                    pendingAction === "cancel_escrow",
                    "Cancelling...",
                  )}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void markDisputed()}
                  className={dangerButtonClass}
                >
                  {getActionButtonLabel(
                    "Mark Disputed",
                    pendingAction === "mark_disputed",
                    "Marking Disputed...",
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {role !== "client" && role !== "selectedFreelancer" ? (
            <p className="text-sm text-gray-700">
              Verified funded means the client has locked funds on Stellar.
            </p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "submitted" ? (
        <div className="space-y-3">
          {role === "client" ? (
            <>
              <div className="grid gap-3 sm:max-w-md">
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Release rating
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={releaseRating}
                    disabled={isPending}
                    onChange={(event) => setReleaseRating(Number(event.target.value))}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-gray-700">
                  Review text
                  <textarea
                    value={reviewText}
                    disabled={isPending}
                    onChange={(event) => setReviewText(event.target.value)}
                    rows={3}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    placeholder="Optional verified review"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isUsdcActionDisabled}
                  onClick={() =>
                    void approveAndRelease({
                      rating: releaseRating,
                      reviewText,
                    })
                  }
                  className={buttonClass}
                >
                  {getActionButtonLabel(
                    "Approve and Release",
                    pendingAction === "release_payment",
                    "Releasing Payment...",
                  )}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void markDisputed()}
                  className={dangerButtonClass}
                >
                  {getActionButtonLabel(
                    "Mark Disputed",
                    pendingAction === "mark_disputed",
                    "Marking Disputed...",
                  )}
                </button>
              </div>
              {usdcTrustline.hasTrustline !== true ? (
                <p className="text-sm text-amber-800">Enable USDC payments before using escrow.</p>
              ) : null}
            </>
          ) : null}

          {role === "selectedFreelancer" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">Work submitted. Waiting for client approval.</p>
              <button
                type="button"
                disabled={isPending}
                onClick={() => void markDisputed()}
                className={dangerButtonClass}
              >
                {getActionButtonLabel(
                  "Mark Disputed",
                  pendingAction === "mark_disputed",
                  "Marking Disputed...",
                )}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "released" || currentStatus === "completed" ? (
        <div className="space-y-2 text-sm text-emerald-800">
          <p>Paid. Verified review recorded.</p>
        </div>
      ) : null}

      {currentStatus === "cancelled" ? (
        <p className="text-sm text-gray-700">Escrow cancelled.</p>
      ) : null}

      {currentStatus === "disputed" ? (
        <p className="text-sm text-red-700">Escrow disputed. Manual review required.</p>
      ) : null}

      <TransactionStatus error={error} success={success} txExplorerUrl={txExplorerUrl} />

      {escrow ? <SyncStatusSection escrow={escrow} /> : null}
    </section>
  );
}
