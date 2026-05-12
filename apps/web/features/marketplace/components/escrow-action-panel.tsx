"use client";

import { UsdcOnboardingCard } from "@/core/stellar/components/usdc-onboarding-card";
import { useStablecoinReadiness } from "@/core/stellar/hooks/use-stablecoin-readiness";
import { useUsdcTrustline } from "@/core/stellar/hooks/use-usdc-trustline";
import { AppButton } from "@/core/ui/button";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { useEscrowActions } from "@/features/marketplace/hooks/use-escrow-actions";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { getEscrowActionGuard } from "@/features/marketplace/lib/escrow-action-guards";
import {
  getMarketplaceStatus,
  getMarketplaceStatusMeta,
} from "@/features/marketplace/lib/escrow-status";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import type { TConvexDoc } from "@repo/convex-client";

import { EscrowSection } from "./escrow-section";
import { ReleasePaymentDialog } from "./release-payment-dialog";
import { StablecoinReadinessCard } from "./stablecoin-readiness-card";
import { StatusBadge } from "./status-badge";
import { TransactionStatusBanner } from "./transaction-status-banner";
import { TrustWarning } from "./trust-warning";

interface IEscrowActionPanelProps {
  readonly job: TConvexDoc<"jobs">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly applications: TConvexDoc<"applications">[];
}

function getActionButtonLabel(label: string, isPending: boolean, pendingLabel: string): string {
  return isPending ? pendingLabel : label;
}

export function EscrowActionPanel({ job, escrow, applications }: IEscrowActionPanelProps) {
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);

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

  const currentStatus = getMarketplaceStatus(job.status, escrow?.status);
  const currentStatusMeta = getMarketplaceStatusMeta(currentStatus);
  const actionGuards = useMemo(
    () => ({
      createEscrow: getEscrowActionGuard({
        action: "create_escrow",
        role,
        job,
        escrow,
        wallet: {
          isConnected: walletState.isConnected,
          isTestnet: walletState.isTestnet,
          isFunded: walletState.isFunded,
          canWriteContracts: walletState.canWriteContracts,
        },
      }),
      fundEscrow: getEscrowActionGuard({
        action: "fund_escrow",
        role,
        job,
        escrow,
        wallet: {
          isConnected: walletState.isConnected,
          isTestnet: walletState.isTestnet,
          isFunded: walletState.isFunded,
          canWriteContracts: walletState.canWriteContracts,
        },
        hasUsdcPaymentsEnabled: usdcTrustline.hasTrustline,
      }),
      submitWork: getEscrowActionGuard({
        action: "submit_work",
        role,
        job,
        escrow,
        wallet: {
          isConnected: walletState.isConnected,
          isTestnet: walletState.isTestnet,
          isFunded: walletState.isFunded,
          canWriteContracts: walletState.canWriteContracts,
        },
      }),
      releasePayment: getEscrowActionGuard({
        action: "release_payment",
        role,
        job,
        escrow,
        wallet: {
          isConnected: walletState.isConnected,
          isTestnet: walletState.isTestnet,
          isFunded: walletState.isFunded,
          canWriteContracts: walletState.canWriteContracts,
        },
        hasUsdcPaymentsEnabled: usdcTrustline.hasTrustline,
      }),
      cancelEscrow: getEscrowActionGuard({
        action: "cancel_escrow",
        role,
        job,
        escrow,
        wallet: {
          isConnected: walletState.isConnected,
          isTestnet: walletState.isTestnet,
          isFunded: walletState.isFunded,
          canWriteContracts: walletState.canWriteContracts,
        },
      }),
      markDisputed: getEscrowActionGuard({
        action: "mark_disputed",
        role,
        job,
        escrow,
        wallet: {
          isConnected: walletState.isConnected,
          isTestnet: walletState.isTestnet,
          isFunded: walletState.isFunded,
          canWriteContracts: walletState.canWriteContracts,
        },
      }),
    }),
    [
      escrow,
      job,
      role,
      usdcTrustline.hasTrustline,
      walletState.isConnected,
      walletState.canWriteContracts,
      walletState.isFunded,
      walletState.isTestnet,
    ],
  );
  const showUsdcOnboarding =
    walletState.isConnected && (usdcTrustline.isChecking || usdcTrustline.hasTrustline === false);
  const stablecoinReadiness = useStablecoinReadiness({
    walletAddress: address,
    requiredAmount: job.budget,
    enabled:
      currentStatus === "created" &&
      role === "client" &&
      walletState.isConnected &&
      walletState.isTestnet &&
      usdcTrustline.hasTrustline === true,
  });
  const isFundEscrowDisabled =
    isPending ||
    !actionGuards.fundEscrow.canAct ||
    stablecoinReadiness.hasSufficientBalance === false;
  const hasReleasedCompletion = currentStatus === "released" || currentStatus === "completed";
  const showPendingVerifiedSync =
    hasReleasedCompletion && escrow?.status === "released" && reputationRecord === null;

  const handleConfirmRelease = async ({
    rating,
    reviewText,
  }: {
    rating: number;
    reviewText: string;
  }) => {
    const releaseSucceeded = await approveAndRelease({ rating, reviewText });

    if (releaseSucceeded) {
      setIsReleaseDialogOpen(false);
    }
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

      <p className="text-sm text-[#5f5f5f]">{currentStatusMeta.description}</p>
      {currentStatusMeta.trustWarning ? (
        <TrustWarning className="mt-2" message={currentStatusMeta.trustWarning} />
      ) : null}

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
              : role === "client" && !actionGuards.createEscrow.canAct
                ? actionGuards.createEscrow.reason
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
              disabled={isPending || !actionGuards.createEscrow.canAct}
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
              : role === "client" && stablecoinReadiness.hasSufficientBalance === false
                ? `Insufficient stablecoin balance. Add at least ${stablecoinReadiness.deficitDisplay ?? "0"} USDC.`
                : role === "client" && stablecoinReadiness.error
                  ? stablecoinReadiness.error
                  : role === "client" && !actionGuards.fundEscrow.canAct
                    ? actionGuards.fundEscrow.reason
                    : undefined
          }
        >
          {role === "client" ? (
            <div className="space-y-3">
              {usdcTrustline.hasTrustline === true ? (
                <StablecoinReadinessCard
                  requiredAmount={stablecoinReadiness.requiredAmountDisplay}
                  walletBalance={stablecoinReadiness.balanceDisplay}
                  deficitAmount={stablecoinReadiness.deficitDisplay}
                  hasSufficientBalance={stablecoinReadiness.hasSufficientBalance}
                  isLoading={stablecoinReadiness.isLoading}
                  error={stablecoinReadiness.error}
                  onRefresh={() => void stablecoinReadiness.refresh()}
                  isRefreshDisabled={isPending}
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  disabled={isFundEscrowDisabled}
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
                  disabled={isPending || !actionGuards.cancelEscrow.canAct}
                  onClick={() => void cancelEscrow()}
                  className="disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Cancel escrow and reset project"
                >
                  {getActionButtonLabel(
                    "Cancel",
                    pendingAction === "cancel_escrow",
                    "Cancelling...",
                  )}
                </AppButton>
              </div>
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
                disabled={isPending || !actionGuards.submitWork.canAct}
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
                disabled={isPending || !actionGuards.markDisputed.canAct}
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
                disabled={isPending || !actionGuards.cancelEscrow.canAct}
                onClick={() => void cancelEscrow()}
                className="disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Cancel escrow and refund freelancer"
              >
                {getActionButtonLabel("Cancel", pendingAction === "cancel_escrow", "Cancelling...")}
              </AppButton>
              <AppButton
                type="button"
                appVariant="secondary"
                disabled={isPending || !actionGuards.markDisputed.canAct}
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
              : role === "client" && !actionGuards.releasePayment.canAct
                ? actionGuards.releasePayment.reason
                : undefined
          }
        >
          {role === "client" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  disabled={isPending || !actionGuards.releasePayment.canAct}
                  onClick={() => setIsReleaseDialogOpen(true)}
                  className="disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Approve work and release payment to freelancer"
                >
                  {getActionButtonLabel(
                    "Review & Release",
                    pendingAction === "release_payment",
                    "Releasing Payment...",
                  )}
                </AppButton>
                <AppButton
                  type="button"
                  appVariant="secondary"
                  disabled={isPending || !actionGuards.markDisputed.canAct}
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
              disabled={isPending || !actionGuards.markDisputed.canAct}
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

      {role === "client" && escrow?.status === "submitted" ? (
        <ReleasePaymentDialog
          isOpen={isReleaseDialogOpen}
          isSubmitting={isPending && pendingAction === "release_payment"}
          jobTitle={job.title}
          freelancerWallet={job.selectedFreelancerWallet ?? "-"}
          amount={job.budget}
          asset={job.asset}
          errorMessage={pendingAction === "release_payment" ? error : null}
          onOpenChange={setIsReleaseDialogOpen}
          onConfirm={handleConfirmRelease}
        />
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

      <TransactionStatusBanner error={error} success={success} txExplorerUrl={txExplorerUrl} />
    </section>
  );
}
