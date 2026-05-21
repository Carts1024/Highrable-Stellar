"use client";

import { VerifiedReviewCard } from "@/features/common/components/reputation/verified-review-card";
import { getReviewCompletionType } from "@/features/profile/lib/profile-format";

import type { TVerifiedFreelancerReview } from "@/features/profile/types";

export function FreelancerReviewsSection({
  reviews,
}: {
  readonly reviews: readonly TVerifiedFreelancerReview[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Verified reviews</h2>
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e8e8e8] bg-white p-5 text-sm text-[#5f5f5f]">
          No verified reviews yet. Reviews appear after paid escrow completion.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((review) => (
            <VerifiedReviewCard
              key={review.escrowId}
              jobTitle={
                review.milestoneTitle
                  ? `${review.jobTitle} - ${review.milestoneTitle}`
                  : review.jobTitle
              }
              escrowId={review.escrowId}
              clientWallet={review.clientWallet}
              freelancerWallet={review.freelancerWallet}
              amount={review.amount}
              asset={review.asset}
              rating={review.rating}
              reviewText={review.reviewText}
              txHash={review.txHash}
              createdAt={review.createdAt}
              completionType={getReviewCompletionType(review.workType)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
