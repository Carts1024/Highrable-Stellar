import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";

import type { TReportedJobsSummary } from "@/features/client-profile/types";

export function ReportedJobsSummaryCard({ summary }: { readonly summary: TReportedJobsSummary }) {
  return (
    <section className="border border-[#e8e8e8] bg-white">
      <div className="border-b border-[#e8e8e8] p-5 sm:p-6">
        <SectionLabel>Reports</SectionLabel>
        <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">Reported jobs summary</h2>
        <p className="mt-1 max-w-3xl text-sm text-[#5f5f5f]">
          Some jobs posted by this wallet have been reported by users. Reports are not final
          moderation decisions.
        </p>
      </div>
      <div className="grid gap-y-6 p-5 sm:grid-cols-2 sm:p-6">
        <HighrableV2Metric label="Reported jobs" value={summary.reportedJobsCount} />
        <HighrableV2Metric label="Total reports" value={summary.totalReports} />
      </div>
    </section>
  );
}
