"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { StablecoinBalancePanel } from "@/core/stellar/components/stablecoin-balance-panel";
import { useStablecoinReadiness } from "@/core/stellar/hooks/use-stablecoin-readiness";
import {
  getEscrowAssetByContractId,
  getUnsupportedEscrowAssetMessage,
  isSupportedEscrowAsset,
} from "@/core/stellar/payment-assets";
import {
  hasStablecoinConfig,
  stablecoinConfig,
  validateStablecoinConfig,
} from "@/core/stellar/stablecoin-config";
import { isWalletOnConfiguredNetwork } from "@/core/wallet/config";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { CancelWorkButton } from "@/features/cancellations";
import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { DisputeActionGuardNotice, OpenDisputeButton } from "@/features/disputes";
import { useMilestoneEscrowActions } from "@/features/marketplace/hooks/use-milestone-escrow-actions";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { WorkProofSubmissionPanel } from "@/features/work-submissions/components/work-proof-submission-panel";
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
  const { walletState } = useWallet();
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
    approveAndRelease,
  } = useMilestoneEscrowActions({ job, milestone, escrow, applications });
  const activeDispute = useQuery(
    api.disputes.getActiveDisputeForEscrow,
    escrow && walletIdentity.walletAddress
      ? { escrowId: escrow._id, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );

  const isStablecoinConfigured = hasStablecoinConfig();
  const stablecoinConfigValidation = validateStablecoinConfig();
  const milestoneEscrowAsset = getEscrowAssetByContractId(milestone.asset);
  const isMilestoneAssetSupported = isSupportedEscrowAsset(milestone.asset);
  const isPasskeyMode = walletIdentity.walletType === "passkey_smart_account";
  const isExternalWalletOnConfiguredNetwork = isWalletOnConfiguredNetwork(walletState);
  const stablecoinReadiness = useStablecoinReadiness({
    walletAddress: walletIdentity.walletAddress,
    requiredAmount: milestone.amount,
    tokenContractId: milestone.asset || stablecoinConfig.tokenContractId,
    asset: milestoneEscrowAsset ?? undefined,
    enabled:
      milestone.status === "escrow_created" &&
      role === "client" &&
      walletIdentity.canSignEscrowTransactions &&
      walletIdentity.isConnected &&
      (isPasskeyMode || isExternalWalletOnConfiguredNetwork),
  });
  const isFundEscrowDisabled =
    isPending ||
    !walletIdentity.canSignEscrowTransactions ||
    role !== "client" ||
    escrow?.status !== "created" ||
    !isMilestoneAssetSupported ||
    stablecoinReadiness.isLoading ||
    stablecoinReadiness.requiredAmountAtomic === null ||
    stablecoinReadiness.error !== null ||
    stablecoinReadiness.hasSufficientBalance === false;
  const reputationRecord = verifiedReviewData?.reputationRecord ?? null;
  const verifiedEscrow = verifiedReviewData?.escrow ?? escrow ?? null;
  const isReleased = milestone.status === "released" || escrow?.status === "released";
  const showPendingVerifiedSync = isReleased && escrow?.status === "released" && !reputationRecord;
  const canShowReleasedWorkSubmission =
    isReleased && Boolean(verifiedEscrow) && (role === "client" || role === "selectedFreelancer");

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
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="hr-text-primary text-sm font-semibold">Milestone Escrow</h4>
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

      {!isStablecoinConfigured && milestoneEscrowAsset?.kind === "stablecoin" ? (
        <TrustWarning
          message={
            stablecoinConfigValidation.message ?? "Stablecoin token contract is not configured."
          }
        />
      ) : null}
      {!isMilestoneAssetSupported ? (
        <TrustWarning
          message={milestoneEscrowAsset?.readinessMessage ?? getUnsupportedEscrowAssetMessage()}
        />
      ) : null}
      {milestoneEscrowAsset?.kind === "native_xlm" ? (
        <TrustWarning message="XLM escrow is volatile. Final fiat value may change." />
      ) : null}
      {walletIdentity.walletType ? (
        <p className="rounded-lg border border-border/60 bg-muted/50 px-3 py-2 font-sans text-xs text-muted-foreground">
          {isPasskeyMode
            ? "Signing with Passkey Smart Account. Your browser/device will ask you to approve with your passkey."
            : "Signing with Freighter or WalletConnect."}
        </p>
      ) : null}
      {activeDispute ? <DisputeActionGuardNotice /> : null}

      {milestone.status === "open" ? (
        <p className="hr-text-secondary text-sm">
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
                walletAddress={walletIdentity.walletAddress}
                requiredAmount={milestone.amount}
                tokenContractId={milestone.asset || stablecoinConfig.tokenContractId}
                asset={milestoneEscrowAsset ?? undefined}
                enabled
                readinessState={stablecoinReadiness}
                isRefreshDisabled={isPending}
              />
              {stablecoinReadiness.hasSufficientBalance === false ? (
                <TrustWarning
                  message={`Insufficient ${milestoneEscrowAsset?.symbol ?? stablecoinConfig.symbol} balance. Add at least ${stablecoinReadiness.deficitDisplay ?? "0"} ${milestoneEscrowAsset?.symbol ?? stablecoinConfig.symbol}.`}
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
                <CancelWorkButton job={job} milestone={milestone} escrow={escrow} />
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
            <div className="space-y-3">
              <WorkProofSubmissionPanel job={job} milestone={milestone} escrow={escrow} />
              <OpenDisputeButton
                job={job}
                milestone={milestone}
                escrow={escrow}
                parentType="milestone"
                parentId={milestone._id}
                disabled={isPending || !walletIdentity.canSignEscrowTransactions}
                className="border-red-300 text-red-700 hover:bg-red-50"
              />
            </div>
          ) : null}
          {role === "client" ? (
            <div className="space-y-3">
              <WorkProofSubmissionPanel job={job} milestone={milestone} escrow={escrow} />
              <CancelWorkButton job={job} milestone={milestone} escrow={escrow} />
            </div>
          ) : null}
          {role !== "selectedFreelancer" && role !== "client" ? (
            <p className="hr-text-secondary text-sm">Waiting for freelancer submission.</p>
          ) : null}
        </div>
      ) : null}

      {milestone.status === "submitted" && escrow?.status === "submitted" ? (
        <div className="space-y-3">
          <WorkProofSubmissionPanel job={job} milestone={milestone} escrow={escrow} />
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
              <OpenDisputeButton
                job={job}
                milestone={milestone}
                escrow={escrow}
                parentType="milestone"
                parentId={milestone._id}
                disabled={isPending || !walletIdentity.canSignEscrowTransactions}
                className="border-red-300 text-red-700 hover:bg-red-50"
              />
            </div>
          ) : (
            <p className="hr-text-secondary text-sm">Waiting for client approval.</p>
          )}
        </div>
      ) : null}

      {isReleased && verifiedEscrow ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-800">Milestone paid.</p>
          {canShowReleasedWorkSubmission ? (
            <WorkProofSubmissionPanel job={job} milestone={milestone} escrow={verifiedEscrow} />
          ) : null}
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
        <p className="hr-text-secondary text-sm">Milestone cancelled.</p>
      ) : null}
      {milestone.status === "disputed" ? (
        <p className="text-sm text-red-700">Milestone disputed and requires manual review.</p>
      ) : null}

      {escrow ? (
        <div className="border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground/70">
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
