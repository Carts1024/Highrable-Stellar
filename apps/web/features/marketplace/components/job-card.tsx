import { formatAssetLabel } from "@/core/stellar/assets";
import { isNativeXlmEscrowAsset } from "@/core/stellar/payment-assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { getJobSafetyLabel, getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
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
  const canApply =
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
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm">
      {/* Card header */}
      <div className="flex flex-col gap-3 p-6 pb-4">
        {/* Badge row */}
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
                  This job has not been funded yet. Confirm escrow before starting work.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <JobSafetyBadge status={safetyStatus.status} />
          )}

          {shouldShowMarketplaceStatusBadge && <StatusBadge label={marketplaceStatus} />}

          {isMilestoneProject && (
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
              Milestone Project
            </span>
          )}

          {isVerifiedFunded && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Escrow Verified
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

        {/* Title + budget */}
        <div className="mt-3 flex items-start justify-between gap-4">
          <h3 className="hr-text-primary text-xl leading-snug font-bold transition-colors group-hover:text-highrable-orange-3">
            {job.title}
          </h3>
          <div className="shrink-0 text-right">
            <p className="font-sans text-2xl leading-none font-bold tracking-tight text-highrable-orange-3">
              {formatAmount(job.totalBudget ?? job.budget)}
            </p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.08em] text-muted-foreground/60 uppercase">
              {isMilestoneProject ? "Total Budget" : "Budget"}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 pb-5">
        <p className="hr-text-secondary max-w-3xl text-sm leading-relaxed whitespace-pre-line">
          {job.description}
        </p>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/80 bg-muted/50 px-6 py-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
            Type
          </span>
          <span className="font-semibold text-foreground">
            {isMilestoneProject ? "Milestone Project" : "Micro Gig"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
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
          <Coins className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
            Asset
          </span>
          <span className="max-w-30 truncate font-semibold text-foreground sm:max-w-none">
            {formatAssetLabel(job.asset)}
          </span>
          {isNativeXlmJob ? (
            <HighrableV2IconNotice
              label="XLM volatility warning"
              tone="warning"
              message="XLM escrow is volatile. Final fiat value may change."
            />
          ) : null}
        </div>

        {job.selectedFreelancerWallet ? (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
              Freelancer
            </span>
            <span className="font-semibold text-foreground">
              {shortenWalletAddress(job.selectedFreelancerWallet)}
            </span>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          {isMilestoneProject ? "Milestone escrow-ready" : "Escrow-ready"}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border/40 px-6 py-4">
        {isMilestoneProject ? (
          <p className="hr-text-secondary mr-auto max-w-sm font-sans text-xs leading-relaxed">
            Apply to specific milestones on the detail page.
          </p>
        ) : null}

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
            className="hr-v2-button-primary h-9 gap-2 rounded-lg px-5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {isApplying ? "Applying…" : "Apply Now"}
          </AppButton>
        )}
      </div>
    </article>
  );
}
