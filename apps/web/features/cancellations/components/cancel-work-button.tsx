"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { sanitizeMultilineInput, showWarningToast } from "@/features/common";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { SafetyInfoDisclosure } from "@repo/ui/components/highrable/safety-info-disclosure";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Ban, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import type { TConvexDoc } from "@repo/convex-client";

import { useCancellationActions } from "../hooks/use-cancellation-actions";
import {
  CancellationActionGuardNotice,
  CancellationAgreementContext,
  CancellationEligibilityNotice,
  CancellationTimeline,
  FreelancerCancellationResponsePanel,
} from "./cancellation-panels";
import { CancellationStatusBadge } from "./cancellation-status-badge";

type TCancellationParentType = "micro_gig" | "milestone" | "escrow" | "job";
type TCancellationReasonCategory =
  | "changed_requirements"
  | "duplicate_work"
  | "freelancer_unresponsive"
  | "missed_deadline"
  | "work_not_started"
  | "scope_issue"
  | "mutual_agreement"
  | "dispute_resolution"
  | "other";

interface ICancelWorkButtonProps {
  readonly job: TConvexDoc<"jobs">;
  readonly milestone?: TConvexDoc<"milestones">;
  readonly escrow: TConvexDoc<"escrows"> | null | undefined;
  readonly className?: string;
  readonly showEligibilityDisclosure?: boolean;
}

const REASON_OPTIONS: Array<{ value: TCancellationReasonCategory; label: string }> = [
  { value: "changed_requirements", label: "Changed requirements" },
  { value: "duplicate_work", label: "Duplicate work" },
  { value: "freelancer_unresponsive", label: "Freelancer unresponsive" },
  { value: "missed_deadline", label: "Missed deadline" },
  { value: "work_not_started", label: "Work not started" },
  { value: "scope_issue", label: "Scope issue" },
  { value: "mutual_agreement", label: "Mutual agreement" },
  { value: "dispute_resolution", label: "Dispute resolution" },
  { value: "other", label: "Other" },
];

function getParent(input: {
  job: TConvexDoc<"jobs">;
  milestone?: TConvexDoc<"milestones">;
  escrow?: TConvexDoc<"escrows"> | null;
}): { parentType: TCancellationParentType; parentId: string } {
  if (input.escrow) {
    return { parentType: "escrow", parentId: input.escrow._id };
  }
  if (input.milestone) {
    return { parentType: "milestone", parentId: input.milestone._id };
  }
  return { parentType: "micro_gig", parentId: input.job._id };
}

function getButtonLabel(eligibility: {
  blocked: boolean;
  canCancelImmediately: boolean;
  requiresFreelancerResponse: boolean;
  suggestedAction: string;
}) {
  if (eligibility.blocked) {
    if (eligibility.suggestedAction === "open_dispute") return "Open dispute";
    if (eligibility.suggestedAction === "request_revision") return "Request revision";
    return "Cancellation blocked";
  }
  if (eligibility.canCancelImmediately) return "Cancel escrow";
  if (eligibility.requiresFreelancerResponse) return "Request cancellation";
  return "Cancel work";
}

export function CancelWorkButton({
  job,
  milestone,
  escrow,
  className,
  showEligibilityDisclosure = true,
}: ICancelWorkButtonProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const createCancellationRequest = useMutation(api.cancellations.createCancellationRequest);
  const { executeCancellation, isPending, error, success, txExplorerUrl } =
    useCancellationActions();
  const parent = useMemo(() => getParent({ job, milestone, escrow }), [escrow, job, milestone]);
  const isClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);
  const isFreelancer = isSameWallet(
    walletIdentity.walletAddress,
    escrow?.freelancerWallet ??
      milestone?.assignedFreelancerWallet ??
      job.selectedFreelancerWallet ??
      null,
  );
  const isParticipant = isClient || isFreelancer;
  const eligibility = useQuery(
    api.cancellations.getCancellationEligibility,
    isParticipant
      ? {
          ...parent,
          ...(walletIdentity.walletAddress ? { viewerWallet: walletIdentity.walletAddress } : {}),
        }
      : "skip",
  );
  const activeRequest = useQuery(
    api.cancellations.getActiveCancellationRequestForParent,
    isParticipant && walletIdentity.walletAddress
      ? { ...parent, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );
  const latestRequest = useQuery(
    api.cancellations.getLatestCancellationRequestForParent,
    isParticipant && walletIdentity.walletAddress
      ? { ...parent, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );

  const [isOpen, setIsOpen] = useState(false);
  const [reasonCategory, setReasonCategory] =
    useState<TCancellationReasonCategory>("work_not_started");
  const [reasonText, setReasonText] = useState("");
  const [clientWarningAccepted, setClientWarningAccepted] = useState(false);
  const [proofWarningAccepted, setProofWarningAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    isClient &&
    walletIdentity.isConnected &&
    Boolean(eligibility?.canRequest) &&
    clientWarningAccepted &&
    reasonText.trim().length > 0 &&
    (!eligibility?.proofSubmitted || proofWarningAccepted) &&
    !isSubmitting &&
    !isPending;
  const buttonLabel = eligibility ? getButtonLabel(eligibility) : "Cancel work";
  const displayedRequest = activeRequest ?? latestRequest;
  const shouldExecuteRequest =
    displayedRequest?.status === "approved_for_cancel" ||
    displayedRequest?.status === "cancel_failed";

  const handleCreateRequest = async () => {
    if (!walletIdentity.walletAddress) {
      const nextWarning = "Connect a wallet before requesting cancellation.";
      setSubmitError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }
    const sanitizedReasonText = sanitizeMultilineInput(reasonText).slice(0, 4000);
    if (!sanitizedReasonText) {
      const nextWarning = "Add cancellation details before submitting.";
      setSubmitError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const config = getRequiredEscrowActionConfig();
      const request = await createCancellationRequest({
        ...parent,
        requestedByWallet: walletIdentity.walletAddress,
        requestedByWalletType: walletIdentity.walletType ?? "external_wallet",
        clientWalletType: walletIdentity.walletType ?? "external_wallet",
        ...(milestone?.assignedFreelancerWallet || job.selectedFreelancerWallet
          ? { freelancerWalletType: "external_wallet" as const }
          : {}),
        reasonCategory,
        reasonText: sanitizedReasonText,
        clientWarningAccepted,
        proofWarningAccepted,
        escrowContractId: config.escrowContractId,
      });
      setIsOpen(false);
      setReasonText("");
      setClientWarningAccepted(false);
      setProofWarningAccepted(false);
      if (eligibility?.canCancelImmediately && eligibility.canExecuteOnChain && request) {
        await executeCancellation(request);
      }
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Could not request cancellation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteActiveRequest = async () => {
    if (displayedRequest) {
      await executeCancellation(displayedRequest);
    }
  };

  if (!isClient && !displayedRequest) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {showEligibilityDisclosure && eligibility ? (
        <div className="flex justify-end">
          <SafetyInfoDisclosure label="View cancellation eligibility details">
            <CancellationEligibilityNotice eligibility={eligibility} />
          </SafetyInfoDisclosure>
        </div>
      ) : null}
      {displayedRequest ? (
        <div className="space-y-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-[#0a0a0a]">Cancellation request</p>
              <p className="font-mono text-xs text-[#6f6f6f]">{displayedRequest.requestNumber}</p>
            </div>
            <CancellationStatusBadge status={displayedRequest.status} />
          </div>
          <p className="text-sm text-[#5f5f5f]">{displayedRequest.reasonText}</p>
          <CancellationAgreementContext cancellationRequestId={displayedRequest._id} />
          <FreelancerCancellationResponsePanel request={displayedRequest} />
          {isClient && shouldExecuteRequest && displayedRequest.onChainStatus !== "confirmed" ? (
            <Button
              type="button"
              disabled={isPending}
              onClick={() => void handleExecuteActiveRequest()}
              className="disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              {isPending ? "Cancelling..." : "Execute on-chain cancellation"}
            </Button>
          ) : null}
          <CancellationTimeline cancellationRequestId={displayedRequest._id} />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? (
        <p className="text-sm text-emerald-700">
          {success}{" "}
          {txExplorerUrl ? (
            <a className="underline" href={txExplorerUrl} target="_blank" rel="noreferrer">
              View transaction
            </a>
          ) : null}
        </p>
      ) : null}

      {isClient && !displayedRequest ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant={eligibility?.blocked ? "outline" : "secondary"}
              disabled={!eligibility || eligibility.blocked}
              className="border-amber-300 text-amber-900 hover:bg-amber-50 disabled:opacity-60"
            >
              {eligibility?.blocked ? <Ban className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {buttonLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{buttonLabel}</DialogTitle>
              <DialogDescription>
                Cancellation is checked against escrow, proof, deadline, revision, and dispute state
                before any on-chain action is allowed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <CancellationEligibilityNotice eligibility={eligibility} />
              <CancellationActionGuardNotice eligibility={eligibility} />

              <div className="space-y-2">
                <label
                  htmlFor="cancellation-reason-category"
                  className="font-mono text-xs text-[#6f6f6f] uppercase"
                >
                  Cancellation reason
                </label>
                <Select
                  value={reasonCategory}
                  onValueChange={(value) => setReasonCategory(value as TCancellationReasonCategory)}
                >
                  <SelectTrigger id="cancellation-reason-category" className="w-full">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="cancellation-reason-text"
                  className="font-mono text-xs text-[#6f6f6f] uppercase"
                >
                  Details
                </label>
                <Textarea
                  id="cancellation-reason-text"
                  value={reasonText}
                  onChange={(event) => setReasonText(event.target.value)}
                  placeholder="Explain why cancellation is appropriate."
                  className="min-h-28"
                  maxLength={4000}
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-[#e8e8e8] bg-white p-3 text-sm">
                <Checkbox
                  id="cancellation-client-warning"
                  checked={clientWarningAccepted}
                  onCheckedChange={(checked) => setClientWarningAccepted(checked === true)}
                />
                <label htmlFor="cancellation-client-warning">
                  I understand cancellation may require freelancer agreement, dispute review, or
                  wallet approval, and should not be used to avoid reviewing submitted work.
                </label>
              </div>

              {eligibility?.proofSubmitted ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  <Checkbox
                    id="cancellation-proof-warning"
                    checked={proofWarningAccepted}
                    onCheckedChange={(checked) => setProofWarningAccepted(checked === true)}
                  />
                  <label htmlFor="cancellation-proof-warning">
                    I understand proof exists and direct cancellation is blocked unless review or
                    dispute outcome permits it.
                  </label>
                </div>
              ) : null}

              {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleCreateRequest()}
                className="disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : buttonLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
