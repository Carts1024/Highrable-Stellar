"use client";

import { JobDetail } from "@/features/marketplace/components/job-detail";

export function JobDetailPage({ jobId }: { jobId: string }) {
  return <JobDetail jobId={jobId} />;
}
