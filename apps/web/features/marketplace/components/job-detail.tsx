"use client";

import type { TConvexId } from "@repo/convex-client";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";

import { ApplicationsList } from "./applications-list";
import { ApplyToJobForm } from "./apply-to-job-form";
import { EscrowActionPanel } from "./escrow-action-panel";
import { StatusBadge } from "./status-badge";

export function JobDetail({ jobId }: { jobId: string }) {
  const normalizedJobId = jobId.trim();
  const hasJobId = normalizedJobId.length > 0;
  const convexJobId = normalizedJobId as TConvexId<"jobs">;

  const job = useQuery(api.jobs.getJob, hasJobId ? { jobId: convexJobId } : "skip");
  const applications = useQuery(
    api.applications.listApplicationsByJob,
    hasJobId ? { jobId: convexJobId } : "skip",
  );
  const escrow = useQuery(api.escrows.getEscrowByJobId, hasJobId ? { jobId: convexJobId } : "skip");

  if (!hasJobId) {
    return <p className="text-sm text-gray-700">Job not found.</p>;
  }

  if (job === undefined) {
    return <p className="text-sm text-gray-500">Loading job...</p>;
  }

  if (job === null) {
    return <p className="text-sm text-gray-700">Job not found.</p>;
  }

  const safeApplications = applications ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">{job.title}</h1>
          <StatusBadge label={job.status} />
        </div>

        <p className="mb-5 text-sm leading-relaxed text-gray-700">{job.description}</p>

        <dl className="grid gap-4 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Budget</dt>
            <dd className="font-medium">{job.budget.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Asset</dt>
            <dd className="font-medium break-all">{job.asset}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Client wallet</dt>
            <dd className="font-medium">{shortenWalletAddress(job.clientWallet)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Selected freelancer wallet</dt>
            <dd className="font-medium">{shortenWalletAddress(job.selectedFreelancerWallet)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Job hash</dt>
            <dd className="font-medium break-all">{job.jobHash}</dd>
          </div>
        </dl>
      </section>

      <EscrowActionPanel job={job} escrow={escrow} applications={safeApplications} />

      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Apply</h2>
        <ApplyToJobForm job={job} onApplied={() => {}} />
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Applications</h2>
        <ApplicationsList
          job={job}
          applications={applications}
          isLoading={applications === undefined}
          onSelected={() => {}}
        />
      </section>
    </div>
  );
}
