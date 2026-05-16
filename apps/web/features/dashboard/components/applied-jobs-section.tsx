"use client";

import { StatusPill } from "@/features/dashboard/components/status-pill";
import { useFreelancerAppliedJobs } from "@/features/dashboard/hooks/use-freelancer-applied-jobs";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { BriefcaseBusiness, FileSearch } from "lucide-react";
import Link from "next/link";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export function AppliedJobsSection() {
  const { items, isInitialLoading, canLoadMore, isLoadingMore, loadMore, nextPageSize } =
    useFreelancerAppliedJobs();

  return (
    <Card className="border-[#e8e8e8] bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#0a0a0a]">
          <FileSearch className="h-5 w-5 text-[#FF7003]" />
          Applications
        </CardTitle>
        <CardDescription>Jobs you applied to with your current application status.</CardDescription>
      </CardHeader>
      <CardContent>
        {isInitialLoading ? (
          <p className="text-sm text-gray-500">Loading applications...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
            <p className="text-sm text-gray-500">You have not applied to any jobs yet.</p>
          </div>
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
                <TableRow key={item.applicationId}>
                  <TableCell className="max-w-55 font-medium">
                    <p className="truncate">{item.title}</p>
                    {item.milestoneTitle ? (
                      <p className="truncate text-xs font-normal text-gray-500">
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
                  <TableCell className="max-w-70 truncate text-gray-500">
                    {item.proposalPreview || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <AppButton asChild variant="secondary" className="h-8 px-3 text-xs">
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
      </CardContent>
      {(canLoadMore || isLoadingMore) && (
        <CardFooter className="justify-end border-t pt-4">
          <AppButton
            variant="secondary"
            onClick={() => loadMore(nextPageSize)}
            disabled={!canLoadMore || isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </AppButton>
        </CardFooter>
      )}
    </Card>
  );
}
