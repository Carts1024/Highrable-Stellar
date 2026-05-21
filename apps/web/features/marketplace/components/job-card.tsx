import { formatAssetLabel } from "@/core/stellar/assets";
import { isNativeXlmEscrowAsset } from "@/core/stellar/payment-assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { DeadlineBadge } from "@/features/deadlines";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { getJobSafetyLabel, getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import {
  HighrableV2Bullet,
  HighrableV2IconNotice,
} from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
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
}: {
  job: TConvexDoc<"jobs">;
  escrow?: TConvexDoc<"escrows"> | null;
  connectedWallet: string | null;
  onApply: (jobId: string) => void;
  isApplying: boolean;
}) {
  const jobType = job.jobType ?? "micro_gig";
  const isMilestoneProject = jobType === "milestone_project";
  const isNativeXlmJob = isNativeXlmEscrowAsset(job.asset);
  const canApply =
    !isMilestoneProject &&
    !!connectedWallet &&
    !isSameWallet(connectedWallet, job.clientWallet) &&
    (job.status === "open" || (job.status === "funded" && !job.selectedFreelancerWallet));
  const safetyStatus = getJobSafetyStatus({ job, escrow });
  const marketplaceStatus = escrow?.status ?? job.status;
  const shouldShowMarketplaceStatusBadge =
    getJobSafetyLabel(safetyStatus.status) !== getMarketplaceStatusMeta(marketplaceStatus).label;

  return (
    <article className="group border-b border-[#e8e8e8] bg-white px-1 py-5 transition-colors last:border-b-0 hover:bg-[#fff7ed]/40 sm:px-4">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <JobSafetyBadge status={safetyStatus.status} />
            {shouldShowMarketplaceStatusBadge ? <StatusBadge label={marketplaceStatus} /> : null}
            {safetyStatus.status === "unfunded" ? (
              <HighrableV2IconNotice
                label="Unfunded job warning"
                tone="warning"
                message="This job has not been funded yet. Confirm escrow before starting work."
              />
            ) : null}
            {safetyStatus.status === "verified_funded" ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Escrow verified
              </span>
            ) : null}
            {!isMilestoneProject ? (
              <DeadlineBadge
                deadlineAt={job.deadlineAt}
                submittedAt={job.submittedAt}
                completedAt={job.completedAt}
                approvedAt={job.approvedAt}
                escrowStatus={escrow?.status}
                workStatus={job.status}
              />
            ) : null}
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-950">{job.title}</h3>
            <p className="mt-2 line-clamp-3 max-w-3xl text-sm leading-6 text-gray-600">
              {job.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-gray-600">
            <span className="inline-flex items-center gap-2">
              <HighrableV2Bullet tone="muted" />
              {isMilestoneProject ? "Milestone Project" : "Micro Gig"}
            </span>
            <span className="inline-flex items-center gap-2">
              <HighrableV2Bullet tone="muted" />
              Client{" "}
              <Link
                href={`/clients/${encodeURIComponent(job.clientWallet)}`}
                className="hover:text-[#FF7003]"
              >
                {shortenWalletAddress(job.clientWallet)}
              </Link>
            </span>
            <span className="inline-flex items-center gap-2">
              <HighrableV2Bullet tone="muted" />
              Asset {formatAssetLabel(job.asset)}
              {isNativeXlmJob ? (
                <HighrableV2IconNotice
                  label="XLM volatility warning"
                  tone="warning"
                  message="XLM escrow is volatile. Final fiat value may change."
                />
              ) : null}
            </span>
            <span className="inline-flex items-center gap-2">
              <HighrableV2Bullet tone="muted" />
              Freelancer {shortenWalletAddress(job.selectedFreelancerWallet)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <div className="lg:text-right">
            <div className="text-2xl font-bold text-[#B94A00]">
              {formatAmount(job.totalBudget ?? job.budget)}
            </div>
            <div className="text-xs font-medium text-gray-500">
              {formatAssetLabel(job.asset)} {isMilestoneProject ? "total budget" : "budget"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Link
              href={`/marketplace/jobs/${job._id}`}
              className="inline-flex items-center gap-1 border border-[#e8e8e8] px-4 py-2 text-sm font-semibold text-[#5f5f5f] transition-colors hover:bg-white"
            >
              Details
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            {canApply ? (
              <AppButton
                type="button"
                disabled={isApplying}
                onClick={() => onApply(job._id)}
                className="hr-v2-button-primary rounded-none px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplying ? "Applying..." : "Apply"}
              </AppButton>
            ) : null}
          </div>
          {isMilestoneProject ? (
            <p className="max-w-[14rem] text-xs leading-relaxed text-[#5f5f5f] lg:text-right">
              Apply to specific milestones on the detail page.
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
