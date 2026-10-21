import {
  formatAssetAmountList,
  formatPercent,
} from "@/features/client-profile/lib/client-profile-format";
import { StatCard } from "@/features/common";
import React from "react";

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
      label: "Jobs posted",
      value: stats.jobsPosted.toString(),
      helper: "Jobs created by this wallet",
    },
    {
      label: "Payment holds funded",
      value: stats.fundedEscrows.toString(),
      helper: `${stats.escrowsCreated} escrow${stats.escrowsCreated === 1 ? "" : "s"} created`,
    },
    {
      label: "Completed payments",
      value: stats.completedEscrows.toString(),
      helper: "Payments that were paid out",
    },
    {
      label: "Total put on hold",
      value: totalFunded,
      helper: "Funded, submitted and released",
    },
    {
      label: "Total paid",
      value: totalPaid,
      helper: "Released to freelancers",
    },
    {
      label: "Funding reliability",
      value: formatPercent(stats.fundingReliabilityRate),
      helper: "Funded ÷ created",
    },
    {
      label: "Disputed",
      value: stats.disputedEscrows.toString(),
      helper: `${formatPercent(stats.disputeRate)} dispute rate`,
    },
    {
      label: "Cancelled",
      value: stats.cancelledEscrows.toString(),
      helper: `${formatPercent(stats.cancellationRate)} cancellation rate`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
      {statItems.map((item) => (
        <div key={item.label} className="bg-card p-4">
          <StatCard label={item.label} value={item.value} description={item.helper} />
        </div>
      ))}
    </div>
  );
}
