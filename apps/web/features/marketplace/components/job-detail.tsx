"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { isNativeXlmEscrowAsset } from "@/core/stellar/payment-assets";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { AttachmentList } from "@/features/attachments/components";
import { ConversationThread } from "@/features/chat";
import { RouteCallout } from "@/features/common";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { getJobSafetyLabel, getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { analyzeJobScamSignals } from "@/features/marketplace/lib/scam-signals";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { ModeOnly } from "@/features/mode";
import { WorkAgreementSetupPanel } from "@/features/work-agreements";
import { api } from "@repo/convex-client";
import { HighrableV2IconNotice } from "@repo/ui/components/highrable/v2-marketing";
import { useQuery } from "convex/react";
import Link from "next/link";
import React from "react";

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
  const jobType = job.jobType ?? "micro_gig";
  const isMilestoneProject = jobType === "milestone_project";
  const projectSummary = milestoneSummary;
  const isConnectedClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);
  const isAssignedMilestoneConnectedFreelancer =
    isMilestoneProject &&
    Boolean(
      projectSummary?.milestones.some((milestone) =>
        isSameWallet(walletIdentity.walletAddress, milestone.assignedFreelancerWallet),
      ),
    );
  const isSelectedConnectedFreelancer = isSameWallet(
    walletIdentity.walletAddress,
    job.selectedFreelancerWallet,
  );
  const hasChosenFreelancer =
    Boolean(job.selectedFreelancerWallet) ||
    Boolean(projectSummary?.milestones.some((milestone) => milestone.assignedFreelancerWallet));
  const canViewAgreementPanel =
    hasChosenFreelancer &&
    (isConnectedClient || isSelectedConnectedFreelancer || isAssignedMilestoneConnectedFreelancer);
  const scamAnalysis = analyzeJobScamSignals({
    title: job.title,
    description: job.description,
  });
  const isNativeXlmJob = isNativeXlmEscrowAsset(job.asset);
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

  const isUnfundedForSelectedFreelancer =
    safetyStatus.status === "unfunded" && isSelectedConnectedFreelancer;

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b pb-5">
        <Link
          href="/marketplace"
          className="hr-text-muted inline-flex text-sm hover:text-foreground hover:underline"
        >
          ← All jobs
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-2">
            <h1 className="hr-text-primary font-sans text-2xl leading-tight font-semibold tracking-tight">
              {job.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <JobSafetyBadge status={safetyStatus.status} />
              {shouldShowMarketplaceStatusBadge ? <StatusBadge label={marketplaceStatus} /> : null}
              <span className="hr-text-secondary text-xs">
                {isMilestoneProject ? "Milestone project" : "Quick job"}
              </span>
              <HighrableV2IconNotice
                label="Off-platform safety notice"
                tone="warning"
                message="Keep communication and payment on Highrable. Off-platform work is harder to prove and protect."
              />
            </div>
          </div>
          {!isMilestoneProject ? (
            <ModeOnly mode="freelancer">
              <div className="shrink-0">
                <ApplyToJobForm
                  job={job}
                  hasApplied={hasAppliedToJob ?? false}
                  isCheckingApplicationStatus={
                    !!walletIdentity.walletAddress && hasAppliedToJob === undefined
                  }
                  onApplied={() => {}}
                />
              </div>
            </ModeOnly>
          ) : null}
        </div>
      </header>

      {isUnfundedForSelectedFreelancer ? (
        <RouteCallout tone="warning">
          You were selected, but the payment is not on hold yet. Wait for the client to fund it
          before starting work.
        </RouteCallout>
      ) : null}

      {scamAnalysis.riskLevel !== "low" ? (
        <RouteCallout tone="warning">
          <p className="font-medium">This job asks for things that are common in scams.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {scamAnalysis.signals.map((signal) => (
              <li key={signal.type}>{signal.message}</li>
            ))}
          </ul>
        </RouteCallout>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="job-description-title" className="space-y-2">
            <h2 id="job-description-title" className="hr-text-primary text-base font-semibold">
              Description
            </h2>
            <p className="hr-text-secondary max-w-3xl font-sans text-sm leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </section>

          {attachments === undefined || attachments.length > 0 ? (
            <section aria-labelledby="job-files-title" className="space-y-2">
              <h2 id="job-files-title" className="hr-text-primary text-base font-semibold">
                Reference files
                {attachments ? (
                  <span className="hr-text-muted ml-2 text-sm font-normal">
                    {attachments.length}
                  </span>
                ) : null}
              </h2>
              {attachments === undefined ? (
                <p className="text-sm text-muted-foreground">Loading files…</p>
              ) : (
                <AttachmentList attachments={attachments} readOnly />
              )}
            </section>
          ) : null}

          {!isMilestoneProject ? (
            <section aria-labelledby="job-payment-title" className="space-y-3">
              <h2 id="job-payment-title" className="hr-text-primary text-base font-semibold">
                Payment
              </h2>
              <EscrowActionPanel job={job} escrow={escrow} applications={safeApplications} />
            </section>
          ) : null}

          {isMilestoneProject ? (
            <section aria-labelledby="job-milestones-title" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="job-milestones-title" className="hr-text-primary text-base font-semibold">
                  Milestones
                </h2>
                <p className="hr-text-secondary text-sm">
                  {projectSummary?.milestoneCountsByStatus.released ?? 0} of{" "}
                  {projectSummary?.milestones.length ?? job.milestoneCount ?? 0} paid
                </p>
              </div>
              <p className="hr-text-secondary text-sm">
                Each milestone is funded and paid on its own.
              </p>
              <dl className="hr-text-secondary flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {(
                  [
                    ["Open", projectSummary?.milestoneCountsByStatus.open ?? 0],
                    ["Funded", projectSummary?.milestoneCountsByStatus.funded ?? 0],
                    ["Paid", projectSummary?.milestoneCountsByStatus.released ?? 0],
                    ["Disputed", projectSummary?.milestoneCountsByStatus.disputed ?? 0],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex gap-1.5">
                    <dt>{label}</dt>
                    <dd className="hr-text-primary hr-num font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {projectSummary === undefined ? (
                <p className="text-sm text-muted-foreground">Loading milestones…</p>
              ) : null}
              {projectSummary?.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">This project has no milestones.</p>
              ) : null}
              <div className="space-y-4">
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
              </div>
            </section>
          ) : null}

          {!isMilestoneProject ? (
            <ModeOnly mode="client">
              <ApplicationsList
                job={job}
                escrow={mergedEscrow}
                applications={applications}
                isLoading={applications === undefined}
                onSelected={() => {}}
              />
            </ModeOnly>
          ) : null}

          {canViewAgreementPanel ? (
            <WorkAgreementSetupPanel
              jobId={convexJobId}
              viewerRole={isConnectedClient ? "client" : "freelancer"}
              {...(mergedEscrow?._id ? { escrowId: mergedEscrow._id } : {})}
            />
          ) : null}

          {!isMilestoneProject && canShowWorkChat ? (
            <ConversationThread
              parentType={chatParent.parentType}
              parentId={chatParent.parentId}
              title={chatParent.title}
            />
          ) : null}
        </div>

        <aside className="space-y-6 lg:border-l lg:pl-6">
          <section aria-labelledby="job-terms-title" className="space-y-3">
            <h2 id="job-terms-title" className="sr-only">
              Terms
            </h2>
            <div>
              <p className="hr-text-secondary text-xs">
                {isMilestoneProject ? "Total budget" : "Budget"}
              </p>
              <p className="hr-text-primary hr-num mt-0.5 flex items-center gap-1.5 text-xl font-semibold">
                {formatAmount(job.totalBudget ?? job.budget)} {formatAssetLabel(job.asset)}
                {isNativeXlmJob ? (
                  <HighrableV2IconNotice
                    label="XLM volatility warning"
                    tone="warning"
                    message="XLM payment hold is volatile. Final fiat value may change."
                  />
                ) : null}
              </p>
            </div>

            {!isMilestoneProject ? (
              <DeadlineBadge
                deadlineAt={job.deadlineAt}
                submittedAt={job.submittedAt}
                completedAt={job.completedAt}
                approvedAt={job.approvedAt}
                escrowStatus={mergedEscrow?.status}
                workStatus={job.status}
              />
            ) : null}

            <dl className="divide-y border-y text-sm">
              <div className="flex justify-between gap-4 py-2">
                <dt className="hr-text-secondary">Client</dt>
                <dd>
                  <Link
                    href={`/clients/${encodeURIComponent(job.clientWallet)}`}
                    className="hr-text-primary font-mono text-xs hover:underline"
                  >
                    {shortenWalletAddress(job.clientWallet)}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="hr-text-secondary">Freelancer</dt>
                <dd className="hr-text-primary font-mono text-xs">
                  {job.selectedFreelancerWallet ? (
                    <Link
                      href={`/freelancers/${encodeURIComponent(job.selectedFreelancerWallet)}`}
                      className="hover:underline"
                    >
                      {shortenWalletAddress(job.selectedFreelancerWallet)}
                    </Link>
                  ) : (
                    <span className="hr-text-muted font-sans">Not chosen yet</span>
                  )}
                </dd>
              </div>
              <div className="space-y-0.5 py-2">
                <dt className="hr-text-secondary">Job receipt ID</dt>
                <dd className="hr-text-primary font-mono text-xs break-all">{job.jobHash}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {mergedEscrow ? (
                <Link
                  href={`/proof/${encodeURIComponent(mergedEscrow.escrowId)}`}
                  className="hr-mode-text hover:underline"
                >
                  Payment proof
                </Link>
              ) : null}
              <ReportJobButton jobId={convexJobId} />
            </div>
          </section>

          <section aria-labelledby="job-client-title" className="space-y-3 border-t pt-5">
            <h2 id="job-client-title" className="hr-text-primary text-sm font-semibold">
              About the client
            </h2>
            <ClientTrustCard clientWallet={job.clientWallet} compact />
          </section>

          {!isMilestoneProject ? (
            <section className="border-t pt-5">
              <FreelancerSafetyChecklist
                job={job}
                escrow={mergedEscrow}
                connectedWallet={walletIdentity.walletAddress}
              />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
