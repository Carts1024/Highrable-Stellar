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
    <article className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm">
      <div>
        <h3 className="hr-text-primary truncate text-base font-bold transition-colors group-hover:text-highrable-orange-3">
          {jobTitle ?? "Untitled Job"}
        </h3>
        {milestoneTitle ? (
          <p className="hr-text-muted truncate text-xs font-medium">Milestone: {milestoneTitle}</p>
        ) : null}
      </div>

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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-y border-border/80 bg-muted/50 px-4 py-3 text-xs">
        {rating !== undefined ? (
          <div className="hr-text-muted flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
              Verified rating
            </span>
            <RatingStars rating={rating} />
          </div>
        ) : (
          <p className="hr-text-muted text-xs">Rating not provided</p>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
          Paid through verified payment release
        </div>
      </div>

      {reviewText ? (
        <p className="hr-text-secondary line-clamp-2 text-sm leading-relaxed italic">
          "{reviewText}"
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {!releaseTxHash ? (
          <span className="hr-text-muted text-xs">Transaction hash not stored</span>
        ) : (
          <span />
        )}
        <Link
          href={`/proof/${encodeURIComponent(escrowId)}`}
          className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.06em] text-highrable-orange-3 uppercase hover:underline"
        >
          View proof
        </Link>
      </div>
    </article>
  );
}
