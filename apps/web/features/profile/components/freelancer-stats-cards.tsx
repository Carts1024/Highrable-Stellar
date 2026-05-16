import { formatAssetAmountList } from "@/features/profile/lib/profile-format";
import { Badge } from "@repo/ui/components/ui/badge";
import { Briefcase, CheckCircle, Clock, DollarSign, Star } from "lucide-react";

import type { TFreelancerProfileStats } from "@/features/profile/types";
import type { LucideIcon } from "lucide-react";

type TStatCard = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly Icon: LucideIcon;
};

function StatCard({ label, value, helper, Icon }: TStatCard) {
  return (
    <article className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">{label}</p>
        <Icon className="h-4 w-4 text-[#FF7003]" aria-hidden="true" />
      </div>
      <p className="text-2xl font-semibold text-[#0a0a0a]">{value}</p>
      <p className="mt-1 text-sm text-[#5f5f5f]">{helper}</p>
    </article>
  );
}

export function FreelancerStatsCards({ stats }: { readonly stats: TFreelancerProfileStats }) {
  const earnedValue = formatAssetAmountList(
    stats.totalEarnedByAsset,
    "No completed paid work yet.",
  );
  const pendingValue = formatAssetAmountList(stats.pendingEscrowByAsset, "0");
  const ratingValue =
    stats.averageRating === null ? "No ratings yet" : `${stats.averageRating.toFixed(1)} / 5`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#0a0a0a]">Escrow-backed stats</h2>
        {stats.disputedContracts > 0 ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
            Some contracts were disputed.
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Verified completed contracts"
          value={stats.completedContracts.toString()}
          helper="Micro gigs and milestones with released escrow"
          Icon={CheckCircle}
        />
        <StatCard
          label="Completed micro gigs"
          value={stats.completedMicroGigs.toString()}
          helper="Released escrows not linked to milestones"
          Icon={Briefcase}
        />
        <StatCard
          label="Completed milestones"
          value={stats.completedMilestones.toString()}
          helper="Released milestone-specific escrows"
          Icon={CheckCircle}
        />
        <StatCard
          label="Total earned"
          value={earnedValue}
          helper="Released payments grouped by asset"
          Icon={DollarSign}
        />
        <StatCard
          label="Pending escrow"
          value={pendingValue}
          helper="Funded or submitted work awaiting release"
          Icon={Clock}
        />
        <StatCard
          label="Average rating"
          value={ratingValue}
          helper={`${stats.totalReviews} verified review${stats.totalReviews === 1 ? "" : "s"}`}
          Icon={Star}
        />
        <StatCard
          label="Active contracts"
          value={stats.activeContracts.toString()}
          helper={`${stats.activeMilestones} active milestone${stats.activeMilestones === 1 ? "" : "s"}`}
          Icon={Briefcase}
        />
        <StatCard
          label="Total verified reviews"
          value={stats.totalReviews.toString()}
          helper="Created only after escrow release"
          Icon={Star}
        />
      </div>
    </section>
  );
}
