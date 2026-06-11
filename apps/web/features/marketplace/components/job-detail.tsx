"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { isNativeXlmEscrowAsset } from "@/core/stellar/payment-assets";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { AttachmentList } from "@/features/attachments/components";
import { ConversationThread } from "@/features/chat";
import { ProductPageHero } from "@/features/common";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { getJobSafetyLabel, getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { analyzeJobScamSignals } from "@/features/marketplace/lib/scam-signals";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { WorkAgreementSetupPanel } from "@/features/work-agreements";
import { api } from "@repo/convex-client";
import {
  HighrableV2IconNotice,
  HighrableV2Metric,
} from "@repo/ui/components/highrable/v2-marketing";
import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
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

export function JobDetail({ jobId }: { jobId: string }) {
  const walletIdentity = useHighrableWalletIdentity();
  const normalizedJobId = jobId.trim();
  const hasJobId = normalizedJobId.length > 0;
  const convexJobId = normalizedJobId as TConvexId<"jobs">;

  const job = useQuery(api.jobs.getJob, hasJobId ? { jobId: convexJobId } : "skip");
  const applications = useQuery(
    api.applications.listApplicationsByJob,
    hasJobId ? { jobId: convexJobId } : "skip",
  );
  const hasAppliedToJob = useQuery(
    api.applications.hasAppliedToJob,
    hasJobId && walletIdentity.walletAddress
      ? { jobId: convexJobId, freelancerWallet: walletIdentity.walletAddress }
      : "skip",
  );
  const escrow = useQuery(api.escrows.getEscrowByJobId, hasJobId ? { jobId: convexJobId } : "skip");
  const milestoneSummary = useQuery(
    api.milestones.getMilestoneProjectSummary,
    hasJobId ? { jobId: convexJobId } : "skip",
  );
  const attachments = useQuery(
    api.attachments.listByParent,
    hasJobId
      ? {
          parentType: "job",
          parentId: convexJobId,
          ...(walletIdentity.walletAddress ? { viewerWallet: walletIdentity.walletAddress } : {}),
        }
      : "skip",
  );

  // Strictly typed reputation data retrieval.
  const verifiedReviewData = useQuery(
    api.reputation_records.queries.getVerifiedReviewForJob,
    hasJobId ? { jobId: convexJobId } : "skip",
  );

  if (!hasJobId) {
    return <p className="text-sm text-muted-foreground">Job not found.</p>;
  }

  if (job === undefined) {
    return <p className="text-sm text-muted-foreground">Loading job...</p>;
  }

  if (job === null) {
    return <p className="text-sm text-muted-foreground">Job not found.</p>;
  }

  const safeApplications = applications ?? [];
  const mergedEscrow = verifiedReviewData?.escrow ?? escrow ?? null;
  const safetyStatus = getJobSafetyStatus({ job, escrow: mergedEscrow });
  const isConnectedClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);
  const isSelectedConnectedFreelancer = isSameWallet(
    walletIdentity.walletAddress,
    job.selectedFreelancerWallet,
  );
  const canViewAgreementPanel = isConnectedClient || isSelectedConnectedFreelancer;
  const scamAnalysis = analyzeJobScamSignals({
    title: job.title,
    description: job.description,
  });
  const jobType = job.jobType ?? "micro_gig";
  const isMilestoneProject = jobType === "milestone_project";
  const isNativeXlmJob = isNativeXlmEscrowAsset(job.asset);
  const projectSummary = milestoneSummary;
  const marketplaceStatus = mergedEscrow?.status ?? job.status;
  const shouldShowMarketplaceStatusBadge =
    getJobSafetyLabel(safetyStatus.status) !== getMarketplaceStatusMeta(marketplaceStatus).label;
  const canShowWorkChat = Boolean(job.selectedFreelancerWallet || mergedEscrow?.freelancerWallet);
  const chatParent = mergedEscrow?.freelancerWallet
    ? ({
        parentType: "escrow" as const,
        parentId: mergedEscrow._id,
        title: `${job.title} escrow chat`,
      } as const)
    : ({
        parentType: "job" as const,
        parentId: convexJobId,
        title: `${job.title} work chat`,
      } as const);

  return (
    <div className="space-y-8">
      <ProductPageHero
        label="Job Detail"
        title={
          <>
            {job.title} <span className="hr-v2-gradient-text">Execution Flow</span>
          </>
        }
        description="Review the core terms, escrow state, and next actions without leaving the marketplace workflow."
      />

      <section className="rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
              Contract Snapshot
            </p>
            <h2 className="hr-text-primary font-sans text-2xl font-semibold">{job.title}</h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <JobSafetyBadge status={safetyStatus.status} />
            {shouldShowMarketplaceStatusBadge ? <StatusBadge label={marketplaceStatus} /> : null}
            <HighrableV2IconNotice
              label="Off-platform safety notice"
              tone="warning"
              message="Keep communication and payment on Highrable. Off-platform work is harder to prove and protect."
            />
            {safetyStatus.status === "unfunded" ? (
              <HighrableV2IconNotice
                label="Unfunded job warning"
                tone="warning"
                message={
                  isSelectedConnectedFreelancer
                    ? "You were selected, but escrow is not funded yet. Wait for funding before starting work."
                    : "This job is not funded yet. Confirm escrow status before starting work."
                }
              />
            ) : null}
            {safetyStatus.status === "escrow_created" ? (
              <HighrableV2IconNotice
                label="Escrow created warning"
                tone="warning"
                message="Escrow exists, but funding has not been verified yet."
              />
            ) : null}
            {safetyStatus.status === "verified_funded" ? (
              <HighrableV2IconNotice
                label="Verified funded escrow"
                tone="success"
                message="Escrow funding is verified for this job."
              />
            ) : null}
            {scamAnalysis.riskLevel !== "low" ? (
              <HighrableV2IconNotice
                label="Suspicious language detected"
                tone="warning"
                message={
                  <span className="space-y-1">
                    <span className="block">
                      This job may look suspicious because it asks users to move off-platform or pay
                      upfront.
                    </span>
                    {scamAnalysis.signals.map((signal) => (
                      <span key={signal.type} className="block">
                        {signal.message}
                      </span>
                    ))}
                  </span>
                }
              />
            ) : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="hr-text-secondary max-w-4xl font-sans text-sm leading-relaxed">
            {job.description}
          </p>

          {!isMilestoneProject ? (
            <div className="mt-5">
              <DeadlineBadge
                deadlineAt={job.deadlineAt}
                submittedAt={job.submittedAt}
                completedAt={job.completedAt}
                approvedAt={job.approvedAt}
                escrowStatus={mergedEscrow?.status}
                workStatus={job.status}
              />
            </div>
          ) : null}

          <dl className="mt-6 grid gap-5 border-t border-border/60 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
                Work mode
              </dt>
              <dd className="hr-text-primary font-sans font-semibold">
                {isMilestoneProject ? "Milestone Project" : "Micro Gig"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
                Budget
              </dt>
              <dd className="hr-text-primary font-sans font-semibold">
                {formatAmount(job.totalBudget ?? job.budget)} {formatAssetLabel(job.asset)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
                Asset
              </dt>
              <dd className="hr-text-primary flex items-center gap-2 font-sans font-semibold">
                {formatAssetLabel(job.asset)}
                {isNativeXlmJob && (
                  <HighrableV2IconNotice
                    label="XLM volatility warning"
                    tone="warning"
                    message="XLM escrow is volatile. Final fiat value may change."
                  />
                )}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
                Client wallet
              </dt>
              <dd className="hr-text-primary font-sans font-semibold">
                <Link
                  href={`/clients/${encodeURIComponent(job.clientWallet)}`}
                  className="hover:text-highrable-orange-3"
                >
                  {shortenWalletAddress(job.clientWallet)}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
                Freelancer
              </dt>
              <dd className="hr-text-primary font-sans font-semibold">
                {job.selectedFreelancerWallet ? (
                  <Link
                    href={`/freelancers/${encodeURIComponent(job.selectedFreelancerWallet)}`}
                    className="hover:text-highrable-orange-3"
                  >
                    {shortenWalletAddress(job.selectedFreelancerWallet)}
                  </Link>
                ) : (
                  shortenWalletAddress(job.selectedFreelancerWallet)
                )}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
                Job hash
              </dt>
              <dd className="hr-text-primary font-sans font-semibold break-all">{job.jobHash}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ReportJobButton jobId={convexJobId} />
            {mergedEscrow ? (
              <Button asChild variant="outline">
                <Link href={`/proof/${encodeURIComponent(mergedEscrow.escrowId)}`}>
                  View Escrow Proof
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
              Attachments
            </p>
            <h2 className="hr-text-primary mt-0.5 font-sans text-lg font-semibold">
              Reference files
            </h2>
            <p className="hr-text-secondary mt-1 font-sans text-sm">
              Reference files and links supplied by the client for this work.
            </p>
          </div>
          {attachments ? (
            <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground/60 uppercase">
              {attachments.length} item{attachments.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        {attachments === undefined ? (
          <p className="text-sm text-muted-foreground">Loading attachments...</p>
        ) : (
          <AttachmentList attachments={attachments} readOnly />
        )}
      </section>

      <ClientTrustCard clientWallet={job.clientWallet} />

      {canViewAgreementPanel ? (
        <WorkAgreementSetupPanel
          jobId={convexJobId}
          viewerRole={isConnectedClient ? "client" : "freelancer"}
          {...(mergedEscrow?._id ? { escrowId: mergedEscrow._id } : {})}
        />
      ) : null}

      {!isMilestoneProject ? (
        <>
          <FreelancerSafetyChecklist
            job={job}
            escrow={mergedEscrow}
            connectedWallet={walletIdentity.walletAddress}
          />

          <EscrowActionPanel job={job} escrow={escrow} applications={safeApplications} />
        </>
      ) : null}

      {!isMilestoneProject && canShowWorkChat ? (
        <ConversationThread
          parentType={chatParent.parentType}
          parentId={chatParent.parentId}
          title={chatParent.title}
        />
      ) : null}

      {isMilestoneProject ? (
        <section className="space-y-5">
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
                  Milestone Progress
                </p>
                <h2 className="hr-text-primary mt-0.5 font-sans text-lg font-semibold">
                  Funding status
                </h2>
                <p className="hr-text-secondary mt-1 text-sm">
                  Funding and Verified Funded status are tracked per milestone, not for the whole
                  project.
                </p>
              </div>
              <StatusBadge label={job.status} />
            </div>

            <div className="mt-5 grid gap-5 border-t border-border/60 pt-5 text-sm sm:grid-cols-5">
              <HighrableV2Metric
                label="Total"
                value={projectSummary?.milestones.length ?? job.milestoneCount ?? 0}
              />
              <HighrableV2Metric
                label="Paid"
                value={projectSummary?.milestoneCountsByStatus.released ?? 0}
              />
              <HighrableV2Metric
                label="Funded"
                value={projectSummary?.milestoneCountsByStatus.funded ?? 0}
              />
              <HighrableV2Metric
                label="Open"
                value={projectSummary?.milestoneCountsByStatus.open ?? 0}
              />
              <HighrableV2Metric
                label="Disputed"
                value={projectSummary?.milestoneCountsByStatus.disputed ?? 0}
              />
            </div>

            <p className="hr-text-primary mt-4 text-sm font-medium">
              {projectSummary?.milestoneCountsByStatus.released ?? 0} of{" "}
              {projectSummary?.milestones.length ?? job.milestoneCount ?? 0} milestones paid
            </p>
          </div>

          {projectSummary === undefined ? (
            <p className="text-sm text-muted-foreground">Loading milestones...</p>
          ) : null}
          {projectSummary?.milestones.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground sm:rounded-2xl">
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

      {!isMilestoneProject ? (
        <>
          <ApplyToJobForm
            job={job}
            hasApplied={hasAppliedToJob ?? false}
            isCheckingApplicationStatus={
              !!walletIdentity.walletAddress && hasAppliedToJob === undefined
            }
            onApplied={() => {}}
          />

          <ApplicationsList
            job={job}
            escrow={mergedEscrow}
            applications={applications}
            isLoading={applications === undefined}
            onSelected={() => {}}
          />
        </>
      ) : null}
    </div>
  );
}
