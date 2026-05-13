"use client";

import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { Star } from "lucide-react";

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
      <span className="ml-1 text-xs text-gray-500">{rating}/5</span>
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
    <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="truncate text-sm font-semibold text-gray-900">{jobTitle ?? "Untitled Job"}</p>
      {milestoneTitle ? (
        <p className="text-xs font-medium text-[#5f5f5f]">Milestone: {milestoneTitle}</p>
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
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Verified rating:</span>
          <RatingStars rating={rating} />
        </div>
      ) : (
        <p className="text-xs text-gray-500">Rating not provided</p>
      )}
      {reviewText ? (
        <p className="line-clamp-2 text-xs text-gray-500 italic">"{reviewText}"</p>
      ) : null}
      <div className="text-xs text-emerald-700">Paid through Stellar escrow</div>
      {!releaseTxHash ? (
        <span className="text-xs text-gray-400">Transaction hash not stored</span>
      ) : null}
    </div>
  );
}
