"use client";

import { sanitizeMultilineInput, showErrorToast } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { api } from "@repo/convex-client";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@repo/ui/responsive-dialog";
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
      const nextError = getReadableErrorMessage(caughtError, "Failed to report this job.");
      setError(nextError);
      showErrorToast(nextError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="hr-text-primary text-xl">
            Report suspicious job
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Reports help flag jobs for manual review. Jobs are not removed automatically.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="report-job-reason"
                className="hr-text-primary block text-sm font-medium"
              >
                Reason
              </label>
              <Select value={reason} onValueChange={(value) => setReason(value as TReportReason)}>
                <SelectTrigger id="report-job-reason" className="h-11 w-full">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((reportReason) => (
                    <SelectItem key={reportReason.value} value={reportReason.value}>
                      {reportReason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="report-job-details"
                className="hr-text-primary block text-sm font-medium"
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
              <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-700">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              <AppButton
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </AppButton>
              <AppButton
                type="submit"
                disabled={isSubmitting}
                className="hr-v2-button-primary rounded-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </AppButton>
            </div>
          </form>
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
