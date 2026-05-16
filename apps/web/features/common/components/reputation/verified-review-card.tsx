import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { ExternalLink, Star } from "lucide-react";
import Link from "next/link";

import { VerifiedBadge } from "./verified-badge";

type IRatingStarsProps = {
  rating: number;
};

export type TVerifiedReviewCardProps = {
  jobTitle?: string;
  escrowId: string;
  clientWallet: string;
  freelancerWallet: string;
  amount: number;
  asset: string;
  rating?: number;
  reviewText?: string;
  reviewHash?: string;
  txHash?: string;
  createdAt?: number;
  compact?: boolean;
  completionType?: "job" | "micro_gig" | "milestone";
};

function normalizeRating(rating: number | undefined): number | undefined {
  if (rating === undefined || !Number.isFinite(rating)) {
    return undefined;
  }

  const rounded = Math.round(rating);
  if (rounded < 1 || rounded > 5) {
    return undefined;
  }

  return rounded;
}

function RatingStars({ rating }: IRatingStarsProps) {
  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className="h-3.5 w-3.5"
          fill={index < rating ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">{rating}/5</span>
    </span>
  );
}

function renderReviewBody({
  reviewText,
  reviewHash,
  compact,
}: Pick<TVerifiedReviewCardProps, "reviewText" | "reviewHash" | "compact">) {
  if (reviewText) {
    return (
      <div className="space-y-1">
        {!compact ? <p className="text-xs font-medium text-gray-500">Client review</p> : null}
        <p className="text-sm text-gray-700 italic">"{reviewText}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-600">
        No written review was added, but this completion is verified by a released escrow payment.
      </p>
      {!reviewText && reviewHash ? (
        <p className="text-xs break-all text-gray-400">Review hash: {reviewHash}</p>
      ) : null}
    </div>
  );
}

export function VerifiedReviewCard({
  jobTitle,
  escrowId,
  clientWallet,
  freelancerWallet,
  amount,
  asset,
  rating,
  reviewText,
  reviewHash,
  txHash,
  compact = false,
  completionType = "job",
}: TVerifiedReviewCardProps) {
  const safeRating = normalizeRating(rating);
  const isMilestone = completionType === "milestone";
  const isMicroGig = completionType === "micro_gig";
  const title = isMilestone
    ? "Verified completed milestone"
    : isMicroGig
      ? "Verified completed gig"
      : "Verified completed job";
  const subtitle = isMilestone
    ? "This milestone review is linked to a paid Stellar escrow."
    : compact
      ? "Paid through Stellar escrow"
      : "This review is linked to a paid Stellar escrow.";

  return (
    <article
      className={`rounded-xl border border-emerald-100 bg-emerald-50/40 ${compact ? "p-4" : "p-5"}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <VerifiedBadge
            label={
              isMilestone
                ? "Verified Completed Milestone"
                : isMicroGig
                  ? "Verified Completed Gig"
                  : compact
                    ? "Verified Completed Job"
                    : "Verified Review"
            }
          />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-emerald-800">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
        {jobTitle ? (
          <p className="sm:col-span-2">
            <span className="font-medium text-gray-500">Job:</span> {jobTitle}
          </p>
        ) : null}
        <p>
          <span className="font-medium text-gray-500">Rating:</span>{" "}
          {safeRating !== undefined ? <RatingStars rating={safeRating} /> : "Rating not provided"}
        </p>
        <p>
          <span className="font-medium text-gray-500">Payment:</span> {formatAmount(amount)}{" "}
          {formatAsset(asset)}
        </p>
        <p>
          <span className="font-medium text-gray-500">Client:</span>{" "}
          <Link
            href={`/clients/${encodeURIComponent(clientWallet)}`}
            className="font-medium text-[#FF7003] hover:text-[#E85D00]"
          >
            {shortenWalletAddress(clientWallet)}
          </Link>
        </p>
        <p>
          <span className="font-medium text-gray-500">Freelancer:</span>{" "}
          <Link
            href={`/freelancers/${encodeURIComponent(freelancerWallet)}`}
            className="font-medium text-[#FF7003] hover:text-[#E85D00]"
          >
            {shortenWalletAddress(freelancerWallet)}
          </Link>
        </p>
        <p className="break-all sm:col-span-2">
          <span className="font-medium text-gray-500">Escrow ID:</span> {escrowId}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-emerald-800">Paid through Stellar escrow</p>
        <Link
          href={`/proof/${encodeURIComponent(escrowId)}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
        >
          View proof
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        {txHash ? (
          <a
            href={getTxExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
          >
            View on Stellar Explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-xs text-gray-500">Transaction hash not stored</p>
        )}
      </div>

      {!compact ? (
        <div className="mt-4 border-t border-emerald-100 pt-3">
          {renderReviewBody({ reviewText, reviewHash, compact })}
        </div>
      ) : null}
    </article>
  );
}
