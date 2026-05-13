import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { Badge } from "@repo/ui/components/ui/badge";
import Link from "next/link";

import type { TClientRecentJob } from "@/features/client-profile/types";

export function RecentClientJobsSection({ jobs }: { readonly jobs: readonly TClientRecentJob[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Recent jobs posted</h2>
      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e8e8e8] bg-white p-5 text-sm text-[#5f5f5f]">
          No jobs posted by this client yet.
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <article
              key={job.jobId}
              className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm"
            >
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
                <p className="font-semibold text-[#0a0a0a] md:text-right">
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
