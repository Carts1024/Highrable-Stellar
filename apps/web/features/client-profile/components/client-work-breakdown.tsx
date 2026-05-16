import { Briefcase, CheckCircle, ListChecks } from "lucide-react";

import type { TClientTrustStats } from "@/features/client-profile/types";
import type { LucideIcon } from "lucide-react";

type TBreakdownItem = {
  readonly label: string;
  readonly value: number;
  readonly helper: string;
  readonly Icon: LucideIcon;
};

function BreakdownItem({ label, value, helper, Icon }: TBreakdownItem) {
  return (
    <article className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0a0a0a]">
        <Icon className="h-4 w-4 text-[#FF7003]" aria-hidden="true" />
        {label}
      </div>
      <p className="text-2xl font-semibold text-[#0a0a0a]">{value}</p>
      <p className="mt-1 text-sm text-[#5f5f5f]">{helper}</p>
    </article>
  );
}

export function ClientWorkBreakdown({ stats }: { readonly stats: TClientTrustStats }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-[#0a0a0a]">Micro gig vs milestone activity</h2>
        <p className="mt-1 text-sm text-[#5f5f5f]">
          Funding is tracked per escrow. For milestone projects, each milestone has its own funding
          status.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <BreakdownItem
          label="Micro gigs posted"
          value={stats.microGigsPosted}
          helper="Single-escrow job posts"
          Icon={Briefcase}
        />
        <BreakdownItem
          label="Milestone projects"
          value={stats.milestoneProjectsPosted}
          helper="Projects split into milestones"
          Icon={ListChecks}
        />
        <BreakdownItem
          label="Completed micro gigs"
          value={stats.completedMicroGigs}
          helper="Released escrows without milestones"
          Icon={CheckCircle}
        />
        <BreakdownItem
          label="Completed milestones"
          value={stats.completedMilestones}
          helper="Released milestone escrows"
          Icon={CheckCircle}
        />
        <BreakdownItem
          label="Milestones created"
          value={stats.totalMilestonesCreated}
          helper="Total project milestones posted"
          Icon={ListChecks}
        />
      </div>
    </section>
  );
}
