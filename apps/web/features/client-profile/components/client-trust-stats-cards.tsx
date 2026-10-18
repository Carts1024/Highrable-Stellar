import {
  formatAssetAmountList,
  formatPercent,
} from "@/features/client-profile/lib/client-profile-format";
import { getStatStyle } from "@/features/common";
import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";

import type { TClientTrustStats } from "@/features/client-profile/types";

type TStatItem = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
};

export function ClientTrustStatsCards({ stats }: { readonly stats: TClientTrustStats }) {
  const totalFunded = formatAssetAmountList(
    stats.totalEscrowFundedByAsset,
    "No funded payment hold history yet.",
  );
  const totalPaid = formatAssetAmountList(stats.totalPaidByAsset, "No completed payments yet.");
  const statItems: readonly TStatItem[] = [
    {
      label: "Jobs Posted",
      value: stats.jobsPosted.toString(),
      helper: "Jobs created by this wallet",
    },
    {
      label: "Payment Holds Funded",
      value: stats.fundedEscrows.toString(),
      helper: `${stats.escrowsCreated} escrow${stats.escrowsCreated === 1 ? "" : "s"} created`,
    },
    {
      label: "Completed Payments",
      value: stats.completedEscrows.toString(),
      helper: "Payments that were paid out",
    },
    {
      label: "Total Payment Hold Funded",
      value: totalFunded,
      helper: "Funded, submitted, and released payment holds by currency",
    },
    {
      label: "Total Paid",
      value: totalPaid,
      helper: "Released payments grouped by currency",
    },
    {
      label: "Funding Reliability",
      value: formatPercent(stats.fundingReliabilityRate),
      helper: "Funded payment holds divided by created payment holds",
    },
    {
      label: "Disputed Payment Holds",
      value: stats.disputedEscrows.toString(),
      helper: `${formatPercent(stats.disputeRate)} dispute rate`,
    },
    {
      label: "Cancelled Payment Holds",
      value: stats.cancelledEscrows.toString(),
      helper: `${formatPercent(stats.cancellationRate)} cancellation rate`,
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--mode-border)] bg-white shadow-sm">
      <div className="hr-card-head flex flex-wrap items-start justify-between gap-3 p-5 sm:px-6">
        <div>
          <SectionLabel>Payment Hold Behavior</SectionLabel>
          <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">Trust Stats</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.disputedEscrows > 0 ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
              Dispute activity recorded
            </Badge>
          ) : null}
          {stats.fundedEscrows === 0 ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              No funded payment hold history yet
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        {statItems.map((item, index) => {
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
