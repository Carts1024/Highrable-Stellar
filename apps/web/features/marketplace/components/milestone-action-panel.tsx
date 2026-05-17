"use client";

import { formatAssetLabel, isConfiguredStablecoin } from "@/core/stellar/assets";
import { StablecoinBalancePanel } from "@/core/stellar/components/stablecoin-balance-panel";
import { useStablecoinReadiness } from "@/core/stellar/hooks/use-stablecoin-readiness";
import {
  hasStablecoinConfig,
  stablecoinConfig,
  validateStablecoinConfig,
} from "@/core/stellar/stablecoin-config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { useMilestoneEscrowActions } from "@/features/marketplace/hooks/use-milestone-escrow-actions";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
import { useState } from "react";

import type { TMilestoneApplicationGate } from "../types";
import type { TConvexDoc } from "@repo/convex-client";

import { ReleasePaymentDialog } from "./release-payment-dialog";
import { StatusBadge } from "./status-badge";
import { TransactionStatusBanner } from "./transaction-status-banner";
import { TrustSafetyNotice } from "./trust-safety-notice";
import { TrustWarning } from "./trust-warning";

export function MilestoneActionPanel({
  job,
  milestone,
  applicationGate,
  escrow,
  applications,
}: {
  job: TConvexDoc<"jobs">;
  milestone: TConvexDoc<"milestones">;
  applicationGate: TMilestoneApplicationGate;
  escrow: TConvexDoc<"escrows"> | null | undefined;
  applications: TConvexDoc<"applications">[];
}) {
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const { address, walletState } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const verifiedReviewData = useQuery(
    api.reputation_records.queries.getVerifiedReviewForMilestone,
    milestone._id ? { milestoneId: milestone._id } : "skip",
  );
  const { isSyncing, syncEscrowStatus, syncReputationRecord, syncMessage, syncResult } =
    useSyncActions({ escrow });
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
  } = useMilestoneEscrowActions({ job, milestone, escrow, applications });

  const isStablecoinConfigured = hasStablecoinConfig();
  const stablecoinConfigValidation = validateStablecoinConfig();
  const isMilestoneAssetConfiguredStablecoin = isConfiguredStablecoin(milestone.asset);
  const stablecoinReadiness = useStablecoinReadiness({
    walletAddress: address,
    requiredAmount: milestone.amount,
    tokenContractId: milestone.asset || stablecoinConfig.tokenContractId,
    enabled:
      milestone.status === "escrow_created" &&
      role === "client" &&
      walletIdentity.canSignEscrowTransactions &&
      walletState.isConnected &&
      walletState.isTestnet,
  });
  const isFundEscrowDisabled =
    isPending ||
    !walletIdentity.canSignEscrowTransactions ||
    role !== "client" ||
    escrow?.status !== "created" ||
    !isStablecoinConfigured ||
    !isMilestoneAssetConfiguredStablecoin ||
    stablecoinReadiness.isLoading ||
    stablecoinReadiness.requiredAmountAtomic === null ||
    stablecoinReadiness.error !== null ||
    stablecoinReadiness.hasSufficientBalance === false;
  const reputationRecord = verifiedReviewData?.reputationRecord ?? null;
  const verifiedEscrow = verifiedReviewData?.escrow ?? escrow ?? null;
  const isReleased = milestone.status === "released" || escrow?.status === "released";
  const showPendingVerifiedSync = isReleased && escrow?.status === "released" && !reputationRecord;

  const handleConfirmRelease = async ({
    rating,
    reviewText,
  }: {
    rating: number;
    reviewText: string;
  }) => {
    const released = await approveAndRelease({ rating, reviewText });
    if (released) {
      setIsReleaseDialogOpen(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[#0a0a0a]">Milestone Escrow</h4>
        <StatusBadge label={milestone.status} />
      </div>

      {milestone.status === "assigned" ? (
        <TrustSafetyNotice type="selected_unfunded" compact />
      ) : null}
      {milestone.status === "escrow_created" ? (
        <TrustSafetyNotice
          type={role === "client" ? "client_funding" : "selected_unfunded"}
          compact
        />
      ) : null}
      {milestone.status === "funded" || milestone.status === "submitted" ? (
        <div className="space-y-2">
          <TrustSafetyNotice type="verified_funded" compact />
          <p className="text-sm text-emerald-800">
            Milestone {milestone.order} is verified funded. Other milestones may still be unfunded.
          </p>
        </div>
      ) : null}

      {!isStablecoinConfigured ? (
        <TrustWarning
          message={
            stablecoinConfigValidation.message ?? "Stablecoin token contract is not configured."
          }
        />
      ) : null}
      {isStablecoinConfigured && !isMilestoneAssetConfiguredStablecoin ? (
        <TrustWarning message="This milestone uses a different payment asset than the configured MVP stablecoin. Escrow funding is disabled for safety." />
      ) : null}
      {walletIdentity.walletType === "passkey_smart_account" ? (
        <TrustWarning message="Passkey escrow signing is not enabled yet. Switch to Freighter or WalletConnect to perform this action." />
      ) : null}

      {milestone.status === "open" ? (
        <p className="text-sm text-[#5f5f5f]">
          {applicationGate.canApply
            ? "Freelancers can apply to this milestone. The client selects one freelancer for this milestone only."
            : applicationGate.message}
        </p>
      ) : null}

      {milestone.status === "assigned" ? (
        <div className="space-y-3">
          {role === "client" ? (
            <AppButton
              type="button"
              disabled={isPending || escrow !== null || !walletIdentity.canSignEscrowTransactions}
              onClick={() => void createEscrow()}
              className="disabled:opacity-60"
            >
              {pendingAction === "create_escrow" ? "Creating Escrow..." : "Create Milestone Escrow"}
            </AppButton>
          ) : (
            <p className="text-sm text-amber-800">
              You are assigned. Wait for this milestone escrow to be funded before starting.
            </p>
          )}
        </div>
      ) : null}

      {milestone.status === "escrow_created" && escrow?.status === "created" ? (
        <div className="space-y-3">
          {role === "client" ? (
            <>
              <StablecoinBalancePanel
                walletAddress={address}
                requiredAmount={milestone.amount}
                tokenContractId={milestone.asset || stablecoinConfig.tokenContractId}
                enabled
                readinessState={stablecoinReadiness}
                isRefreshDisabled={isPending}
              />
              {stablecoinReadiness.hasSufficientBalance === false ? (
                <TrustWarning
                  message={`Insufficient stablecoin balance. Add at least ${stablecoinReadiness.deficitDisplay ?? "0"} ${stablecoinConfig.symbol}.`}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  disabled={isFundEscrowDisabled}
                  onClick={() => void fundEscrow()}
                  className="disabled:opacity-60"
                >
                  {pendingAction === "fund_escrow" ? "Funding..." : "Fund Milestone"}
                </AppButton>
                <AppButton
                  type="button"
                  variant="secondary"
                  disabled={isPending || !walletIdentity.canSignEscrowTransactions}
                  onClick={() => void cancelEscrow()}
                >
                  {pendingAction === "cancel_escrow" ? "Cancelling..." : "Cancel"}
                </AppButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-amber-800">
              Escrow exists but is not funded. Do not start this milestone yet.
            </p>
          )}
        </div>
      ) : null}

      {milestone.status === "funded" && escrow?.status === "funded" ? (
        <div className="space-y-3">
          {role === "selectedFreelancer" ? (
            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                disabled={isPending || !walletIdentity.canSignEscrowTransactions}
                onClick={() => void submitWork()}
                className="disabled:opacity-60"
              >
                {pendingAction === "submit_work" ? "Submitting..." : "Submit Work"}
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                disabled={isPending || !walletIdentity.canSignEscrowTransactions}
                onClick={() => void markDisputed()}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {pendingAction === "mark_disputed" ? "Disputing..." : "Dispute"}
              </AppButton>
            </div>
          ) : (
            <p className="text-sm text-[#5f5f5f]">Waiting for freelancer submission.</p>
          )}
        </div>
      ) : null}

      {milestone.status === "submitted" && escrow?.status === "submitted" ? (
        <div className="space-y-3">
          {role === "client" ? (
            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                disabled={isPending || !walletIdentity.canSignEscrowTransactions}
                onClick={() => setIsReleaseDialogOpen(true)}
                className="disabled:opacity-60"
              >
                Approve and Release
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                disabled={isPending || !walletIdentity.canSignEscrowTransactions}
                onClick={() => void markDisputed()}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {pendingAction === "mark_disputed" ? "Disputing..." : "Dispute"}
              </AppButton>
            </div>
          ) : (
            <p className="text-sm text-[#5f5f5f]">Waiting for client approval.</p>
          )}
        </div>
      ) : null}

      {isReleased && verifiedEscrow ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-800">Milestone paid.</p>
          {reputationRecord ? (
            <VerifiedReviewCard
              jobTitle={`${job.title} - ${milestone.title}`}
              escrowId={verifiedEscrow.escrowId}
              clientWallet={verifiedEscrow.clientWallet}
              freelancerWallet={verifiedEscrow.freelancerWallet ?? ""}
              amount={verifiedEscrow.amount}
              asset={verifiedEscrow.asset}
              rating={reputationRecord.rating}
              reviewText={reputationRecord.reviewText}
              reviewHash={reputationRecord.reviewHash}
              txHash={reputationRecord.txHash ?? verifiedEscrow.releaseTxHash}
              compact
              completionType="milestone"
            />
          ) : null}
          {showPendingVerifiedSync ? (
            <AppButton
              type="button"
              variant="secondary"
              disabled={isSyncing}
              onClick={() => void syncReputationRecord()}
              className="h-8 px-3 py-1.5 text-xs"
            >
              {isSyncing ? "Syncing..." : "Sync verified milestone review"}
            </AppButton>
          ) : null}
        </div>
      ) : null}

      {milestone.status === "cancelled" ? (
        <p className="text-sm text-[#5f5f5f]">Milestone cancelled.</p>
      ) : null}
      {milestone.status === "disputed" ? (
        <p className="text-sm text-red-700">Milestone disputed and requires manual review.</p>
      ) : null}

      {escrow ? (
        <div className="border-t border-[#e8e8e8] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#5f5f5f]">
              Escrow #{escrow.escrowId} · {formatAssetLabel(escrow.asset)}
            </p>
            <AppButton
              type="button"
              variant="secondary"
              disabled={isSyncing}
              onClick={() => void syncEscrowStatus()}
              className="h-8 px-3 py-1.5 text-xs"
            >
              {isSyncing ? "Syncing..." : "Sync with Stellar"}
            </AppButton>
          </div>
          {syncMessage ? (
            <p className={`mt-2 text-xs ${syncResult?.ok ? "text-emerald-700" : "text-red-700"}`}>
              {syncMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      <TransactionStatusBanner error={error} success={success} txExplorerUrl={txExplorerUrl} />

      <ReleasePaymentDialog
        isOpen={isReleaseDialogOpen}
        onOpenChange={setIsReleaseDialogOpen}
        onConfirm={handleConfirmRelease}
        isSubmitting={isPending && pendingAction === "release_payment"}
        jobTitle={`${job.title} - ${milestone.title}`}
        freelancerWallet={milestone.assignedFreelancerWallet ?? ""}
        amount={milestone.amount}
        asset={milestone.asset}
        errorMessage={error}
      />
    </div>
  );
}
