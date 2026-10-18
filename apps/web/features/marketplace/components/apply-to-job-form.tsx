"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  sanitizeMultilineInput,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Label } from "@repo/ui/components/ui/label";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/responsive-dialog";
import { useMutation } from "convex/react";
import { useState } from "react";
import { z } from "zod";

import type { TConvexDoc, TConvexId } from "@repo/convex-client";

import { ShowcaseWorkSelector } from "./showcase-work-selector";

const APPLY_PROPOSAL_SCHEMA = z
  .string()
  .transform(sanitizeMultilineInput)
  .pipe(z.string().min(10, "Proposal is required and must be at least 10 characters."))
  .pipe(z.string().max(1000, "Proposal must be under 1000 characters."));

export function ApplyToJobForm({
  job,
  hasApplied,
  isCheckingApplicationStatus,
  onApplied,
}: {
  job: TConvexDoc<"jobs">;
  hasApplied: boolean;
  isCheckingApplicationStatus: boolean;
  onApplied: () => void;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const applyToJob = useMutation(api.applications.applyToJob);
  const [proposal, setProposal] = useState("");
  const [showcasedWorkEscrowId, setShowcasedWorkEscrowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isJobOpen =
    job.status === "open" || (job.status === "funded" && !job.selectedFreelancerWallet);
  const isClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);

  if (!walletIdentity.isConnected) {
    return (
      <WalletConnectTrigger
        label="Connect Wallet to Apply"
        className="hr-v2-button-primary rounded-lg px-8 py-2.5 text-sm font-medium text-white"
      />
    );
  }

  if (!isJobOpen) {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-sans text-xs font-medium text-amber-800">
        Applications closed
      </span>
    );
  }

  if (isClient) {
    return (
      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 font-sans text-xs font-medium text-blue-800">
        You are the client for this job
      </span>
    );
  }

  if (isCheckingApplicationStatus) {
    return (
      <span className="inline-flex rounded-full border border-border bg-muted/50 px-3 py-1.5 font-sans text-xs font-medium">
        Checking application status...
      </span>
    );
  }

  if (hasApplied) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-sans text-xs font-medium text-emerald-800">
        Application submitted
      </span>
    );
  }

  const handleApply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletIdentity.walletAddress) {
      const nextWarning = "Connect wallet to apply.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    const parsedProposal = APPLY_PROPOSAL_SCHEMA.safeParse(proposal);
    if (!parsedProposal.success) {
      const nextWarning = parsedProposal.error.issues[0]?.message ?? "Proposal is invalid.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await applyToJob({
        jobId: job._id as TConvexId<"jobs">,
        freelancerWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        ...(showcasedWorkEscrowId ? { showcasedWorkEscrowId } : {}),
        proposal: parsedProposal.data,
      });

      setProposal("");
      setShowcasedWorkEscrowId(null);
      showSuccessToast(`Application submitted for "${job.title}".`);
      onApplied();
    } catch (caughtError) {
      const readableError = getReadableErrorMessage(
        caughtError,
        "Failed to submit application. Please try again.",
      );

      const nextError = readableError.toLowerCase().includes("already applied")
        ? "You already applied to this job."
        : readableError;
      setError(nextError);
      showErrorToast(nextError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <ResponsiveDialog>
        <ResponsiveDialogTrigger asChild>
          <AppButton type="button" variant="primary" size="lg" className="px-8 text-sm">
            Apply to Job
          </AppButton>
        </ResponsiveDialogTrigger>

        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="hr-text-primary text-lg sm:text-xl">
              Apply to {job.title}
            </ResponsiveDialogTitle>

            <ResponsiveDialogDescription className="hr-text-secondary text-sm">
              Share relevant experience, timeline, and delivery approach.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <ResponsiveDialogBody className="max-h-[70vh] overflow-y-auto">
            <form onSubmit={handleApply} className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="job-application-proposal">Proposal</Label>
                <AppTextarea
                  id="apply-proposal"
                  rows={6}
                  value={proposal}
                  maxLength={1200}
                  onChange={(event) => {
                    setProposal(event.target.value);
                    setError(null);
                  }}
                  placeholder="Highlight your relevant experience and expected delivery timeline."
                  className="rounded-lg"
                />
              </div>

              <ShowcaseWorkSelector
                freelancerWallet={walletIdentity.walletAddress}
                selectedEscrowId={showcasedWorkEscrowId}
                onSelectedEscrowIdChange={setShowcasedWorkEscrowId}
              />

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setProposal("");
                    setShowcasedWorkEscrowId(null);
                    setError(null);
                  }}
                >
                  Cancel
                </AppButton>

                <AppButton type="submit" disabled={isSubmitting} variant="primary">
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </AppButton>
              </div>
            </form>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
