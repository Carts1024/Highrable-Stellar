import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import Link from "next/link";

import type { TClientRecentJob } from "@/features/client-profile/types";

export function RecentClientJobsSection({ jobs }: { readonly jobs: readonly TClientRecentJob[] }) {
  return (
    <section className="border border-[#e8e8e8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e8e8] p-5 sm:p-6">
        <div>
          <SectionLabel>Posted Jobs</SectionLabel>
          <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">Recent jobs posted</h2>
        </div>
        <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
          {jobs.length} job{jobs.length === 1 ? "" : "s"}
        </p>
      </div>
      {jobs.length === 0 ? (
        <p className="p-5 text-sm text-[#5f5f5f] sm:p-6">No jobs posted by this client yet.</p>
      ) : (
        <div className="divide-y divide-[#e8e8e8]">
          {jobs.map((job) => (
            <article key={job.jobId} className="p-5 transition-colors hover:bg-[#fafafa]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-[#e8e8e8] bg-[#fafafa]">
                      {getClientWorkTypeLabel(job.jobType)}
                    </Badge>
                    <StatusBadge label={job.status} />
                  </div>
                  <Link
                    href={`/marketplace/jobs/${job.jobId}`}
                    className="font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
                  >
                    {job.title}
                  </Link>
                  <p className="text-sm text-[#5f5f5f]">Posted {formatShortDate(job.createdAt)}</p>
                </div>
                <p className="min-w-44 font-semibold text-[#0a0a0a] md:text-right">
                  {formatAmount(job.totalBudget)} {formatAsset(job.asset)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
