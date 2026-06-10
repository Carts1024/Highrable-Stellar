"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { sanitizeMultilineInput } from "@/features/common";
import {
  TrustSafetyNotice,
  type TTrustSafetyNoticeType,
} from "@/features/marketplace/components/trust-safety-notice";
import { useOnboardingState } from "@/features/onboarding";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@repo/ui/responsive-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { ShowcaseWorkSelector } from "./showcase-work-selector";

interface IJobApplicationDialogProps {
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly jobTitle: string;
  readonly trustSafetyNoticeType: Extract<TTrustSafetyNoticeType, "unfunded" | "verified_funded">;
  readonly errorMessage: string | null;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onSubmit: (proposal: string, showcasedWorkEscrowId: string | null) => Promise<void>;
}

const APPLY_PROPOSAL_SCHEMA = z
  .string()
  .transform(sanitizeMultilineInput)
  .pipe(z.string().min(10, "Proposal should be at least 10 characters."))
  .pipe(z.string().max(1000, "Proposal must be under 1000 characters."));

/** Reusable application dialog for list-level job applications. */
export function JobApplicationDialog({
  isOpen,
  isSubmitting,
  jobTitle,
  trustSafetyNoticeType,
  errorMessage,
  onOpenChange,
  onSubmit,
}: IJobApplicationDialogProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const onboardingState = useOnboardingState();
  const router = useRouter();
  const [proposal, setProposal] = useState("");
  const [showcasedWorkEscrowId, setShowcasedWorkEscrowId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProposal("");
      setShowcasedWorkEscrowId(null);
      setValidationError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (onboardingState.isConnected && !onboardingState.isLoading && !onboardingState.isComplete) {
      router.push("/onboarding");
      return;
    }

    const parsed = APPLY_PROPOSAL_SCHEMA.safeParse(proposal);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Proposal is invalid.");
      return;
    }

    setValidationError(null);
    await onSubmit(parsed.data, showcasedWorkEscrowId);
  };

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-xl border-[#e8e8e8] bg-white">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-xl text-[#0a0a0a]">
            Apply to {jobTitle}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-[#5f5f5f]">
            Share relevant experience, timeline, and delivery approach.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TrustSafetyNotice type={trustSafetyNoticeType} compact />
            <p className="text-sm text-[#5f5f5f]">
              Only start work after this job shows Verified Funded.
            </p>

            <div className="space-y-2">
              <label
                htmlFor="job-application-proposal"
                className="block text-sm font-medium text-[#0a0a0a]"
              >
                Proposal
              </label>
              <AppTextarea
                id="job-application-proposal"
                rows={6}
                value={proposal}
                maxLength={1200}
                onChange={(event) => {
                  setProposal(event.target.value);
                  setValidationError(null);
                }}
                placeholder="Highlight your relevant experience and expected delivery timeline."
              />
            </div>

            <ShowcaseWorkSelector
              freelancerWallet={walletIdentity.walletAddress}
              selectedEscrowId={showcasedWorkEscrowId}
              onSelectedEscrowIdChange={setShowcasedWorkEscrowId}
            />

            {validationError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {validationError}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <AppButton type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </AppButton>
              <AppButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </AppButton>
            </div>
          </form>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
