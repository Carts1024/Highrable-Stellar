"use client";

import { sanitizeMultilineInput } from "@/features/common";
import { TrustSafetyNotice } from "@/features/marketplace/components/trust-safety-notice";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useEffect, useState } from "react";
import { z } from "zod";

interface IJobApplicationDialogProps {
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly jobTitle: string;
  readonly errorMessage: string | null;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onSubmit: (proposal: string) => Promise<void>;
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
  errorMessage,
  onOpenChange,
  onSubmit,
}: IJobApplicationDialogProps) {
  const [proposal, setProposal] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProposal("");
      setValidationError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = APPLY_PROPOSAL_SCHEMA.safeParse(proposal);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Proposal is invalid.");
      return;
    }

    setValidationError(null);
    await onSubmit(parsed.data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-[#e8e8e8] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#0a0a0a]">Apply to {jobTitle}</DialogTitle>
          <DialogDescription className="text-[#5f5f5f]">
            Share relevant experience, timeline, and delivery approach.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TrustSafetyNotice type="unfunded" compact />
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
      </DialogContent>
    </Dialog>
  );
}
