import { AppButton } from "@/core/ui/button";
import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import Link from "next/link";

import type { TConvexDoc } from "@repo/convex-client";

import { StatusBadge } from "./status-badge";

export function JobCard({
  job,
  connectedWallet,
  onApply,
  isApplying,
}: {
  job: TConvexDoc<"jobs">;
  connectedWallet: string | null;
  onApply: (jobId: string) => void;
  isApplying: boolean;
}) {
  const canApply =
    !!connectedWallet && !isSameWallet(connectedWallet, job.clientWallet) && job.status === "open";

  return (
    <article className="rounded-2xl border border-[#e8e8e8] bg-white p-6 transition-colors hover:border-[#FF7003]/40 hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#0a0a0a]">{job.title}</h3>
        <StatusBadge label={job.status} />
      </div>

      <p className="mb-4 line-clamp-3 text-sm text-[#5f5f5f]">{job.description}</p>

      <dl className="grid grid-cols-1 gap-3 text-sm text-[#5f5f5f] sm:grid-cols-2">
        <div>
          <dt className="text-[#7f7f7f]">Budget</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatAmount(job.budget)} {formatAssetLabel(job.asset)}
          </dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Asset</dt>
          <dd className="font-semibold text-[#0a0a0a]">{formatAssetLabel(job.asset)}</dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Client wallet</dt>
          <dd className="font-semibold text-[#0a0a0a]">{shortenWalletAddress(job.clientWallet)}</dd>
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
      </div>
    </article>
  );
}
