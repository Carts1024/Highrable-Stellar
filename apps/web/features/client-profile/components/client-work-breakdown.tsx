import { getStatStyle } from "@/features/common";
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
      label: "Micro Gigs Posted",
      value: stats.microGigsPosted,
      helper: "Single-payment hold job posts",
    },
    {
      label: "Milestone Projects",
      value: stats.milestoneProjectsPosted,
      helper: "Projects split into milestones",
    },
    {
      label: "Completed Quick Jobs",
      value: stats.completedMicroGigs,
      helper: "Released payment holds without milestones",
    },
    {
      label: "Completed Milestones",
      value: stats.completedMilestones,
      helper: "Released milestone payment holds",
    },
    {
      label: "Milestones Created",
      value: stats.totalMilestonesCreated,
      helper: "Total project milestones posted",
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--mode-border)] bg-white shadow-sm">
      <div className="hr-card-head p-5 sm:px-6">
        <SectionLabel>Work Mix</SectionLabel>
        <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">
          Micro Gig vs Milestone Activity
        </h2>
        <p className="mt-1 text-sm text-[#5f5f5f]">
          Funding is tracked per payment hold. For milestone projects, each milestone has its own
          funding status.
        </p>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-5">
        {breakdownItems.map((item, index) => {
          const { tone, Icon } = getStatStyle(index);
          return (
            <HighrableV2Metric
              tone={tone}
              icon={<Icon className="h-5 w-5" aria-hidden="true" />}
              key={item.label}
              label={item.label}
              value={item.value}
              description={item.helper}
            />
          );
        })}
      </div>
    </section>
  );
}
