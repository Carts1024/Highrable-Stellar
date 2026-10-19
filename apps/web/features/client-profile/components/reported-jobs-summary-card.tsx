import { RouteCallout } from "@/features/common";
import React from "react";

import type { TReportedJobsSummary } from "@/features/client-profile/types";

export function ReportedJobsSummaryCard({ summary }: { readonly summary: TReportedJobsSummary }) {
  return (
    <RouteCallout tone="warning">
      <p className="font-medium">
        {summary.reportedJobsCount} reported {summary.reportedJobsCount === 1 ? "job" : "jobs"} ·{" "}
        {summary.totalReports} {summary.totalReports === 1 ? "report" : "reports"} in total
      </p>
      <p className="mt-0.5">
        Some jobs posted by this wallet were reported by users. Reports are not final moderation
        decisions.
      </p>
    </RouteCallout>
  );
}
