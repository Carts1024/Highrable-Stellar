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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { Coins, Send, ShieldCheck, User } from "lucide-react";
import Link from "next/link";

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
  const isUnfunded = safetyStatus.status === "unfunded";
  const isVerifiedFunded = safetyStatus.status === "verified_funded";
  const shouldShowMarketplaceStatusBadge =
    getJobSafetyLabel(safetyStatus.status) !== getMarketplaceStatusMeta(marketplaceStatus).label;

  return (
    <article className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      {/* Left: badges, title, summary, meta */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {isUnfunded ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default">
                    <JobSafetyBadge status={safetyStatus.status} />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  tone="neutral"
                  className="max-w-xs text-sm leading-relaxed"
                >
                  This job has not been funded yet. Confirm payment hold before starting work.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <JobSafetyBadge status={safetyStatus.status} />
          )}

          {shouldShowMarketplaceStatusBadge && <StatusBadge label={marketplaceStatus} />}

          {isMilestoneProject && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Milestone Project
            </span>
          )}

          {isVerifiedFunded && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Payment Secured
            </span>
          )}

          {!isMilestoneProject && (
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

        <div className="min-w-0 space-y-1.5">
          <h3 className="hr-text-primary truncate text-base leading-snug font-bold transition-colors group-hover:text-highrable-orange-3 sm:text-lg">
            {job.title}
          </h3>
          <p className="hr-text-secondary line-clamp-2 text-sm leading-relaxed sm:line-clamp-1">
            {job.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground/60 uppercase">
              Client
            </span>
            <Link
              href={`/clients/${encodeURIComponent(job.clientWallet)}`}
              className="font-semibold text-foreground transition-colors hover:text-highrable-orange-3 hover:underline"
            >
              {shortenWalletAddress(job.clientWallet)}
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground/60 uppercase">
              Asset
            </span>
            <span className="max-w-30 truncate font-semibold text-foreground sm:max-w-none">
              {formatAssetLabel(job.asset)}
            </span>
            {isNativeXlmJob ? (
              <HighrableV2IconNotice
                label="XLM volatility warning"
                tone="warning"
                message="XLM payment hold is volatile. Final fiat value may change."
              />
            ) : null}
          </div>

          {job.selectedFreelancerWallet ? (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="font-mono text-[11px] tracking-wide text-muted-foreground/60 uppercase">
                Freelancer
              </span>
              <span className="font-semibold text-foreground">
                {shortenWalletAddress(job.selectedFreelancerWallet)}
              </span>
            </div>
          ) : null}

          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {isMilestoneProject ? "Milestone payment-ready" : "Escrow-ready"}
          </span>
        </div>

        {isMilestoneProject ? (
          <p className="hr-text-secondary font-sans text-xs leading-relaxed">
            Apply to specific milestones on the detail page.
          </p>
        ) : null}
      </div>

      {/* Right: budget + actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 sm:w-48 sm:flex-col sm:items-stretch sm:justify-center sm:gap-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
        <div className="sm:text-right">
          <p className="font-sans text-xl leading-none font-bold tracking-tight text-highrable-orange-3 sm:text-2xl">
            {formatAmount(job.totalBudget ?? job.budget)}
          </p>
          <p className="mt-1 font-mono text-[11px] tracking-[0.08em] text-muted-foreground/60 uppercase">
            {isMilestoneProject ? "Total Budget" : "Budget"}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
          <AppButton
            asChild
            variant="outline"
            className="h-9 rounded-lg px-4 text-xs font-semibold hover:bg-muted/60"
          >
            <Link href={`/marketplace/jobs/${job._id}`}>Details</Link>
          </AppButton>

          {canApply && (
            <AppButton
              type="button"
              disabled={isApplying}
              onClick={() => onApply(job._id)}
              className="hr-v2-button-primary h-9 gap-2 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {isApplying ? "Applying…" : "Apply Now"}
            </AppButton>
          )}
        </div>
      </div>
    </article>
  );
}
