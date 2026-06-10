"use client";

import { StablecoinBalancePanel } from "@/core/stellar/components/stablecoin-balance-panel";
import { XlmToUsdcTopUpPanel } from "@/core/stellar/components/xlm-to-usdc-top-up-panel";
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
import { CancellationEligibilityNotice, CancelWorkButton } from "@/features/cancellations";
import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { DisputeActionGuardNotice, OpenDisputeButton } from "@/features/disputes";
import { useEscrowActions } from "@/features/marketplace/hooks/use-escrow-actions";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { getEscrowActionGuard } from "@/features/marketplace/lib/escrow-action-guards";
import {
  getMarketplaceStatus,
  getMarketplaceStatusMeta,
} from "@/features/marketplace/lib/escrow-status";
import { getJobSafetyLabel, getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { WorkProofSubmissionPanel } from "@/features/work-submissions/components/work-proof-submission-panel";
import { api } from "@repo/convex-client";
import { SafetyInfoDisclosure } from "@repo/ui/components/highrable/safety-info-disclosure";
import { HighrableV2IconNotice, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { V2_BUTTON_SECONDARY_CLASS } from "@repo/ui/components/highrable/v2-theme";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/responsive-dialog";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import type { TConvexDoc } from "@repo/convex-client";

import { EscrowSection } from "./escrow-section";
import { JobSafetyBadge } from "./job-safety-badge";
import { ReleasePaymentDialog } from "./release-payment-dialog";
import { StatusBadge } from "./status-badge";
import { TransactionStatusBanner } from "./transaction-status-banner";
import { TrustSafetyNotice } from "./trust-safety-notice";
import { TrustWarning } from "./trust-warning";

interface IEscrowActionPanelProps {
  readonly job: TConvexDoc<"jobs">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly applications: TConvexDoc<"applications">[];
}

function getActionButtonLabel(label: string, isPending: boolean, pendingLabel: string): string {
  return isPending ? pendingLabel : label;
}

function getInsufficientBalanceMessage(input: {
  readonly symbol: string;
  readonly deficitDisplay: string | null;
  readonly actionLabel: string;
}): string {
  const missingAmount = input.deficitDisplay ? ` Add at least ${input.deficitDisplay}.` : "";
  return `Buy or add more ${input.symbol} before you can ${input.actionLabel}.${missingAmount}`;
}

export function EscrowActionPanel({ job, escrow, applications }: IEscrowActionPanelProps) {
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [isPaymentFlowOpen, setIsPaymentFlowOpen] = useState(false);

  const { walletState } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const reputationRecord = useQuery(
    api.reputation.getReputationByEscrowId,
    escrow?.escrowId ? { escrowId: escrow.escrowId } : "skip",
  );
  const activeDispute = useQuery(
    api.disputes.getActiveDisputeForEscrow,
    escrow && walletIdentity.walletAddress
      ? { escrowId: escrow._id, viewerWallet: walletIdentity.walletAddress }
      : "skip",
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
    approveAndRelease,
  } = useEscrowActions({
    job,
    escrow,
    applications,
  });

  const isStablecoinConfigured = hasStablecoinConfig();
  const stablecoinConfigValidation = validateStablecoinConfig();
  const jobEscrowAsset = getEscrowAssetByContractId(job.asset);
  const isJobAssetSupported = isSupportedEscrowAsset(job.asset);
  const escrowAssetSymbol = jobEscrowAsset?.symbol ?? stablecoinConfig.symbol;

  const currentStatus = getMarketplaceStatus(job.status, escrow?.status);
  const currentStatusMeta = getMarketplaceStatusMeta(currentStatus);
  const safetyStatus = getJobSafetyStatus({ job, escrow });
  const shouldShowMarketplaceStatusBadge =
    getJobSafetyLabel(safetyStatus.status) !== currentStatusMeta.label;
  const isPasskeyMode = walletIdentity.walletType === "passkey_smart_account";
  const isExternalWalletOnConfiguredNetwork = isWalletOnConfiguredNetwork(walletState);
  const cancellationParent = useMemo(
    () =>
      escrow
        ? ({ parentType: "escrow", parentId: escrow._id } as const)
        : ({ parentType: "micro_gig", parentId: job._id } as const),
    [escrow, job._id],
  );
  const cancellationEligibility = useQuery(
    api.cancellations.getCancellationEligibility,
    walletIdentity.walletAddress && (role === "client" || role === "selectedFreelancer")
      ? {
          ...cancellationParent,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const walletGuardContext = useMemo(
    () => ({
      isConnected: walletIdentity.isConnected,
      isOnConfiguredNetwork: isPasskeyMode ? true : isExternalWalletOnConfiguredNetwork,
      isFunded: isPasskeyMode ? null : walletState.isFunded,
      canWriteContracts: isPasskeyMode
        ? walletIdentity.canSignEscrowTransactions
        : walletIdentity.canSignEscrowTransactions && walletState.canWriteContracts,
      writeRestrictionReason: null,
      walletType: walletIdentity.walletType,
    }),
    [
      isPasskeyMode,
      walletIdentity.canSignEscrowTransactions,
      walletIdentity.isConnected,
      walletIdentity.walletType,
      isExternalWalletOnConfiguredNetwork,
      walletState.canWriteContracts,
      walletState.isFunded,
    ],
  );
  const actionGuards = useMemo(
    () => ({
      createEscrow: getEscrowActionGuard({
        action: "create_escrow",
        role,
        job,
        escrow,
        wallet: walletGuardContext,
      }),
      fundEscrow: getEscrowActionGuard({
        action: "fund_escrow",
        role,
        job,
        escrow,
        wallet: walletGuardContext,
      }),
      releasePayment: getEscrowActionGuard({
        action: "release_payment",
        role,
        job,
        escrow,
        wallet: walletGuardContext,
      }),
      markDisputed: getEscrowActionGuard({
        action: "mark_disputed",
        role,
        job,
        escrow,
        wallet: walletGuardContext,
      }),
    }),
    [escrow, job, role, walletGuardContext],
  );
  const stablecoinReadiness = useStablecoinReadiness({
    walletAddress: walletIdentity.walletAddress,
    requiredAmount: job.budget,
    tokenContractId: job.asset || stablecoinConfig.tokenContractId,
    asset: jobEscrowAsset ?? undefined,
    enabled:
      (currentStatus === "selected" || currentStatus === "created") &&
      role === "client" &&
      walletIdentity.canSignEscrowTransactions &&
      walletIdentity.isConnected &&
      (isPasskeyMode || isExternalWalletOnConfiguredNetwork),
  });
  const isEscrowBalanceReadinessBlocking =
    stablecoinReadiness.isLoading ||
    stablecoinReadiness.requiredAmountAtomic === null ||
    stablecoinReadiness.error !== null ||
    stablecoinReadiness.hasSufficientBalance === false;
  const isCreateEscrowDisabled =
    isPending ||
    !actionGuards.createEscrow.canAct ||
    !isJobAssetSupported ||
    isEscrowBalanceReadinessBlocking;
  const isFundEscrowDisabled =
    isPending ||
    !actionGuards.fundEscrow.canAct ||
    !isJobAssetSupported ||
    isEscrowBalanceReadinessBlocking;
  const createEscrowBalanceWarning =
    stablecoinReadiness.hasSufficientBalance === false
      ? getInsufficientBalanceMessage({
          symbol: escrowAssetSymbol,
          deficitDisplay: stablecoinReadiness.deficitDisplay,
          actionLabel: "create this escrow",
        })
      : stablecoinReadiness.error;
  const fundEscrowBalanceWarning =
    stablecoinReadiness.hasSufficientBalance === false
      ? getInsufficientBalanceMessage({
          symbol: escrowAssetSymbol,
          deficitDisplay: stablecoinReadiness.deficitDisplay,
          actionLabel: "fund this escrow",
        })
      : stablecoinReadiness.error;
  const hasReleasedCompletion = currentStatus === "released" || currentStatus === "completed";
  const showPendingVerifiedSync =
    hasReleasedCompletion && escrow?.status === "released" && reputationRecord === null;
  const canShowWorkSubmission =
    Boolean(escrow) &&
    (currentStatus === "funded" || currentStatus === "submitted" || hasReleasedCompletion) &&
    (role === "client" || role === "selectedFreelancer");
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
      className="border border-[#e8e8e8] bg-white p-5"
      aria-label="Escrow lifecycle and actions"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <SectionLabel>Payment Flow</SectionLabel>
          <h2 className="text-lg font-semibold text-[#0a0a0a]">{currentStatusMeta.label}</h2>
          <p className="max-w-2xl text-sm text-[#5f5f5f]">{currentStatusMeta.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <JobSafetyBadge status={safetyStatus.status} />
          {shouldShowMarketplaceStatusBadge ? <StatusBadge label={currentStatus} /> : null}
          {currentStatusMeta.trustWarning ? (
            <HighrableV2IconNotice
              label="Payment flow warning"
              tone="warning"
              message={currentStatusMeta.trustWarning}
            />
          ) : null}
          <ResponsiveDialog open={isPaymentFlowOpen} onOpenChange={setIsPaymentFlowOpen}>
            <ResponsiveDialogTrigger asChild>
              <AppButton
                type="button"
                variant="outline"
                className={`${V2_BUTTON_SECONDARY_CLASS} rounded-none`}
              >
                Open payment flow
              </AppButton>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent className="rounded-none sm:max-w-4xl">
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>Payment Flow</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {currentStatusMeta.description}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <ResponsiveDialogBody>
                <div className="space-y-4 border-t border-[#e8e8e8] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <JobSafetyBadge status={safetyStatus.status} />
                      {shouldShowMarketplaceStatusBadge ? (
                        <StatusBadge label={currentStatus} />
                      ) : null}
                    </div>
                    <SafetyInfoDisclosure>
                      {cancellationEligibility ? (
                        <CancellationEligibilityNotice eligibility={cancellationEligibility} />
                      ) : null}
                      {safetyStatus.status === "unfunded" ? (
                        <TrustSafetyNotice
                          type={role === "selectedFreelancer" ? "selected_unfunded" : "unfunded"}
                          compact
                        />
                      ) : null}
                      {safetyStatus.status === "escrow_created" ? (
                        <TrustSafetyNotice
                          type={role === "client" ? "client_funding" : "selected_unfunded"}
                          compact
                        />
                      ) : null}
                      {safetyStatus.status === "verified_funded" ? (
                        <TrustSafetyNotice type="verified_funded" compact />
                      ) : null}
                      {currentStatusMeta.trustWarning ? (
                        <TrustWarning message={currentStatusMeta.trustWarning} />
                      ) : null}
                      {walletIdentity.walletType ? (
                        <p className="border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm text-[#3f3f3f]">
                          {isPasskeyMode
                            ? "Signing with Passkey Smart Account. Your browser/device will ask you to approve with your passkey."
                            : "Signing with Freighter or WalletConnect."}
                        </p>
                      ) : null}
                      {activeDispute ? <DisputeActionGuardNotice /> : null}

                      {!isStablecoinConfigured ? (
                        <TrustWarning
                          message={
                            stablecoinConfigValidation.message ??
                            "Stablecoin token contract is not configured."
                          }
                        />
                      ) : null}

                      {!isJobAssetSupported ? (
                        <TrustWarning
                          message={
                            jobEscrowAsset?.readinessMessage ?? getUnsupportedEscrowAssetMessage()
                          }
                        />
                      ) : null}

                      {jobEscrowAsset?.kind === "native_xlm" ? (
                        <div className="space-y-2">
                          <TrustWarning message="XLM escrow is volatile. Final fiat value may change." />
                          {isPasskeyMode ? (
                            <p className="border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm text-[#3f3f3f]">
                              XLM escrow will be funded through your passkey smart account using the
                              native XLM token contract.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </SafetyInfoDisclosure>
                  </div>

                  {currentStatus === "open" ? (
                    <p className="text-sm text-[#5f5f5f]">
                      Waiting for client to select a freelancer. Once selected, escrow setup will
                      begin.
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
                          : role === "client" && !isJobAssetSupported
                            ? (jobEscrowAsset?.readinessMessage ??
                              getUnsupportedEscrowAssetMessage())
                            : role === "client" && createEscrowBalanceWarning
                              ? createEscrowBalanceWarning
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
                        <div className="space-y-3">
                          <StablecoinBalancePanel
                            walletAddress={walletIdentity.walletAddress}
                            requiredAmount={job.budget}
                            tokenContractId={job.asset || stablecoinConfig.tokenContractId}
                            asset={jobEscrowAsset ?? undefined}
                            enabled={currentStatus === "selected" && role === "client"}
                            readinessState={stablecoinReadiness}
                            isRefreshDisabled={isPending}
                          />

                          {jobEscrowAsset?.kind === "stablecoin" &&
                          stablecoinReadiness.hasSufficientBalance === false ? (
                            <XlmToUsdcTopUpPanel
                              walletAddress={walletIdentity.walletAddress}
                              walletType={walletIdentity.walletType}
                              missingUsdcAmount={stablecoinReadiness.deficitDisplay}
                              usdcBalance={stablecoinReadiness.balanceDisplay}
                              jobAssetContractId={job.asset || stablecoinConfig.tokenContractId}
                              onRefreshBalance={stablecoinReadiness.refresh}
                              canFundEscrow={false}
                              isFundEscrowPending={pendingAction === "fund_escrow"}
                            />
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2">
                            <AppButton
                              type="button"
                              disabled={isCreateEscrowDisabled}
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
                            {createEscrowBalanceWarning ? (
                              <SafetyInfoDisclosure label="View escrow balance requirement">
                                <TrustWarning message={createEscrowBalanceWarning} />
                                {jobEscrowAsset?.kind === "stablecoin" ? (
                                  <p className="border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm text-[#3f3f3f]">
                                    Use the Stellar path payment panel in this section to convert
                                    XLM into {escrowAssetSymbol}, then refresh the balance.
                                  </p>
                                ) : (
                                  <p className="border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm text-[#3f3f3f]">
                                    Buy or receive more {escrowAssetSymbol}, then refresh your
                                    escrow balance.
                                  </p>
                                )}
                              </SafetyInfoDisclosure>
                            ) : null}
                          </div>
                        </div>
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
                          : role === "client" &&
                              !isStablecoinConfigured &&
                              jobEscrowAsset?.kind === "stablecoin"
                            ? stablecoinConfigValidation.message
                            : role === "client" && !isJobAssetSupported
                              ? (jobEscrowAsset?.readinessMessage ??
                                getUnsupportedEscrowAssetMessage())
                              : role === "client" &&
                                  stablecoinReadiness.hasSufficientBalance === false
                                ? fundEscrowBalanceWarning
                                : role === "client" && fundEscrowBalanceWarning
                                  ? fundEscrowBalanceWarning
                                  : role === "client" && !actionGuards.fundEscrow.canAct
                                    ? actionGuards.fundEscrow.reason
                                    : undefined
                      }
                    >
                      {role === "client" ? (
                        <div className="space-y-3">
                          <TrustSafetyNotice type="client_funding" compact />
                          <StablecoinBalancePanel
                            walletAddress={walletIdentity.walletAddress}
                            requiredAmount={job.budget}
                            tokenContractId={job.asset || stablecoinConfig.tokenContractId}
                            asset={jobEscrowAsset ?? undefined}
                            enabled={currentStatus === "created" && role === "client"}
                            readinessState={stablecoinReadiness}
                            isRefreshDisabled={isPending}
                          />

                          {jobEscrowAsset?.kind === "stablecoin" &&
                          stablecoinReadiness.hasSufficientBalance === false ? (
                            <XlmToUsdcTopUpPanel
                              walletAddress={walletIdentity.walletAddress}
                              walletType={walletIdentity.walletType}
                              missingUsdcAmount={stablecoinReadiness.deficitDisplay}
                              usdcBalance={stablecoinReadiness.balanceDisplay}
                              jobAssetContractId={job.asset || stablecoinConfig.tokenContractId}
                              onRefreshBalance={stablecoinReadiness.refresh}
                              onFundEscrow={async () => {
                                await fundEscrow();
                              }}
                              canFundEscrow={false}
                              isFundEscrowPending={pendingAction === "fund_escrow"}
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
                            <CancelWorkButton
                              job={job}
                              escrow={escrow}
                              showEligibilityDisclosure={false}
                            />
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
                            ? job.selectedFreelancerWallet
                              ? "Escrow funded and locked. Waiting for freelancer to submit work."
                              : "Escrow funded and locked. Select a freelancer from the applications list."
                            : undefined
                      }
                    >
                      {role === "selectedFreelancer" ? (
                        <div className="space-y-3">
                          <OpenDisputeButton
                            job={job}
                            escrow={escrow}
                            parentType="escrow"
                            parentId={escrow?._id ?? job._id}
                            disabled={isPending || !actionGuards.markDisputed.canAct}
                          />
                        </div>
                      ) : null}

                      {role === "client" ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <CancelWorkButton
                              job={job}
                              escrow={escrow}
                              showEligibilityDisclosure={false}
                            />
                            {job.selectedFreelancerWallet ? (
                              <OpenDisputeButton
                                job={job}
                                escrow={escrow}
                                parentType="escrow"
                                parentId={escrow?._id ?? job._id}
                                disabled={isPending || !actionGuards.markDisputed.canAct}
                              />
                            ) : null}
                          </div>
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
                            <OpenDisputeButton
                              job={job}
                              escrow={escrow}
                              parentType="escrow"
                              parentId={escrow?._id ?? job._id}
                              disabled={isPending || !actionGuards.markDisputed.canAct}
                            />
                          </div>
                        </>
                      ) : null}

                      {role === "selectedFreelancer" ? (
                        <OpenDisputeButton
                          job={job}
                          escrow={escrow}
                          parentType="escrow"
                          parentId={escrow?._id ?? job._id}
                          disabled={isPending || !actionGuards.markDisputed.canAct}
                        />
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
                      <p className="text-sm font-medium text-emerald-800">
                        ✓ Payment released successfully.
                      </p>

                      {escrow && reputationRecord ? (
                        <VerifiedReviewCard
                          compact
                          jobTitle={job.title}
                          escrowId={escrow.escrowId}
                          clientWallet={escrow.clientWallet}
                          freelancerWallet={escrow.freelancerWallet ?? ""}
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
                            Payment released. The verified reputation record is syncing from Stellar
                            blockchain.
                          </p>
                          <AppButton
                            type="button"
                            variant="secondary"
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
                        <p className="text-sm text-gray-500">
                          Loading verified reputation record...
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {currentStatus === "cancelled" ? (
                    <p className="text-sm text-[#5f5f5f]">
                      Escrow cancelled. No funds were exchanged.
                    </p>
                  ) : null}

                  {currentStatus === "disputed" ? (
                    <p className="text-sm text-red-700" role="alert">
                      ⚠ Escrow disputed. A moderator will review this case shortly.
                    </p>
                  ) : null}
                </div>
              </ResponsiveDialogBody>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </div>

      <TransactionStatusBanner error={error} success={success} txExplorerUrl={txExplorerUrl} />
      {canShowWorkSubmission && escrow ? (
        <div className="mt-4">
          <WorkProofSubmissionPanel job={job} escrow={escrow} />
        </div>
      ) : null}
    </section>
  );
}
