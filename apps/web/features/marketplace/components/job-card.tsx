import { formatAssetLabel } from "@/core/stellar/assets";
import { isNativeXlmEscrowAsset } from "@/core/stellar/payment-assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { getJobSafetyStatus } from "@/features/marketplace/lib/job-safety";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import Link from "next/link";

import type { TConvexDoc } from "@repo/convex-client";

import { JobSafetyBadge } from "./job-safety-badge";
import { StatusBadge } from "./status-badge";
import { TrustSafetyNotice } from "./trust-safety-notice";

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

  return (
    <article className="rounded-2xl border border-[#e8e8e8] bg-white p-6 transition-colors hover:border-[#FF7003]/40 hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#0a0a0a]">{job.title}</h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <JobSafetyBadge status={safetyStatus.status} />
          <StatusBadge label={escrow?.status ?? job.status} />
        </div>
      </div>

      <p className="mb-4 line-clamp-3 text-sm text-[#5f5f5f]">{job.description}</p>

      {safetyStatus.status === "unfunded" ? (
        <TrustSafetyNotice type="unfunded" compact className="mb-4" />
      ) : null}
      {safetyStatus.status === "verified_funded" ? (
        <TrustSafetyNotice type="verified_funded" compact className="mb-4" />
      ) : null}

      <dl className="grid grid-cols-1 gap-3 text-sm text-[#5f5f5f] sm:grid-cols-2">
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
          {isNativeXlmJob ? (
            <p className="mt-1 text-xs text-amber-800">
              XLM escrow is volatile. Final fiat value may change.
            </p>
          ) : null}
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Client wallet</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            <Link
              href={`/clients/${encodeURIComponent(job.clientWallet)}`}
              className="hover:text-[#FF7003]"
            >
              {shortenWalletAddress(job.clientWallet)}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Selected freelancer</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {shortenWalletAddress(job.selectedFreelancerWallet)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/marketplace/jobs/${job._id}`}
          className="rounded-lg border border-[#e8e8e8] px-4 py-2 text-sm font-semibold text-[#5f5f5f] transition-colors hover:bg-[#f5f5f5]"
        >
          View Details
        </Link>

        {canApply ? (
          <AppButton
            type="button"
            disabled={isApplying}
            onClick={() => onApply(job._id)}
            className="px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? "Applying..." : "Apply"}
          </AppButton>
        ) : null}
        {isMilestoneProject ? (
          <p className="text-sm text-[#5f5f5f]">Apply to specific milestones on the detail page.</p>
        ) : null}
      </div>
    </article>
  );
}
