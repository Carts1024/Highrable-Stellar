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
    { label: "Completed", value: stats.completedContracts, helper: "Released escrow contracts" },
    { label: "Micro gigs", value: stats.completedMicroGigs, helper: "Released gig escrows" },
    { label: "Milestones", value: stats.completedMilestones, helper: "Released milestone escrows" },
    { label: "Earned", value: earnedValue, helper: "Released payments by asset" },
    { label: "Pending escrow", value: pendingValue, helper: "Funded or submitted work" },
    {
      label: "Avg rating",
      value: ratingValue,
      helper: `${stats.totalReviews} verified review${stats.totalReviews === 1 ? "" : "s"}`,
    },
    {
      label: "Active",
      value: stats.activeContracts,
      helper: `${stats.activeMilestones} active milestone${stats.activeMilestones === 1 ? "" : "s"}`,
    },
    { label: "Reviews", value: stats.totalReviews, helper: "Created after escrow release" },
  ];
}

function normalizeRating(rating: number): number | null {
  if (!Number.isFinite(rating)) return null;
  const rounded = Math.round(rating);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

function ReputationEmptyState({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card p-5 font-sans text-sm text-muted-foreground sm:rounded-2xl">
      {children}
    </p>
  );
}

function StatsPanel({ stats }: { readonly stats: TFreelancerProfileStats }) {
  const items = getStatItems(stats);
  return (
    <div className="grid rounded-xl border border-border bg-card shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "min-w-0 p-4 lg:p-5",
            index < items.length - 1 ? "border-b border-border" : "",
            "sm:odd:border-r sm:odd:border-border",
            "lg:nth-child(4n):border-r-0 lg:nth-last-child(-n+4):border-b-0 lg:border-r lg:border-b lg:border-border",
          )}
        >
          <p className="font-mono text-xs tracking-[0.08em] text-highrable-orange-3 uppercase">
            {item.label}
          </p>
          <div className="wrap-break-words hr-text-primary mt-2 font-sans text-2xl leading-tight font-semibold">
            {item.value}
          </div>
          <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted-foreground">
            {item.helper}
          </p>
        </div>
      ))}
    </div>
  );
}

function RatingStars({ rating }: { readonly rating: number | null }) {
  if (rating === null) {
    return <span className="text-xs text-muted-foreground">Not rated</span>;
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
      <span className="ml-1.5 font-mono text-[11px] font-medium text-muted-foreground">
        {rating}/5
      </span>
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
    <div className="flex flex-col gap-4">
      {reviews.map((review) => {
        const safeRating = normalizeRating(review.rating);
        const title = review.milestoneTitle
          ? `${review.jobTitle} — ${review.milestoneTitle}`
          : review.jobTitle;

        return (
          <article
            key={review.escrowId}
            className="rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-4 sm:px-6">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                {getReviewCompletionType(review.workType) === "milestone"
                  ? "Milestone verified"
                  : "Gig verified"}
              </span>
              <RatingStars rating={safeRating} />
            </div>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_200px]">
              <div className="min-w-0 space-y-2">
                <Link
                  href={`/marketplace/jobs/${review.jobId}`}
                  className="hr-text-primary font-semibold transition-colors hover:text-highrable-orange-3"
                >
                  {title}
                </Link>
                <p className="hr-text-secondary font-sans text-sm leading-relaxed">
                  {review.reviewText || "Review text was not provided for this verified payment."}
                </p>
              </div>

              <div className="flex flex-col gap-2 text-sm lg:items-end lg:text-right">
                <p className="hr-text-primary font-semibold">
                  {formatAmount(review.amount)} {formatAsset(review.asset)}
                </p>
                <p className="text-muted-foreground">
                  Client{" "}
                  <Link
                    href={`/clients/${encodeURIComponent(review.clientWallet)}`}
                    className="font-medium text-highrable-orange-3 hover:underline"
                  >
                    {shortenWalletAddress(review.clientWallet)}
                  </Link>
                </p>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <Link
                    href={`/proof/${encodeURIComponent(review.escrowId)}`}
                    className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 hover:underline"
                  >
                    Proof <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  {review.txHash ? (
                    <a
                      href={getTxExplorerUrl(review.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 hover:underline"
                    >
                      Transaction <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </div>
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
    <div className="flex flex-col gap-4">
      {contracts.map((contract) => (
        <article
          key={contract.escrowId}
          className="rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-4 sm:px-6">
            <span className="hr-text-primary inline-flex items-center rounded-md border border-border/80 bg-muted/50 px-2.5 py-1 text-[11px] font-medium">
              {getWorkTypeLabel(contract.workType)}
            </span>
            <StatusBadge label={contract.status} />
          </div>

          <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_200px]">
            <div className="min-w-0 space-y-2">
              <Link
                href={`/marketplace/jobs/${contract.jobId}`}
                className="hr-text-primary font-semibold transition-colors hover:text-highrable-orange-3"
              >
                {contract.jobTitle}
              </Link>
              {contract.milestoneTitle ? (
                <p className="text-xs text-muted-foreground">
                  Milestone: {contract.milestoneTitle}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Client{" "}
                <Link
                  href={`/clients/${encodeURIComponent(contract.clientWallet)}`}
                  className="font-medium text-highrable-orange-3 hover:underline"
                >
                  {shortenWalletAddress(contract.clientWallet)}
                </Link>
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm md:items-end md:text-right">
              <p className="hr-text-primary font-semibold">
                {formatAmount(contract.amount)} {formatAsset(contract.asset)}
              </p>
              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <Link
                  href={`/proof/${encodeURIComponent(contract.escrowId)}`}
                  className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 hover:underline"
                >
                  View proof <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                {contract.releaseTxHash ? (
                  <a
                    href={getTxExplorerUrl(contract.releaseTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-highrable-orange-3 hover:underline"
                  >
                    Release tx <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground/60">
                Updated {new Date(contract.updatedAt).toLocaleString()}
              </p>
            </div>
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
      {/* Section card header — mirrors job-detail milestone progress card */}
      <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
              Verified Reputation
            </p>
            <h2 className="hr-text-primary mt-0.5 font-sans text-lg font-semibold">
              Escrow-backed work signal
            </h2>
            <p className="hr-text-secondary mt-1 font-sans text-sm">
              Stats, reviews, and work history are backed by real Stellar escrow transactions —
              clients can verify authenticity on-chain.
            </p>
          </div>
          {stats.disputedContracts > 0 ? (
            <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              {stats.disputedContracts} disputed
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5 border-t border-border/60 pt-5 text-sm sm:grid-cols-3">
          <div>
            <p className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
              Completed
            </p>
            <p className="hr-text-primary mt-1 font-sans text-xl font-semibold">
              {stats.completedContracts}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
              Avg rating
            </p>
            <p className="hr-text-primary mt-1 font-sans text-xl font-semibold">
              {stats.averageRating === null
                ? "No ratings yet"
                : `${stats.averageRating.toFixed(1)} / 5`}
            </p>
          </div>
          <div>
            <p className="font-mono text-xs tracking-[0.06em] text-muted-foreground/70 uppercase">
              Verified reviews
            </p>
            <p className="hr-text-primary mt-1 font-sans text-xl font-semibold">
              {stats.totalReviews}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stats" className="mt-8 gap-5">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start border-b border-border/60 pb-0"
        >
          {reputationTabs.map(([value, label, count]) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "rounded-none px-0 py-3 pr-6 font-mono text-xs font-semibold tracking-[0.08em] uppercase",
                "data-[state=active]:text-highrable-orange-3 data-[state=active]:after:bg-highrable-orange-3",
              )}
            >
              {label}
              <span className="ml-1.5 font-sans text-muted-foreground/60">{count}</span>
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
