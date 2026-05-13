"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { ProductPageHero } from "@/features/common";
import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { formatAmount } from "@/features/dashboard/lib/format";
import { useSyncActions } from "@/features/marketplace/hooks/use-sync-actions";
import { getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { analyzeJobScamSignals } from "@/features/marketplace/lib/scam-signals";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import type { TConvexId } from "@repo/convex-client";

import { ApplicationsList } from "./applications-list";
import { ApplyToJobForm } from "./apply-to-job-form";
import { ClientTrustCard } from "./client-trust-card";
import { EscrowActionPanel } from "./escrow-action-panel";
import { FreelancerSafetyChecklist } from "./freelancer-safety-checklist";
import { JobSafetyBadge } from "./job-safety-badge";
import { MilestoneCard } from "./milestone-card";
import { ReportJobButton } from "./report-job-button";
import { StatusBadge } from "./status-badge";
import { TrustSafetyNotice } from "./trust-safety-notice";

type TEscrowSyncMetadata = {
  lastSyncAt?: number;
  lastSyncOutcome?: "success" | "failed";
  lastSyncedOnChainStatus?: string;
  lastSyncErrorMessage?: string;
};

export function JobDetail({ jobId }: { jobId: string }) {
  const { address } = useWallet();
  const normalizedJobId = jobId.trim();
  const hasJobId = normalizedJobId.length > 0;
  const convexJobId = normalizedJobId as TConvexId<"jobs">;

  const job = useQuery(api.jobs.getJob, hasJobId ? { jobId: convexJobId } : "skip");
  const applications = useQuery(
    api.applications.listApplicationsByJob,
    hasJobId ? { jobId: convexJobId } : "skip",
  );
  const escrow = useQuery(api.escrows.getEscrowByJobId, hasJobId ? { jobId: convexJobId } : "skip");
  const milestoneSummary = useQuery(
    api.milestones.getMilestoneProjectSummary,
    hasJobId ? { jobId: convexJobId } : "skip",
  );

  // Strictly typed reputation data retrieval.
  const verifiedReviewData = useQuery(
    api.reputation_records.queries.getVerifiedReviewForJob,
    hasJobId ? { jobId: convexJobId } : "skip",
  );

  const { isSyncing, syncEscrowStatus, syncReputationRecord, syncMessage, syncResult } =
    useSyncActions({ escrow });

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
  const mergedEscrowWithSyncMetadata =
    mergedEscrow === null ? null : (mergedEscrow as typeof mergedEscrow & TEscrowSyncMetadata);
  const reputationRecord = verifiedReviewData?.reputationRecord ?? null;
  const hasReleasedCompletion = mergedEscrow?.status === "released" || job.status === "completed";
  const showPendingSyncState =
    hasReleasedCompletion && mergedEscrow?.status === "released" && !reputationRecord;
  const safetyStatus = getJobSafetyStatus({ job, escrow: mergedEscrow });
  const isSelectedConnectedFreelancer = isSameWallet(address, job.selectedFreelancerWallet);
  const scamAnalysis = analyzeJobScamSignals({
    title: job.title,
    description: job.description,
  });
  const jobType = job.jobType ?? "micro_gig";
  const isMilestoneProject = jobType === "milestone_project";
  const projectSummary = milestoneSummary;

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
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <JobSafetyBadge status={safetyStatus.status} />
            <StatusBadge label={mergedEscrow?.status ?? job.status} />
          </div>
        </div>

        <div className="mb-4 space-y-3">
          <TrustSafetyNotice type="off_platform" />
          {safetyStatus.status === "unfunded" ? (
            <TrustSafetyNotice
              type={isSelectedConnectedFreelancer ? "selected_unfunded" : "unfunded"}
            />
          ) : null}
          {safetyStatus.status === "escrow_created" ? (
            <TrustSafetyNotice type="selected_unfunded" />
          ) : null}
          {safetyStatus.status === "verified_funded" ? (
            <TrustSafetyNotice type="verified_funded" />
          ) : null}
        </div>

        {scamAnalysis.riskLevel !== "low" ? (
          <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900" role="note">
            <AlertTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Suspicious language detected
            </AlertTitle>
            <AlertDescription>
              <p>
                This job may look suspicious because it asks users to move off-platform or pay
                upfront.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {scamAnalysis.signals.map((signal) => (
                  <li key={signal.type}>{signal.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <p className="mb-5 text-sm leading-relaxed text-[#5f5f5f]">{job.description}</p>

        <dl className="grid gap-4 text-sm text-[#5f5f5f] sm:grid-cols-2">
          <div>
            <dt className="text-[#7f7f7f]">Work mode</dt>
            <dd className="font-semibold text-[#0a0a0a]">
              {isMilestoneProject ? "Milestone Project" : "Micro Gig"}
            </dd>
          </div>
          <div>
            <dt className="text-[#7f7f7f]">Budget</dt>
            <dd className="font-semibold text-[#0a0a0a]">
              {formatAmount(job.totalBudget ?? job.budget)} {formatAssetLabel(job.asset)}
            </dd>
          </div>
          <div>
            <dt className="text-[#7f7f7f]">Asset</dt>
            <dd className="font-semibold text-[#0a0a0a]">{formatAssetLabel(job.asset)}</dd>
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
              {job.selectedFreelancerWallet ? (
                <Link
                  href={`/freelancers/${encodeURIComponent(job.selectedFreelancerWallet)}`}
                  className="hover:text-[#FF7003]"
                >
                  {shortenWalletAddress(job.selectedFreelancerWallet)}
                </Link>
              ) : (
                shortenWalletAddress(job.selectedFreelancerWallet)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[#7f7f7f]">Job hash</dt>
            <dd className="font-semibold break-all text-[#0a0a0a]">{job.jobHash}</dd>
          </div>
        </dl>

        <div className="mt-5">
          <ReportJobButton jobId={convexJobId} />
        </div>
      </section>

      <ClientTrustCard clientWallet={job.clientWallet} />

      {!isMilestoneProject ? (
        <>
          <FreelancerSafetyChecklist job={job} escrow={mergedEscrow} connectedWallet={address} />

          <EscrowActionPanel job={job} escrow={escrow} applications={safeApplications} />
        </>
      ) : null}

      {isMilestoneProject ? (
        <section className="space-y-5">
          <div className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#0a0a0a]">Milestone Progress</h2>
                <p className="mt-1 text-sm text-[#5f5f5f]">
                  Funding and Verified Funded status are tracked per milestone, not for the whole
                  project.
                </p>
              </div>
              <StatusBadge label={job.status} />
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
              <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
                <dt className="text-[#7f7f7f]">Total</dt>
                <dd className="font-semibold text-[#0a0a0a]">
                  {projectSummary?.milestones.length ?? job.milestoneCount ?? 0}
                </dd>
              </div>
              <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
                <dt className="text-[#7f7f7f]">Paid</dt>
                <dd className="font-semibold text-[#0a0a0a]">
                  {projectSummary?.milestoneCountsByStatus.released ?? 0}
                </dd>
              </div>
              <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
                <dt className="text-[#7f7f7f]">Funded</dt>
                <dd className="font-semibold text-[#0a0a0a]">
                  {projectSummary?.milestoneCountsByStatus.funded ?? 0}
                </dd>
              </div>
              <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
                <dt className="text-[#7f7f7f]">Open</dt>
                <dd className="font-semibold text-[#0a0a0a]">
                  {projectSummary?.milestoneCountsByStatus.open ?? 0}
                </dd>
              </div>
              <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
                <dt className="text-[#7f7f7f]">Disputed</dt>
                <dd className="font-semibold text-[#0a0a0a]">
                  {projectSummary?.milestoneCountsByStatus.disputed ?? 0}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-sm font-medium text-[#0a0a0a]">
              {projectSummary?.milestoneCountsByStatus.released ?? 0} of{" "}
              {projectSummary?.milestones.length ?? job.milestoneCount ?? 0} milestones paid
            </p>
          </div>

          {projectSummary === undefined ? (
            <p className="text-sm text-gray-500">Loading milestones...</p>
          ) : null}
          {projectSummary?.milestones.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e8e8e8] bg-white p-5 text-sm text-[#5f5f5f]">
              No milestones found for this project.
            </p>
          ) : null}
          {projectSummary?.milestones.map((milestone, index) => {
            const applicationGate = projectSummary.applicationGates[index];

            if (!applicationGate) {
              return null;
            }

            return (
              <MilestoneCard
                key={milestone._id}
                job={job}
                milestone={milestone}
                applicationGate={applicationGate}
              />
            );
          })}
        </section>
      ) : null}

      {!isMilestoneProject && mergedEscrowWithSyncMetadata ? (
        <section className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#0a0a0a]">Escrow Sync Status</h2>
            <AppButton
              type="button"
              variant="secondary"
              disabled={isSyncing}
              onClick={() => void syncEscrowStatus()}
              className="h-8 rounded-lg px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSyncing ? "Syncing..." : "Sync with Stellar"}
            </AppButton>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
              <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Convex status</dt>
              <dd className="mt-1 font-semibold text-[#0a0a0a]">
                {mergedEscrowWithSyncMetadata.status}
              </dd>
            </div>
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
              <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
                Last synced chain status
              </dt>
              <dd className="mt-1 font-semibold text-[#0a0a0a]">
                {mergedEscrowWithSyncMetadata.lastSyncedOnChainStatus ?? "Not synced yet"}
              </dd>
            </div>
            <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
              <dt className="text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
                Last sync result
              </dt>
              <dd className="mt-1 font-semibold text-[#0a0a0a]">
                {mergedEscrowWithSyncMetadata.lastSyncOutcome ?? "Unknown"}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-[#5f5f5f]">
            Last sync time:{" "}
            {mergedEscrowWithSyncMetadata.lastSyncAt
              ? new Date(mergedEscrowWithSyncMetadata.lastSyncAt).toLocaleString()
              : "Not synced yet"}
          </p>

          {mergedEscrowWithSyncMetadata.lastSyncErrorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {mergedEscrowWithSyncMetadata.lastSyncErrorMessage}
            </p>
          ) : null}

          {syncMessage ? (
            <p className={`text-sm ${syncResult?.ok ? "text-emerald-700" : "text-red-700"}`}>
              {syncMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {!isMilestoneProject && hasReleasedCompletion ? (
        <section className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Verified completion</h2>

          {reputationRecord && mergedEscrow ? (
            <VerifiedReviewCard
              jobTitle={job.title}
              escrowId={mergedEscrow.escrowId}
              clientWallet={mergedEscrow.clientWallet}
              freelancerWallet={mergedEscrow.freelancerWallet ?? ""}
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
                variant="secondary"
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

      {!isMilestoneProject ? (
        <>
          <section className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0a0a0a]">Apply</h2>
            <ApplyToJobForm job={job} onApplied={() => {}} />
          </section>

          <section className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0a0a0a]">Applications</h2>
            <ApplicationsList
              job={job}
              escrow={mergedEscrow}
              applications={applications}
              isLoading={applications === undefined}
              onSelected={() => {}}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
