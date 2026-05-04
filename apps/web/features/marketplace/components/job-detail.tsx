"use client";

import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

import type { TConvexDoc, TConvexId } from "@repo/convex-client";

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
  const verifiedReviewData = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).reputation.getVerifiedReviewForJob,
    hasJobId ? { jobId: convexJobId } : "skip",
  ) as
    | {
        job: TConvexDoc<"jobs">;
        escrow: TConvexDoc<"escrows">;
        reputationRecord: TConvexDoc<"reputationRecords"> | null;
      }
    | null
    | undefined;
  const { isSyncing, syncReputationRecord, syncMessage, syncResult } = useSyncActions({ escrow });

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
  const mergedEscrow = verifiedReviewData?.escrow ?? escrow ?? null;
  const reputationRecord = verifiedReviewData?.reputationRecord ?? null;
  const hasReleasedCompletion = mergedEscrow?.status === "released" || job.status === "completed";
  const showPendingSyncState =
    hasReleasedCompletion && mergedEscrow?.status === "released" && !reputationRecord;

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

      {hasReleasedCompletion ? (
        <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Verified completion</h2>

          {reputationRecord && mergedEscrow ? (
            <VerifiedReviewCard
              jobTitle={job.title}
              escrowId={mergedEscrow.escrowId}
              clientWallet={mergedEscrow.clientWallet}
              freelancerWallet={mergedEscrow.freelancerWallet}
              amount={mergedEscrow.amount}
              asset={mergedEscrow.asset}
              rating={reputationRecord.rating}
              reviewText={reputationRecord.reviewText}
              reviewHash={reputationRecord.reviewHash}
              txHash={reputationRecord.txHash ?? mergedEscrow.releaseTxHash}
              createdAt={reputationRecord.createdAt}
            />
          ) : null}

          {showPendingSyncState ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>Payment was released, but the verified review record has not synced yet.</p>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void syncReputationRecord()}
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSyncing ? "Syncing..." : "Sync verified review"}
              </button>
              {syncMessage ? (
                <p className={`text-xs ${syncResult?.ok ? "text-emerald-700" : "text-red-700"}`}>
                  {syncMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {!reputationRecord && !showPendingSyncState ? (
            <p className="text-sm text-gray-500">Could not load verified review.</p>
          ) : null}
        </section>
      ) : null}

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
