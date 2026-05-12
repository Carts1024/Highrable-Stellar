"use client";

import { AppButton } from "@/core/ui/button";
import { AppTextarea } from "@/core/ui/textarea";
import { sanitizeMultilineInput } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { api } from "@repo/convex-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client";

export type TReportReason = "scam" | "off_platform" | "spam" | "fake_job" | "other";

interface IReportJobDialogProps {
  readonly isOpen: boolean;
  readonly jobId: TConvexId<"jobs">;
  readonly reporterWallet?: string;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onReported: () => void;
}

const REPORT_REASONS: Array<{ value: TReportReason; label: string }> = [
  { value: "scam", label: "Scam" },
  { value: "off_platform", label: "Off-platform request" },
  { value: "spam", label: "Spam" },
  { value: "fake_job", label: "Fake job" },
  { value: "other", label: "Other" },
];

const REPORT_DETAILS_SCHEMA = z
  .string()
  .transform(sanitizeMultilineInput)
  .pipe(z.string().max(1000, "Details must be under 1000 characters."));

export function ReportJobDialog({
  isOpen,
  jobId,
  reporterWallet,
  onOpenChange,
  onReported,
}: IReportJobDialogProps) {
  const reportJob = useMutation(api.reports.reportJob);
  const [reason, setReason] = useState<TReportReason>("scam");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason("scam");
      setDetails("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedDetails = REPORT_DETAILS_SCHEMA.safeParse(details);
    if (!parsedDetails.success) {
      setError(parsedDetails.error.issues[0]?.message ?? "Report details are invalid.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await reportJob({
        jobId,
        reason,
        ...(reporterWallet ? { reporterWallet } : {}),
        ...(parsedDetails.data ? { details: parsedDetails.data } : {}),
      });
      onReported();
      onOpenChange(false);
    } catch (caughtError) {
      setError(getReadableErrorMessage(caughtError, "Failed to report this job."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[#e8e8e8] bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#0a0a0a]">Report suspicious job</DialogTitle>
          <DialogDescription className="text-[#5f5f5f]">
            Reports help flag jobs for manual review. Jobs are not removed automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="report-job-reason" className="block text-sm font-medium text-[#0a0a0a]">
              Reason
            </label>
            <select
              id="report-job-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as TReportReason)}
              className="h-11 w-full rounded-lg border border-[#e8e8e8] bg-white px-3 text-sm text-[#0a0a0a] outline-hidden transition-colors focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]/20"
            >
              {REPORT_REASONS.map((reportReason) => (
                <option key={reportReason.value} value={reportReason.value}>
                  {reportReason.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="report-job-details"
              className="block text-sm font-medium text-[#0a0a0a]"
            >
              Details
            </label>
            <AppTextarea
              id="report-job-details"
              rows={4}
              value={details}
              maxLength={1000}
              onChange={(event) => {
                setDetails(event.target.value);
                setError(null);
              }}
              placeholder="Optional context for review"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <AppButton type="button" appVariant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </AppButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
