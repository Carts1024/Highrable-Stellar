"use client";

import { AppButton } from "@/core/ui/button";
import { ProductPageHero } from "@/features/common";
import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

import type { TConvexId } from "@repo/convex-client";

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

  // Strictly typed reputation data retrieval.
  const verifiedReviewData = useQuery(
    api.reputation_records.queries.getVerifiedReviewForJob,
    hasJobId ? { jobId: convexJobId } : "skip",
  );

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
      <ProductPageHero
        label="Job Detail"
        title={
          <>
            {job.title} <span className="text-[#FF7003]">Execution Flow</span>
          </>
        }
        description="Review posting terms, application progress, escrow status, and verified completion data in a single workflow surface."
      />

      <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-[#0a0a0a]">Contract Snapshot</h2>
          <StatusBadge label={job.status} />
        </div>

        <p className="mb-5 text-sm leading-relaxed text-[#5f5f5f]">{job.description}</p>

        <dl className="grid gap-4 text-sm text-[#5f5f5f] sm:grid-cols-2">
          <div>
            <dt className="text-[#7f7f7f]">Budget</dt>
            <dd className="font-semibold text-[#0a0a0a]">{job.budget.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-[#7f7f7f]">Asset</dt>
            <dd className="font-semibold break-all text-[#0a0a0a]">{job.asset}</dd>
          </div>
          <div>
            <dt className="text-[#7f7f7f]">Client wallet</dt>
            <dd className="font-semibold text-[#0a0a0a]">
              {shortenWalletAddress(job.clientWallet)}
            </dd>
          </div>
          <div>
            <dt className="text-[#7f7f7f]">Selected freelancer wallet</dt>
            <dd className="font-semibold text-[#0a0a0a]">
              {shortenWalletAddress(job.selectedFreelancerWallet)}
            </dd>
          </div>
          <div>
            <dt className="text-[#7f7f7f]">Job hash</dt>
            <dd className="font-semibold break-all text-[#0a0a0a]">{job.jobHash}</dd>
          </div>
        </dl>
      </section>

      <EscrowActionPanel job={job} escrow={escrow} applications={safeApplications} />

      {hasReleasedCompletion ? (
        <section className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Verified completion</h2>

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
              <AppButton
                type="button"
                disabled={isSyncing}
                onClick={() => void syncReputationRecord()}
                appVariant="secondary"
                className="h-8 rounded-lg border-amber-300 px-3 py-1.5 text-xs hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSyncing ? "Syncing..." : "Sync verified review"}
              </AppButton>
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

      <section className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0a0a0a]">Apply</h2>
        <ApplyToJobForm job={job} onApplied={() => {}} />
      </section>

      <section className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0a0a0a]">Applications</h2>
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
