"use client";

import { UsdcOnboardingCard } from "@/core/stellar/components/usdc-onboarding-card";
import { useUsdcTrustline } from "@/core/stellar/hooks/use-usdc-trustline";
import { AppButton } from "@/core/ui/button";
import { AppInput } from "@/core/ui/input";
import { AppTextarea } from "@/core/ui/textarea";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { sanitizeMultilineInput } from "@/features/common";
import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { useEscrowActions } from "@/features/marketplace/hooks/use-escrow-actions";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import { useRef, useState } from "react";
import { z } from "zod";

import type { TEscrowStatus, TJobStatus } from "@/features/marketplace/types";
import type { TConvexDoc } from "@repo/convex-client";

import { EscrowSection } from "./escrow-section";
import { StatusBadge } from "./status-badge";

const RELEASE_REVIEW_SCHEMA = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z
    .string()
    .transform(sanitizeMultilineInput)
    .pipe(z.string().max(1000, "Review text must be under 1000 characters.")),
});

interface ITransactionStatusProps {
  readonly error: string | null;
  readonly success: string | null;
  readonly txExplorerUrl: string | null;
}

interface IEscrowActionPanelProps {
  readonly job: TConvexDoc<"jobs">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly applications: TConvexDoc<"applications">[];
}

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

function TransactionStatus({ error, success, txExplorerUrl }: ITransactionStatusProps) {
  if (!error && !success && !txExplorerUrl) {
    return null;
  }

  return (
    <div
      className="mt-4 space-y-2"
      role="region"
      aria-live="polite"
      aria-label="Transaction status"
    >
      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
          aria-atomic="true"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
          aria-atomic="true"
        >
          {success}
        </p>
      ) : null}
      {txExplorerUrl ? (
        <a
          href={txExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900"
          aria-label="View transaction in Stellar Testnet Explorer (opens in new window)"
        >
          View on Stellar Explorer
        </a>
      ) : null}
    </div>
  );
}

export function EscrowActionPanel({ job, escrow, applications }: IEscrowActionPanelProps) {
  const [releaseRating, setReleaseRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [releaseInputError, setReleaseInputError] = useState<string | null>(null);
  const releaseInputErrorId = "release-input-error";
  const ratingInputRef = useRef<HTMLInputElement>(null);
  const reviewInputRef = useRef<HTMLTextAreaElement>(null);

  const { address, walletState, fundTestnetAccount } = useWallet();
  const usdcTrustline = useUsdcTrustline(address);
  const reputationRecord = useQuery(
    api.reputation.getReputationByEscrowId,
    escrow?.escrowId ? { escrowId: escrow.escrowId } : "skip",
  );
  const { isSyncing, syncMessage, syncResult, syncReputationRecord } = useSyncActions({ escrow });
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
  const hasReleasedCompletion = currentStatus === "released" || currentStatus === "completed";
  const showPendingVerifiedSync =
    hasReleasedCompletion && escrow?.status === "released" && reputationRecord === null;

  const handleApproveAndRelease = async () => {
    const parsed = RELEASE_REVIEW_SCHEMA.safeParse({
      rating: releaseRating,
      reviewText,
    });

    if (!parsed.success) {
      setReleaseInputError(parsed.error.issues[0]?.message ?? "Release inputs are invalid.");
      ratingInputRef.current?.focus();
      return;
    }

    setReleaseInputError(null);
    await approveAndRelease({
      rating: parsed.data.rating,
      reviewText: parsed.data.reviewText,
    });
  };

  return (
    <section
      className="rounded-2xl border border-[#e8e8e8] bg-white p-5 shadow-sm"
      aria-label="Escrow lifecycle and actions"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#0a0a0a]">Escrow Management</h2>
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
        <p className="text-sm text-[#5f5f5f]">
          Waiting for client to select a freelancer. Once selected, escrow setup will begin.
        </p>
      ) : null}

      {currentStatus === "selected" && !escrow ? (
        <EscrowSection
          ariaLabel="Create escrow action"
          role={role}
          allowedRoles={["client", "selectedFreelancer", "other"]}
          helperText={
            role === "client"
              ? "Create a Stellar escrow record to secure payments during the project."
              : undefined
          }
          warningText={
            role === "selectedFreelancer"
              ? "Waiting for client to create and fund escrow. Do not start work until payment is confirmed."
              : undefined
          }
          infoText={
            role !== "client" && role !== "selectedFreelancer"
              ? "Client has selected a freelancer. Escrow setup begins next."
              : undefined
          }
        >
          {role === "client" ? (
            <AppButton
              type="button"
              disabled={isPending}
              onClick={() => void createEscrow()}
              className="disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Create escrow for selected freelancer"
            >
              {getActionButtonLabel(
                "Create Escrow",
                pendingAction === "create_escrow",
                "Creating Escrow...",
              )}
            </AppButton>
          ) : null}
        </EscrowSection>
      ) : null}

      {currentStatus === "created" ? (
        <EscrowSection
          ariaLabel="Fund escrow action"
          role={role}
          allowedRoles={["client", "selectedFreelancer"]}
          helperText={
            role === "client"
              ? "Lock funds in escrow. Once funded, the freelancer can begin work."
              : undefined
          }
          warningText={
            role === "selectedFreelancer"
              ? "Escrow created. Waiting for client to fund and confirm work can begin."
              : usdcTrustline.hasTrustline !== true
                ? "Enable USDC payments in your wallet settings to proceed."
                : undefined
          }
        >
          {role === "client" ? (
            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                disabled={isUsdcActionDisabled}
                onClick={() => void fundEscrow()}
                className="disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Fund escrow and lock payment"
              >
                {getActionButtonLabel(
                  "Fund Escrow",
                  pendingAction === "fund_escrow",
                  "Funding Escrow...",
                )}
              </AppButton>
              <AppButton
                type="button"
                appVariant="secondary"
                disabled={isPending}
                onClick={() => void cancelEscrow()}
                className="disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cancel escrow and reset project"
              >
                {getActionButtonLabel("Cancel", pendingAction === "cancel_escrow", "Cancelling...")}
              </AppButton>
            </div>
          ) : null}
        </EscrowSection>
      ) : null}

      {currentStatus === "funded" ? (
        <EscrowSection
          ariaLabel="Submit work action"
          role={role}
          allowedRoles={["selectedFreelancer", "client"]}
          helperText={
            role === "selectedFreelancer"
              ? "Submit completed work. Client will review and approve payment release."
              : role === "client"
                ? "Escrow funded and locked. Waiting for freelancer to submit work."
                : undefined
          }
        >
          {role === "selectedFreelancer" ? (
            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                disabled={isPending}
                onClick={() => void submitWork()}
                className="disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Submit completed work for client review"
              >
                {getActionButtonLabel(
                  "Submit Work",
                  pendingAction === "submit_work",
                  "Submitting Work...",
                )}
              </AppButton>
              <AppButton
                type="button"
                appVariant="secondary"
                disabled={isPending}
                onClick={() => void markDisputed()}
                className="rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Dispute escrow if there are issues"
              >
                {getActionButtonLabel(
                  "Dispute",
                  pendingAction === "mark_disputed",
                  "Marking Disputed...",
                )}
              </AppButton>
            </div>
          ) : null}

          {role === "client" ? (
            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                appVariant="secondary"
                disabled={isPending}
                onClick={() => void cancelEscrow()}
                className="disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cancel escrow and refund freelancer"
              >
                {getActionButtonLabel("Cancel", pendingAction === "cancel_escrow", "Cancelling...")}
              </AppButton>
              <AppButton
                type="button"
                appVariant="secondary"
                disabled={isPending}
                onClick={() => void markDisputed()}
                className="rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Mark escrow as disputed"
              >
                {getActionButtonLabel(
                  "Dispute",
                  pendingAction === "mark_disputed",
                  "Marking Disputed...",
                )}
              </AppButton>
            </div>
          ) : null}
        </EscrowSection>
      ) : null}

      {currentStatus === "submitted" ? (
        <EscrowSection
          ariaLabel="Approve and release payment action"
          role={role}
          allowedRoles={["client", "selectedFreelancer"]}
          warningText={
            role === "selectedFreelancer"
              ? "Work submitted. Waiting for client to review and approve payment."
              : usdcTrustline.hasTrustline !== true
                ? "Enable USDC payments to release funds."
                : undefined
          }
        >
          {role === "client" ? (
            <>
              <div className="grid gap-3 sm:max-w-md">
                <label
                  htmlFor="release-rating"
                  className="grid gap-1 text-sm font-medium text-[#0a0a0a]"
                >
                  Rating (1–5 stars)
                  <AppInput
                    ref={ratingInputRef}
                    id="release-rating"
                    type="number"
                    min={1}
                    max={5}
                    value={releaseRating}
                    disabled={isPending}
                    onChange={(event) => {
                      setReleaseRating(Number(event.target.value));
                      setReleaseInputError(null);
                    }}
                    aria-label="Rating for freelancer performance"
                    aria-errormessage={releaseInputErrorId}
                    aria-invalid={releaseInputError !== null}
                  />
                </label>
                <label
                  htmlFor="release-review"
                  className="grid gap-1 text-sm font-medium text-[#0a0a0a]"
                >
                  Feedback (optional)
                  <AppTextarea
                    ref={reviewInputRef}
                    id="release-review"
                    value={reviewText}
                    disabled={isPending}
                    maxLength={1000}
                    onChange={(event) => {
                      setReviewText(event.target.value);
                      setReleaseInputError(null);
                    }}
                    rows={3}
                    placeholder="Share feedback about the work quality"
                    aria-label="Review text for freelancer work"
                    aria-errormessage={releaseInputErrorId}
                    aria-invalid={releaseInputError !== null}
                  />
                </label>
              </div>

              {releaseInputError ? (
                <p
                  id={releaseInputErrorId}
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  role="alert"
                  aria-atomic="true"
                >
                  {releaseInputError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  disabled={isUsdcActionDisabled}
                  onClick={() => void handleApproveAndRelease()}
                  className="disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Approve work and release payment to freelancer"
                >
                  {getActionButtonLabel(
                    "Release Payment",
                    pendingAction === "release_payment",
                    "Releasing Payment...",
                  )}
                </AppButton>
                <AppButton
                  type="button"
                  appVariant="secondary"
                  disabled={isPending}
                  onClick={() => void markDisputed()}
                  className="rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Dispute if work does not meet requirements"
                >
                  {getActionButtonLabel(
                    "Dispute",
                    pendingAction === "mark_disputed",
                    "Marking Disputed...",
                  )}
                </AppButton>
              </div>
            </>
          ) : null}

          {role === "selectedFreelancer" ? (
            <AppButton
              type="button"
              appVariant="secondary"
              disabled={isPending}
              onClick={() => void markDisputed()}
              className="rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Dispute escrow if there are concerns"
            >
              {getActionButtonLabel(
                "Dispute",
                pendingAction === "mark_disputed",
                "Marking Disputed...",
              )}
            </AppButton>
          ) : null}
        </EscrowSection>
      ) : null}

      {hasReleasedCompletion ? (
        <div
          className="space-y-3"
          role="region"
          aria-label="Payment completion and reputation record"
        >
          <p className="text-sm font-medium text-emerald-800">✓ Payment released successfully.</p>

          {escrow && reputationRecord ? (
            <VerifiedReviewCard
              compact
              jobTitle={job.title}
              escrowId={escrow.escrowId}
              clientWallet={escrow.clientWallet}
              freelancerWallet={escrow.freelancerWallet}
              amount={escrow.amount}
              asset={escrow.asset}
              rating={reputationRecord.rating}
              reviewText={reputationRecord.reviewText}
              reviewHash={reputationRecord.reviewHash}
              txHash={reputationRecord.txHash ?? escrow.releaseTxHash}
              createdAt={reputationRecord.createdAt}
            />
          ) : null}

          {showPendingVerifiedSync ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>
                Payment released. The verified reputation record is syncing from Stellar blockchain.
              </p>
              <AppButton
                type="button"
                appVariant="secondary"
                disabled={isSyncing}
                onClick={() => void syncReputationRecord()}
                className="h-8 rounded-lg border-amber-300 px-3 py-1.5 text-xs hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Manually sync reputation record from blockchain"
              >
                {isSyncing ? "Syncing..." : "Sync Reputation"}
              </AppButton>
              {syncMessage ? (
                <p
                  className={`text-xs ${syncResult?.ok ? "text-emerald-700" : "text-red-700"}`}
                  role={syncResult?.ok ? "status" : "alert"}
                >
                  {syncMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {escrow && reputationRecord === undefined ? (
            <p className="text-sm text-gray-500">Loading verified reputation record...</p>
          ) : null}
        </div>
      ) : null}

      {currentStatus === "cancelled" ? (
        <p className="text-sm text-[#5f5f5f]">Escrow cancelled. No funds were exchanged.</p>
      ) : null}

      {currentStatus === "disputed" ? (
        <p className="text-sm text-red-700" role="alert">
          ⚠ Escrow disputed. A moderator will review this case shortly.
        </p>
      ) : null}

      <TransactionStatus error={error} success={success} txExplorerUrl={txExplorerUrl} />
    </section>
  );
}
