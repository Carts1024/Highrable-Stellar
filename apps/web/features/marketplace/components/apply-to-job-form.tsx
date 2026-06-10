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
import { HighrableV2IconNotice, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
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
      <div className="border border-gray-200 bg-gray-50 p-4">
        <p className="mb-3 text-sm text-gray-700">Connect wallet to apply.</p>
        <WalletConnectTrigger className="hr-v2-button-primary rounded-none px-4 py-2 text-sm font-medium text-white" />
      </div>
    );
  }

  if (!isJobOpen) {
    return <p className="text-sm text-gray-600">Applications are closed for this job.</p>;
  }

  if (isClient) {
    return <p className="text-sm text-gray-600">Client cannot apply to their own job.</p>;
  }

  if (isCheckingApplicationStatus) {
    return <p className="text-sm text-gray-600">Checking application status...</p>;
  }

  if (hasApplied) {
    return <p className="text-sm text-emerald-700">You already applied to this job.</p>;
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
    <section className="flex flex-wrap items-center justify-between gap-4 border border-[#e8e8e8] bg-white p-5">
      <div className="space-y-2">
        <SectionLabel>Freelancer Action</SectionLabel>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Apply</h2>
          <HighrableV2IconNotice
            label="Apply safety notice"
            tone={job.status === "funded" ? "success" : "warning"}
            message={
              job.status === "funded"
                ? "Escrow funding is verified. Still keep all work and approvals in Highrable."
                : "Only start work after this job shows Verified Funded."
            }
          />
        </div>
      </div>
      <ResponsiveDialog>
        <ResponsiveDialogTrigger asChild>
          <AppButton type="button" className="hr-v2-button-primary rounded-none">
            Apply to Job
          </AppButton>
        </ResponsiveDialogTrigger>
        <ResponsiveDialogContent className="rounded-none sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Apply to Job</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Send a focused proposal and optionally attach verified work history.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label
                  htmlFor="apply-proposal"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Short proposal
                </label>
                <AppTextarea
                  id="apply-proposal"
                  rows={4}
                  value={proposal}
                  maxLength={1200}
                  onChange={(event) => {
                    setProposal(event.target.value);
                    setError(null);
                  }}
                  placeholder="Highlight your relevant experience and timeline"
                />
              </div>

              <ShowcaseWorkSelector
                freelancerWallet={walletIdentity.walletAddress}
                selectedEscrowId={showcasedWorkEscrowId}
                onSelectedEscrowIdChange={setShowcasedWorkEscrowId}
              />

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <AppButton
                type="submit"
                disabled={isSubmitting}
                className="hr-v2-button-primary rounded-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Applying..." : "Submit Application"}
              </AppButton>
            </form>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </section>
  );
}
