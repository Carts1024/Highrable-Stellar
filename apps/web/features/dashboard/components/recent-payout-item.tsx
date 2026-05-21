"use client";

import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { Star } from "lucide-react";
import Link from "next/link";

import type { TRecentPayout } from "@/features/dashboard/types";

type IRecentPayoutItemProps = {
  payout: TRecentPayout;
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="h-3.5 w-3.5"
          fill={i < rating ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <span className="hr-text-muted ml-1 text-xs">{rating}/5</span>
    </span>
  );
}

export function RecentPayoutItem({ payout }: IRecentPayoutItemProps) {
  const {
    escrowId,
    jobTitle,
    milestoneTitle,
    amount,
    asset,
    clientWallet,
    freelancerWallet,
    releaseTxHash,
    rating,
    reviewText,
    releasedAt,
  } = payout;

  return (
    <div className="hr-panel space-y-2 p-4 shadow-none">
      <p className="hr-text-primary truncate text-sm font-semibold">{jobTitle ?? "Untitled Job"}</p>
      {milestoneTitle ? (
        <p className="hr-text-secondary text-xs font-medium">Milestone: {milestoneTitle}</p>
      ) : null}
      <VerifiedReviewCard
        compact
        jobTitle={milestoneTitle ? `${jobTitle ?? "Untitled Job"} - ${milestoneTitle}` : jobTitle}
        escrowId={escrowId}
        clientWallet={clientWallet}
        freelancerWallet={freelancerWallet}
        amount={amount}
        asset={asset}
        rating={rating}
        reviewText={reviewText}
        txHash={releaseTxHash}
        createdAt={releasedAt}
        completionType={milestoneTitle ? "milestone" : "job"}
      />
      {rating !== undefined ? (
        <div className="hr-text-muted flex items-center gap-2 text-xs">
          <span>Verified rating:</span>
          <RatingStars rating={rating} />
        </div>
      ) : (
        <p className="hr-text-muted text-xs">Rating not provided</p>
      )}
      {reviewText ? (
        <p className="hr-text-muted line-clamp-2 text-xs italic">"{reviewText}"</p>
      ) : null}
      <div className="hr-text-accent text-xs">Paid through verified payment release</div>
      <Link
        href={`/proof/${encodeURIComponent(escrowId)}`}
        className="hr-text-accent inline-flex text-xs font-medium hover:opacity-80"
      >
        View proof
      </Link>
      {!releaseTxHash ? (
        <span className="hr-text-muted text-xs">Transaction hash not stored</span>
      ) : null}
    </div>
  );
}
