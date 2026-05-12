"use client";

import { AppButton } from "@/core/ui/button";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import { Flag } from "lucide-react";
import { useState } from "react";

import type { TConvexId } from "@repo/convex-client";

import { ReportJobDialog } from "./report-job-dialog";

interface IReportJobButtonProps {
  readonly jobId: TConvexId<"jobs">;
}

export function ReportJobButton({ jobId }: IReportJobButtonProps) {
  const { address } = useWallet();
  const reportCount = useQuery(api.reports.getJobReportCount, { jobId });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <AppButton
        type="button"
        appVariant="secondary"
        onClick={() => {
          setSuccessMessage(null);
          setIsDialogOpen(true);
        }}
        className="h-9 px-3 text-xs"
      >
        <Flag className="h-3.5 w-3.5" />
        Report suspicious job
      </AppButton>

      {successMessage ? (
        <p className="text-sm text-emerald-700" role="status">
          {successMessage}
        </p>
      ) : null}

      {(reportCount ?? 0) >= 3 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This job has multiple reports. Proceed carefully.
        </p>
      ) : null}

      <ReportJobDialog
        isOpen={isDialogOpen}
        jobId={jobId}
        reporterWallet={address ?? undefined}
        onOpenChange={setIsDialogOpen}
        onReported={() => setSuccessMessage("Thanks. This job has been reported for review.")}
      />
    </div>
  );
}
