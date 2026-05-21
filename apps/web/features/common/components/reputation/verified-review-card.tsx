import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { V2_PANEL_CLASS } from "@repo/ui/components/highrable/v2-theme";
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
      <span className="ml-1.5 font-mono text-[11px] font-medium text-gray-500">{rating}/5</span>
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
        {!compact ? (
          <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Client review
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-gray-700 italic">"{reviewText}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="hr-text-secondary text-sm">
        Review text not provided. This completion is verified by a secure escrow payment record.
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

  const subtitle = isMilestone
    ? "This milestone is backed by a verified on-chain payment."
    : compact
      ? "Secure Payment Verified"
      : "This work is backed by a verified on-chain payment record.";

  return (
    <article className={cn(compact ? "p-4" : "p-6", V2_PANEL_CLASS, "bg-white")}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <VerifiedBadge
            label={
              isMilestone ? "Milestone Verified" : isMicroGig ? "Gig Verified" : "Review Verified"
            }
          />
          <h3 className="hr-text-primary text-lg font-bold tracking-tight">{title}</h3>
          <p className="hr-text-secondary text-xs font-medium">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {jobTitle ? (
          <div className="sm:col-span-2">
            <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Project
            </p>
            <p className="hr-text-primary mt-0.5 font-medium">{jobTitle}</p>
          </div>
        ) : null}

        <div>
          <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Rating
          </p>
          <div className="mt-1">
            {safeRating !== undefined ? (
              <RatingStars rating={safeRating} />
            ) : (
              <span className="text-xs text-gray-400 italic">Not rated</span>
            )}
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Payment
          </p>
          <p className="hr-text-primary mt-0.5 font-semibold">
            {formatAmount(amount)} {formatAsset(asset)}
          </p>
        </div>

        <div>
          <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Client
          </p>
          <Link
            href={`/clients/${encodeURIComponent(clientWallet)}`}
            className="hr-text-accent mt-0.5 block font-medium hover:underline"
          >
            {shortenWalletAddress(clientWallet)}
          </Link>
        </div>

        <div>
          <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Freelancer
          </p>
          <Link
            href={`/freelancers/${encodeURIComponent(freelancerWallet)}`}
            className="hr-text-accent mt-0.5 block font-medium hover:underline"
          >
            {shortenWalletAddress(freelancerWallet)}
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-5">
        <Link
          href={`/proof/${encodeURIComponent(escrowId)}`}
          className="hr-text-accent inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase transition-colors hover:opacity-80"
        >
          Verification Proof
          <ExternalLink className="h-3 w-3" />
        </Link>

        {txHash ? (
          <a
            href={getTxExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="hr-text-accent inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase transition-colors hover:opacity-80"
          >
            On-Chain Transaction
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-[10px] font-bold tracking-wider text-gray-300 uppercase">
            Transaction pending
          </span>
        )}
      </div>

      {!compact ? (
        <div className="mt-5 border-t border-gray-100 pt-5">
          {renderReviewBody({ reviewText, compact })}
        </div>
      ) : null}
    </article>
  );
}
