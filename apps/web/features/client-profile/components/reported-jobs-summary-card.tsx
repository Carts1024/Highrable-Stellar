import { AlertTriangle } from "lucide-react";

import type { TReportedJobsSummary } from "@/features/client-profile/types";

export function ReportedJobsSummaryCard({ summary }: { readonly summary: TReportedJobsSummary }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Reported jobs summary</h2>
          <p className="text-sm text-[#5f5f5f]">
            Some jobs posted by this wallet have been reported by users. Reports are not final
            moderation decisions.
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
              <dt className="text-[#7f7f7f]">Reported jobs</dt>
              <dd className="font-semibold text-[#0a0a0a]">{summary.reportedJobsCount}</dd>
            </div>
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
              <dt className="text-[#7f7f7f]">Total reports</dt>
              <dd className="font-semibold text-[#0a0a0a]">{summary.totalReports}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
