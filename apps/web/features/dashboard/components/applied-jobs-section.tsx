"use client";

import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useFreelancerAppliedJobs } from "@/features/dashboard/hooks/use-freelancer-applied-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function AppliedJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerAppliedJobs();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel>Applications</SectionLabel>
          <h2 className="mt-2 text-lg font-semibold text-[#0a0a0a]">Applied jobs</h2>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Jobs you applied to with your current application status.
          </p>
        </div>
      </div>

      <div className="border-y border-[#e8e8e8]">
        {isInitialLoading ? (
          <p className="px-1 py-5 text-sm text-[#5f5f5f] sm:px-4">Loading applications...</p>
        ) : items.length === 0 ? (
          <p className="bg-[#fafafa] px-1 py-10 text-center text-sm text-[#5f5f5f] sm:px-4">
            You have not applied to any jobs yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Escrow</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Proposal</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.applicationId} className="hover:bg-[#fff7ed]/40">
                  <TableCell className="max-w-55 font-medium">
                    <p className="hr-text-primary truncate">{item.title}</p>
                    {item.milestoneTitle ? (
                      <p className="hr-text-muted truncate text-xs font-normal">
                        Milestone: {item.milestoneTitle}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(item.applicationCreatedAt)}</TableCell>
                  <TableCell>
                    <StatusPill label={item.derivedApplicationStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusPill label={item.jobStatus} />
                  </TableCell>
                  <TableCell>
                    {item.escrowStatus ? <StatusPill label={item.escrowStatus} /> : "-"}
                  </TableCell>
                  <TableCell>
                    {formatAmount(item.budget)} {formatAsset(item.asset)}
                  </TableCell>
                  <TableCell className="hr-text-secondary max-w-70 truncate">
                    {item.proposalPreview || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <AppButton
                      asChild
                      variant="secondary"
                      className="h-8 rounded-none px-3 text-xs"
                    >
                      <Link href={`/marketplace/jobs/${item.jobId}`}>
                        <BriefcaseBusiness className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </AppButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {(canLoadMore || isLoadingMore) && (
        <div className="flex justify-end">
          <AppButton
            variant="secondary"
            onClick={() => loadMore(nextPageSize)}
            disabled={!canLoadMore || isLoadingMore}
            className="rounded-none"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </AppButton>
        </div>
      )}
    </section>
  );
}
