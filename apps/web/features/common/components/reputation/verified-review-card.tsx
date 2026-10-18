import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { cn } from "@repo/ui/lib/utils";
import { ExternalLink, Star } from "lucide-react";
import Link from "next/link";

import { VerifiedBadge } from "./verified-badge";

export interface IRatingStarsProps {
  readonly rating: number;
}

export interface IVerifiedReviewCardProps {
  readonly jobTitle?: string;
  readonly escrowId: string;
  readonly clientWallet: string;
  readonly freelancerWallet: string;
  readonly amount: number;
  readonly asset: string;
  readonly rating?: number;
  readonly reviewText?: string;
  readonly reviewHash?: string;
  readonly txHash?: string;
  readonly createdAt?: number;
  readonly compact?: boolean;
  readonly completionType?: "job" | "micro_gig" | "milestone";
}

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
    <span className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className="h-3.5 w-3.5"
          fill={index < rating ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <span className="hr-text-secondary ml-1.5 text-xs">{rating}/5</span>
    </span>
  );
}

function renderReviewBody({
  reviewText,
  compact,
}: Pick<IVerifiedReviewCardProps, "reviewText" | "compact">) {
  if (reviewText) {
    return (
      <div className="space-y-1.5">
        {!compact ? <p className="hr-text-secondary text-xs">Client review</p> : null}
        <p className="hr-text-primary text-sm leading-relaxed">“{reviewText}”</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="hr-text-secondary text-sm">
        Review text not provided. This completion is verified by a secure payment record.
      </p>
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
  txHash,
  compact = false,
  completionType = "job",
}: IVerifiedReviewCardProps) {
  const safeRating = normalizeRating(rating);
  const isMilestone = completionType === "milestone";
  const isMicroGig = completionType === "micro_gig";

  const title = isMilestone
    ? "Verified Milestone Completion"
    : isMicroGig
      ? "Verified Gig Completion"
      : "Verified Job Completion";

  return (
    <article className={cn("rounded-lg border bg-white", compact ? "p-4" : "p-5")}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h3 className="hr-text-primary text-sm font-semibold">{title}</h3>
        <VerifiedBadge
          label={
            isMilestone ? "Milestone Verified" : isMicroGig ? "Gig Verified" : "Review Verified"
          }
        />
      </div>

      <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {jobTitle ? (
          <div className="sm:col-span-2">
            <p className="hr-text-secondary text-xs">Project</p>
            <p className="hr-text-primary mt-0.5 font-medium">{jobTitle}</p>
          </div>
        ) : null}

        <div>
          <p className="hr-text-secondary text-xs">Rating</p>
          <div className="mt-1">
            {safeRating !== undefined ? (
              <RatingStars rating={safeRating} />
            ) : (
              <span className="hr-text-muted text-xs">Not rated</span>
            )}
          </div>
        </div>

        <div>
          <p className="hr-text-secondary text-xs">Payment</p>
          <p className="hr-text-primary mt-0.5 font-semibold">
            {formatAmount(amount)} {formatAsset(asset)}
          </p>
        </div>

        <div>
          <p className="hr-text-secondary text-xs">Client</p>
          <Link
            href={`/clients/${encodeURIComponent(clientWallet)}`}
            className="hr-text-primary mt-0.5 block font-mono text-xs hover:underline"
          >
            {shortenWalletAddress(clientWallet)}
          </Link>
        </div>

        <div>
          <p className="hr-text-secondary text-xs">Freelancer</p>
          <Link
            href={`/freelancers/${encodeURIComponent(freelancerWallet)}`}
            className="hr-text-primary mt-0.5 block font-mono text-xs hover:underline"
          >
            {shortenWalletAddress(freelancerWallet)}
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4">
        <Link
          href={`/proof/${encodeURIComponent(escrowId)}`}
          className="hr-mode-text inline-flex items-center gap-1 text-sm hover:underline"
        >
          Verification Proof
          <ExternalLink className="h-3 w-3" />
        </Link>

        {txHash ? (
          <a
            href={getTxExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="hr-mode-text inline-flex items-center gap-1 text-sm hover:underline"
          >
            On-Chain Transaction
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="hr-text-muted text-xs">Transaction pending</span>
        )}
      </div>

      {!compact ? (
        <div className="mt-4 border-t pt-4">{renderReviewBody({ reviewText, compact })}</div>
      ) : null}
    </article>
  );
}
