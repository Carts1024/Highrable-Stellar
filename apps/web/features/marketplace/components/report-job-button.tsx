"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { showSuccessToast } from "@/features/common";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className="hr-text-secondary text-sm hover:text-destructive hover:underline"
      >
        Report this job
      </button>

      {(reportCount ?? 0) >= 3 ? (
        <p role="note" className="text-sm text-amber-800">
          This job has multiple reports. Proceed carefully.
        </p>
      ) : null}

      <ReportJobDialog
        isOpen={isDialogOpen}
        jobId={jobId}
        reporterWallet={address ?? undefined}
        onOpenChange={setIsDialogOpen}
        onReported={() => showSuccessToast("Thanks. This job has been reported for review.")}
      />
    </div>
  );
}
