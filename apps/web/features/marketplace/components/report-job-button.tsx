"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { showSuccessToast } from "@/features/common";
import { api } from "@repo/convex-client";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button as AppButton } from "@repo/ui/components/ui/button";
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

  return (
    <div className="space-y-2">
      <AppButton
        type="button"
        variant="secondary"
        onClick={() => setIsDialogOpen(true)}
        className="h-9 px-3 text-xs"
      >
        <Flag className="h-3.5 w-3.5" />
        Report suspicious job
      </AppButton>

      {(reportCount ?? 0) >= 3 ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900" role="note">
          <AlertDescription>This job has multiple reports. Proceed carefully.</AlertDescription>
        </Alert>
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
