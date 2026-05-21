import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";

import type { TClientTrustStats } from "@/features/client-profile/types";

type TBreakdownItem = {
  readonly label: string;
  readonly value: number;
  readonly helper: string;
};

export function ClientWorkBreakdown({ stats }: { readonly stats: TClientTrustStats }) {
  const breakdownItems: readonly TBreakdownItem[] = [
    {
      label: "Micro gigs posted",
      value: stats.microGigsPosted,
      helper: "Single-escrow job posts",
    },
    {
      label: "Milestone projects",
      value: stats.milestoneProjectsPosted,
      helper: "Projects split into milestones",
    },
    {
      label: "Completed micro gigs",
      value: stats.completedMicroGigs,
      helper: "Released escrows without milestones",
    },
    {
      label: "Completed milestones",
      value: stats.completedMilestones,
      helper: "Released milestone escrows",
    },
    {
      label: "Milestones created",
      value: stats.totalMilestonesCreated,
      helper: "Total project milestones posted",
    },
  ];

  return (
    <section className="border border-[#e8e8e8] bg-white">
      <div className="border-b border-[#e8e8e8] p-5 sm:p-6">
        <SectionLabel>Work Mix</SectionLabel>
        <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">
          Micro gig vs milestone activity
        </h2>
        <p className="mt-1 text-sm text-[#5f5f5f]">
          Funding is tracked per escrow. For milestone projects, each milestone has its own funding
          status.
        </p>
      </div>
      <div className="grid gap-y-6 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-5">
        {breakdownItems.map((item) => (
          <HighrableV2Metric
            key={item.label}
            label={item.label}
            value={item.value}
            description={item.helper}
          />
        ))}
      </div>
    </section>
  );
}
