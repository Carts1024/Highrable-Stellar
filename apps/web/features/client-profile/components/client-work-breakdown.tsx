import React from "react";

import type { TClientTrustStats } from "@/features/client-profile/types";

type TBreakdownItem = {
  readonly label: string;
  readonly value: number;
  readonly helper: string;
};

export function ClientWorkBreakdown({ stats }: { readonly stats: TClientTrustStats }) {
  const breakdownItems: readonly TBreakdownItem[] = [
    {
      label: "Quick jobs posted",
      value: stats.microGigsPosted,
      helper: "Single-payment hold job posts",
    },
    {
      label: "Milestone projects",
      value: stats.milestoneProjectsPosted,
      helper: "Projects split into milestones",
    },
    {
      label: "Quick jobs completed",
      value: stats.completedMicroGigs,
      helper: "Released payment holds without milestones",
    },
    {
      label: "Milestones completed",
      value: stats.completedMilestones,
      helper: "Released milestone payment holds",
    },
    {
      label: "Milestones created",
      value: stats.totalMilestonesCreated,
      helper: "Total project milestones posted",
    },
  ];

  return (
    <div className="space-y-2">
      <h3 className="hr-text-primary text-sm font-semibold">Work mix</h3>
      <dl className="hr-text-secondary flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
        {breakdownItems.map((item) => (
          <div key={item.label} className="flex gap-1.5" title={item.helper}>
            <dt>{item.label}</dt>
            <dd className="hr-text-primary hr-num font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="hr-text-muted text-xs">
        For milestone projects, each milestone is funded on its own.
      </p>
    </div>
  );
}
