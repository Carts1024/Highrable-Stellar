import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { AlertTriangle, Flag } from "lucide-react";

import type { TReportedJobsSummary } from "@/features/client-profile/types";

export function ReportedJobsSummaryCard({ summary }: { readonly summary: TReportedJobsSummary }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--mode-border)] bg-white shadow-sm">
      <div className="hr-card-head p-5 sm:px-6">
        <SectionLabel>Reports</SectionLabel>
        <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">Reported Jobs Summary</h2>
        <p className="mt-1 max-w-3xl text-sm text-[#5f5f5f]">
          Some jobs posted by this wallet have been reported by users. Reports are not final
          moderation decisions.
        </p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <HighrableV2Metric
          tone="rose"
          icon={<Flag className="h-5 w-5" aria-hidden="true" />}
          label="Reported jobs"
          value={summary.reportedJobsCount}
        />
        <HighrableV2Metric
          tone="yellow"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          label="Total reports"
          value={summary.totalReports}
        />
      </div>
    </section>
  );
}
