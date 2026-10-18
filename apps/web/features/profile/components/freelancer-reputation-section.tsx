"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  RouteCallout,
  RouteEmptyState,
  StatCard,
  WorkList,
  WorkListRow,
  WorkMeta,
} from "@/features/common";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import {
  formatAssetAmountList,
  getReviewCompletionType,
  getWorkTypeLabel,
} from "@/features/profile/lib/profile-format";
import { HighrableV2IconNotice } from "@repo/ui/components/highrable/v2-marketing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Star } from "lucide-react";
import Link from "next/link";
import React from "react";

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

type TReputationTab = readonly [value: "reviews" | "history", label: string, count: string];

function getStatItems(stats: TFreelancerProfileStats): readonly IStatItem[] {
  const earnedValue = formatAssetAmountList(
    stats.totalEarnedByAsset,
    "No completed paid work yet.",
  );
  const pendingValue = formatAssetAmountList(stats.pendingEscrowByAsset, "0");
  const ratingValue =
    stats.averageRating === null ? "No ratings yet" : `${stats.averageRating.toFixed(1)} / 5`;

  return [
    { label: "Completed", value: stats.completedContracts, helper: "Paid jobs and milestones" },
    { label: "Quick jobs", value: stats.completedMicroGigs, helper: "Completed and paid" },
    { label: "Milestones", value: stats.completedMilestones, helper: "Completed and paid" },
    { label: "Earned", value: earnedValue, helper: "Released to this freelancer" },
    { label: "On hold", value: pendingValue, helper: "Funded or handed in" },
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
    { label: "Reviews", value: stats.totalReviews, helper: "Left after payment release" },
  ];
}

function normalizeRating(rating: number): number | null {
  if (!Number.isFinite(rating)) return null;
  const rounded = Math.round(rating);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

function ReputationEmptyState({ children }: { readonly children: ReactNode }) {
  return <RouteEmptyState description={children} />;
}

function StatsPanel({ stats }: { readonly stats: TFreelancerProfileStats }) {
  const items = getStatItems(stats);
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card p-4">
          <StatCard label={item.label} value={item.value} description={item.helper} />
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
      <span className="ml-1.5 text-xs text-muted-foreground">{rating}/5</span>
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
        No verified reviews yet. Reviews appear after paid payment hold completion.
      </ReputationEmptyState>
    );
  }

  return (
    <WorkList>
      {reviews.map((review) => {
        const safeRating = normalizeRating(review.rating);
        const title = review.milestoneTitle
          ? `${review.jobTitle} — ${review.milestoneTitle}`
          : review.jobTitle;

        return (
          <WorkListRow
            key={review.escrowId}
            href={`/marketplace/jobs/${review.jobId}`}
            title={title}
            amount={`${formatAmount(review.amount)} ${formatAsset(review.asset)}`}
            amountLabel="Paid"
            status={<RatingStars rating={safeRating} />}
            meta={
              <>
                <span>
                  {getReviewCompletionType(review.workType) === "milestone"
                    ? "Milestone"
                    : "Quick job"}
                </span>
                <WorkMeta label="Client">
                  <Link
                    href={`/clients/${encodeURIComponent(review.clientWallet)}`}
                    className="font-mono hover:underline"
                  >
                    {shortenWalletAddress(review.clientWallet)}
                  </Link>
                </WorkMeta>
                <Link
                  href={`/proof/${encodeURIComponent(review.escrowId)}`}
                  className="hr-mode-text hover:underline"
                >
                  Payment proof
                </Link>
                {review.txHash ? (
                  <a
                    href={getTxExplorerUrl(review.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Transaction
                  </a>
                ) : null}
              </>
            }
          >
            <p className="hr-text-secondary mt-2 text-sm leading-relaxed">
              {review.reviewText || <span className="hr-text-muted">No written review.</span>}
            </p>
          </WorkListRow>
        );
      })}
    </WorkList>
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
        No active or completed payment-backed contracts yet.
      </ReputationEmptyState>
    );
  }

  return (
    <WorkList>
      {contracts.map((contract) => (
        <WorkListRow
          key={contract.escrowId}
          href={`/marketplace/jobs/${contract.jobId}`}
          title={contract.jobTitle}
          subtitle={contract.milestoneTitle ? `Milestone: ${contract.milestoneTitle}` : undefined}
          amount={`${formatAmount(contract.amount)} ${formatAsset(contract.asset)}`}
          amountLabel="Amount"
          status={<StatusBadge label={contract.status} />}
          meta={
            <>
              <span>{getWorkTypeLabel(contract.workType)}</span>
              <WorkMeta label="Client">
                <Link
                  href={`/clients/${encodeURIComponent(contract.clientWallet)}`}
                  className="font-mono hover:underline"
                >
                  {shortenWalletAddress(contract.clientWallet)}
                </Link>
              </WorkMeta>
              <WorkMeta label="Updated">
                {new Date(contract.updatedAt).toLocaleDateString()}
              </WorkMeta>
              <Link
                href={`/proof/${encodeURIComponent(contract.escrowId)}`}
                className="hr-mode-text hover:underline"
              >
                Payment proof
              </Link>
              {contract.releaseTxHash ? (
                <a
                  href={getTxExplorerUrl(contract.releaseTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Release transaction
                </a>
              ) : null}
            </>
          }
        />
      ))}
    </WorkList>
  );
}

export function FreelancerReputationSection({
  stats,
  reviews,
  contracts,
}: IFreelancerReputationSectionProps) {
  const reputationTabs: readonly TReputationTab[] = [
    ["reviews", "Reviews", reviews.length.toString()],
    ["history", "Work history", contracts.length.toString()],
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="freelancer-record-title" className="space-y-3">
        <div className="flex items-center gap-1.5">
          <h2 id="freelancer-record-title" className="hr-text-primary text-base font-semibold">
            Track record
          </h2>
          <HighrableV2IconNotice
            label="Where these numbers come from"
            tone="neutral"
            message="Every figure comes from a real, paid job on Highrable and is linked to its payment on Stellar."
          />
        </div>
        {stats.disputedContracts > 0 ? (
          <RouteCallout tone="warning">
            {stats.disputedContracts} {stats.disputedContracts === 1 ? "job was" : "jobs were"}{" "}
            disputed.
          </RouteCallout>
        ) : null}
        <StatsPanel stats={stats} />
      </section>

      <section aria-labelledby="freelancer-work-title" className="space-y-3">
        <h2 id="freelancer-work-title" className="sr-only">
          Reviews and work history
        </h2>
        <Tabs defaultValue="reviews" className="gap-4">
          <TabsList variant="line" className="h-auto w-full justify-start gap-6 border-b pb-0">
            {reputationTabs.map(([value, label, count]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none rounded-none px-0 py-2.5 text-sm data-[state=active]:font-medium data-[state=active]:after:bg-(--mode-solid)"
              >
                {label}
                <span className="hr-text-muted ml-1.5 font-normal">{count}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="reviews">
            <VerifiedReviewsPanel reviews={reviews} />
          </TabsContent>
          <TabsContent value="history">
            <WorkHistoryPanel contracts={contracts} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
