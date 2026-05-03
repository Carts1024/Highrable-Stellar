import type { TConvexDoc } from "@repo/convex-client";
import Link from "next/link";

import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";

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
    !!connectedWallet &&
    !isSameWallet(connectedWallet, job.clientWallet) &&
    job.status === "open";

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
        <StatusBadge label={job.status} />
      </div>

      <p className="mb-4 line-clamp-3 text-sm text-gray-600">{job.description}</p>

      <dl className="grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Budget</dt>
          <dd className="font-medium">{job.budget.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Asset</dt>
          <dd className="font-medium break-all">{job.asset}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Client wallet</dt>
          <dd className="font-medium">{shortenWalletAddress(job.clientWallet)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Selected freelancer</dt>
          <dd className="font-medium">{shortenWalletAddress(job.selectedFreelancerWallet)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/marketplace/jobs/${job._id}`}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          View Details
        </Link>

        {canApply ? (
          <button
            type="button"
            disabled={isApplying}
            onClick={() => onApply(job._id)}
            className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApplying ? "Applying..." : "Apply"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
