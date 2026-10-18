import { formatAssetLabel } from "@/core/stellar/assets";
import { isNativeXlmEscrowAsset } from "@/core/stellar/payment-assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { getJobSafetyLabel, getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { useAppMode } from "@/features/mode";
import { HighrableV2IconNotice } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";
import React from "react";

import type { TConvexDoc } from "@repo/convex-client";

import { JobSafetyBadge } from "./job-safety-badge";
import { StatusBadge } from "./status-badge";

export function JobCard({
  job,
  escrow,
  connectedWallet,
  onApply,
  isApplying,
  hasApplied,
  isCheckingApplicationStatus,
}: {
  job: TConvexDoc<"jobs">;
  escrow?: TConvexDoc<"escrows"> | null;
  connectedWallet: string | null;
  onApply: (jobId: string) => void;
  isApplying: boolean;
  hasApplied: boolean;
  isCheckingApplicationStatus: boolean;
}) {
  const jobType = job.jobType ?? "micro_gig";
  const isMilestoneProject = jobType === "milestone_project";
  const isNativeXlmJob = isNativeXlmEscrowAsset(job.asset);
  const { mode } = useAppMode();
  const canApply =
    mode === "freelancer" &&
    !isMilestoneProject &&
    !!connectedWallet &&
    !hasApplied &&
    !isCheckingApplicationStatus &&
    !isSameWallet(connectedWallet, job.clientWallet) &&
    (job.status === "open" || (job.status === "funded" && !job.selectedFreelancerWallet));
  const safetyStatus = getJobSafetyStatus({ job, escrow });
  const marketplaceStatus = escrow?.status ?? job.status;
  const shouldShowMarketplaceStatusBadge =
    getJobSafetyLabel(safetyStatus.status) !== getMarketplaceStatusMeta(marketplaceStatus).label;

  return (
    <li className="group relative flex flex-col gap-3 rounded-lg border bg-card px-4 py-4 transition-colors hover:border-(--mode-border) hover:bg-muted/30 sm:flex-row sm:items-start sm:gap-6 sm:px-5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Link
          href={`/marketplace/jobs/${job._id}`}
          className="hr-text-primary block text-lg leading-snug font-medium transition-colors group-hover:font-bold group-hover:text-(--mode-text) after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring sm:text-xl"
        >
          {job.title}
        </Link>
        <p className="hr-text-secondary line-clamp-2 text-sm leading-relaxed">{job.description}</p>

        <div className="relative z-10 flex w-fit flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <JobSafetyBadge status={safetyStatus.status} />
          {shouldShowMarketplaceStatusBadge && <StatusBadge label={marketplaceStatus} />}
          {isMilestoneProject ? (
            <span className="hr-text-secondary text-xs">Milestone project</span>
          ) : (
            <DeadlineBadge
              deadlineAt={job.deadlineAt}
              submittedAt={job.submittedAt}
              completedAt={job.completedAt}
              approvedAt={job.approvedAt}
              escrowStatus={escrow?.status}
              workStatus={job.status}
              compact
            />
          )}
        </div>

        <div className="hr-text-secondary flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            <span className="hr-text-muted">Client </span>
            <Link
              href={`/clients/${encodeURIComponent(job.clientWallet)}`}
              className="hr-text-primary relative z-10 font-mono hover:text-(--mode-text)"
            >
              {shortenWalletAddress(job.clientWallet)}
            </Link>
          </span>
          {job.selectedFreelancerWallet ? (
            <span>
              <span className="hr-text-muted">Freelancer </span>
              <span className="hr-text-primary font-mono">
                {shortenWalletAddress(job.selectedFreelancerWallet)}
              </span>
            </span>
          ) : null}
          {isMilestoneProject ? <span>Apply to individual milestones on the job page</span> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-3">
        <div className="sm:text-right">
          <p className="hr-text-primary hr-num flex items-center gap-1 text-base font-semibold sm:justify-end">
            {formatAmount(job.totalBudget ?? job.budget)} {formatAssetLabel(job.asset)}
            {isNativeXlmJob ? (
              <span className="relative z-10 inline-flex">
                <HighrableV2IconNotice
                  label="XLM volatility warning"
                  tone="warning"
                  message="XLM payment hold is volatile. Final fiat value may change."
                />
              </span>
            ) : null}
          </p>
          <p className="hr-text-muted text-xs">{isMilestoneProject ? "Total budget" : "Budget"}</p>
        </div>

        {canApply ? (
          <AppButton
            type="button"
            disabled={isApplying}
            onClick={() => onApply(job._id)}
            className="hr-v2-button-primary relative z-10 h-8 rounded-md px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? "Applying…" : "Apply"}
          </AppButton>
        ) : null}
      </div>
    </li>
  );
}
