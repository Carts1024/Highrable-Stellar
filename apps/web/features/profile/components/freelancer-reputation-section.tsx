"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import {
  formatAssetAmountList,
  getReviewCompletionType,
  getWorkTypeLabel,
} from "@/features/profile/lib/profile-format";
import {
  HighrableV2Bullet,
  HighrableV2IconNotice,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUpRight, ExternalLink, Star } from "lucide-react";
import Link from "next/link";

import type {
  TFreelancerProfileStats,
  TFreelancerRecentContract,
  TVerifiedFreelancerReview,
} from "@/features/profile/types";
import type { ReactNode } from "react";

interface IFreelancerReputationSectionProps {
  readonly stats: TFreelancerProfileStats;
  readonly reviews: readonly TVerifiedFreelancerReview[];
  readonly contracts: readonly TFreelancerRecentContract[];
}

interface IStatItem {
  readonly label: string;
  readonly value: ReactNode;
  readonly helper: string;
}

type TReputationTab = readonly [
  value: "stats" | "reviews" | "history",
  label: string,
  count: string,
];

function getStatItems(stats: TFreelancerProfileStats): readonly IStatItem[] {
  const earnedValue = formatAssetAmountList(
    stats.totalEarnedByAsset,
    "No completed paid work yet.",
  );
  const pendingValue = formatAssetAmountList(stats.pendingEscrowByAsset, "0");
  const ratingValue =
    stats.averageRating === null ? "No ratings yet" : `${stats.averageRating.toFixed(1)} / 5`;

  return [
    {
      label: "Completed",
      value: stats.completedContracts,
      helper: "Released escrow contracts",
    },
    {
      label: "Micro gigs",
      value: stats.completedMicroGigs,
      helper: "Released gig escrows",
    },
    {
      label: "Milestones",
      value: stats.completedMilestones,
      helper: "Released milestone escrows",
    },
    {
      label: "Earned",
      value: earnedValue,
      helper: "Released payments by asset",
    },
    {
      label: "Pending escrow",
      value: pendingValue,
      helper: "Funded or submitted work",
    },
    {
      label: "Average rating",
      value: ratingValue,
      helper: `${stats.totalReviews} verified review${stats.totalReviews === 1 ? "" : "s"}`,
    },
    {
      label: "Active",
      value: stats.activeContracts,
      helper: `${stats.activeMilestones} active milestone${stats.activeMilestones === 1 ? "" : "s"}`,
    },
    {
      label: "Reviews",
      value: stats.totalReviews,
      helper: "Created after escrow release",
    },
  ];
}

function normalizeRating(rating: number): number | null {
  if (!Number.isFinite(rating)) {
    return null;
  }

  const roundedRating = Math.round(rating);
  return roundedRating >= 1 && roundedRating <= 5 ? roundedRating : null;
}

function ReputationEmptyState({ children }: { readonly children: ReactNode }) {
  return (
    <p className="border border-dashed border-[#e8e8e8] bg-[#fafafa] p-5 text-sm text-[#5f5f5f]">
      {children}
    </p>
  );
}

function StatsPanel({ stats }: { readonly stats: TFreelancerProfileStats }) {
  return (
    <div className="grid border border-[#e8e8e8] bg-white sm:grid-cols-2 lg:grid-cols-4">
      {getStatItems(stats).map((item) => (
        <div key={item.label} className="min-w-0 border-b border-[#e8e8e8] p-4 lg:p-5">
          <p className="font-mono text-[0.7rem] tracking-[0.06em] text-[#7f7f7f] uppercase">
            {item.label}
          </p>
          <div className="mt-2 text-2xl leading-tight font-semibold break-words text-[#0a0a0a]">
            {item.value}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#5f5f5f]">{item.helper}</p>
        </div>
      ))}
    </div>
  );
}

function RatingStars({ rating }: { readonly rating: number | null }) {
  if (rating === null) {
    return <span className="text-sm text-[#7f7f7f]">Not rated</span>;
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${rating} of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className="h-3.5 w-3.5"
          fill={index < rating ? "currentColor" : "none"}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ))}
      <span className="ml-2 font-mono text-xs font-medium text-[#5f5f5f]">{rating}/5</span>
    </span>
  );
}

function VerifiedReviewsPanel({
  reviews,
}: {
  readonly reviews: readonly TVerifiedFreelancerReview[];
}) {
  if (reviews.length === 0) {
    return (
      <ReputationEmptyState>
        No verified reviews yet. Reviews appear after paid escrow completion.
      </ReputationEmptyState>
    );
  }

  return (
    <div className="border border-[#e8e8e8] bg-white">
      {reviews.map((review) => {
        const safeRating = normalizeRating(review.rating);
        const title = review.milestoneTitle
          ? `${review.jobTitle} - ${review.milestoneTitle}`
          : review.jobTitle;

        return (
          <article
            key={review.escrowId}
            className="grid gap-4 border-b border-[#e8e8e8] p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_220px] lg:p-5"
          >
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-none border-emerald-200 text-emerald-700"
                >
                  {getReviewCompletionType(review.workType) === "milestone"
                    ? "Milestone Verified"
                    : "Gig Verified"}
                </Badge>
                <RatingStars rating={safeRating} />
              </div>
              <div>
                <Link
                  href={`/marketplace/jobs/${review.jobId}`}
                  className="font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
                >
                  {title}
                </Link>
                <p className="mt-1 text-sm leading-relaxed text-[#5f5f5f]">
                  {review.reviewText || "Review text was not provided for this verified payment."}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm lg:text-right">
              <p className="font-semibold text-[#0a0a0a]">
                {formatAmount(review.amount)} {formatAsset(review.asset)}
              </p>
              <p className="text-[#5f5f5f]">
                Client{" "}
                <Link
                  href={`/clients/${encodeURIComponent(review.clientWallet)}`}
                  className="font-medium text-[#B94A00] hover:underline"
                >
                  {shortenWalletAddress(review.clientWallet)}
                </Link>
              </p>
              <Link
                href={`/proof/${encodeURIComponent(review.escrowId)}`}
                className="inline-flex items-center gap-1 font-medium text-[#B94A00] hover:underline"
              >
                Proof <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              {review.txHash ? (
                <a
                  href={getTxExplorerUrl(review.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 inline-flex items-center gap-1 font-medium text-[#B94A00] hover:underline lg:ml-0 lg:block"
                >
                  Transaction <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function WorkHistoryPanel({
  contracts,
}: {
  readonly contracts: readonly TFreelancerRecentContract[];
}) {
  if (contracts.length === 0) {
    return (
      <ReputationEmptyState>
        No active or completed escrow-backed contracts yet.
      </ReputationEmptyState>
    );
  }

  return (
    <div className="border border-[#e8e8e8] bg-white">
      {contracts.map((contract) => (
        <article
          key={contract.escrowId}
          className="grid gap-4 border-b border-[#e8e8e8] p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px] lg:p-5"
        >
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-none border-[#e8e8e8] bg-[#fafafa]">
                {getWorkTypeLabel(contract.workType)}
              </Badge>
              <StatusBadge label={contract.status} />
            </div>
            <div>
              <Link
                href={`/marketplace/jobs/${contract.jobId}`}
                className="font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
              >
                {contract.jobTitle}
              </Link>
              {contract.milestoneTitle ? (
                <p className="mt-1 text-sm text-[#5f5f5f]">Milestone: {contract.milestoneTitle}</p>
              ) : null}
            </div>
            <p className="text-sm text-[#5f5f5f]">
              Client{" "}
              <Link
                href={`/clients/${encodeURIComponent(contract.clientWallet)}`}
                className="font-medium text-[#B94A00] hover:underline"
              >
                {shortenWalletAddress(contract.clientWallet)}
              </Link>
            </p>
          </div>

          <div className="space-y-2 text-sm md:text-right">
            <p className="font-semibold text-[#0a0a0a]">
              {formatAmount(contract.amount)} {formatAsset(contract.asset)}
            </p>
            <Link
              href={`/proof/${encodeURIComponent(contract.escrowId)}`}
              className="inline-flex items-center gap-1 font-medium text-[#B94A00] hover:underline"
            >
              View proof <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            {contract.releaseTxHash ? (
              <a
                href={getTxExplorerUrl(contract.releaseTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 inline-flex items-center gap-1 font-medium text-[#B94A00] hover:underline md:ml-0 md:block"
              >
                Release tx <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
            <p className="font-mono text-xs text-[#7f7f7f]">
              Updated {new Date(contract.updatedAt).toLocaleString()}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function FreelancerReputationSection({
  stats,
  reviews,
  contracts,
}: IFreelancerReputationSectionProps) {
  const reputationTabs: readonly TReputationTab[] = [
    ["stats", "Stats", stats.completedContracts.toString()],
    ["reviews", "Reviews", reviews.length.toString()],
    ["history", "Work history", contracts.length.toString()],
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8e8e8] pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SectionLabel>Verified Reputation</SectionLabel>
            <HighrableV2IconNotice
              label="Why this reputation is verified"
              tone="success"
              message="Highrable creates verified reviews only after escrow payment is released, making completed work harder to fake than normal marketplace reviews."
            />
          </div>
          <h2 className="text-2xl font-semibold text-[#0a0a0a]">Escrow-backed work signal</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-[#5f5f5f]">
            Stats, reviews, and work history are grouped here so clients can inspect reputation
            without scanning separate warning panels.
          </p>
        </div>
        {stats.disputedContracts > 0 ? (
          <Badge
            variant="outline"
            className="rounded-none border-amber-200 bg-amber-50 text-amber-800"
          >
            {stats.disputedContracts} disputed
          </Badge>
        ) : null}
      </div>

      <Tabs defaultValue="stats" className="gap-5">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start overflow-x-auto border-b border-[#e8e8e8] pb-0"
        >
          {reputationTabs.map(([value, label, count]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "rounded-none px-0 py-3 pr-6 font-mono text-xs tracking-[0.06em] uppercase",
                "data-[state=active]:text-[#0a0a0a] data-[state=active]:after:bg-[#FF7003]",
              )}
            >
              <HighrableV2Bullet aria-hidden="true" />
              {label}
              <span className="text-[#7f7f7f]">{count}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="stats">
          <StatsPanel stats={stats} />
        </TabsContent>
        <TabsContent value="reviews">
          <VerifiedReviewsPanel reviews={reviews} />
        </TabsContent>
        <TabsContent value="history">
          <WorkHistoryPanel contracts={contracts} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
