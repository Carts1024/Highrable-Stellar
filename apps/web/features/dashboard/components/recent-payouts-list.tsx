"use client";

import { RouteEmptyState } from "@/features/common";
import { WorkList } from "@/features/common/components/work-list";
import { RecentPayoutItem } from "@/features/dashboard/components/recent-payout-item";
import React from "react";

import type { TRecentPayout } from "@/features/dashboard/types";

type IRecentPayoutsListProps = {
  payouts: TRecentPayout[];
};

export function RecentPayoutsList({ payouts }: IRecentPayoutsListProps) {
  if (payouts.length === 0) {
    return (
      <RouteEmptyState
        title="No payments yet"
        description="When a client releases a payment to you, it is listed here with its proof."
      />
    );
  }

  return (
    <WorkList>
      {payouts.map((payout) => (
        <RecentPayoutItem key={payout.escrowId} payout={payout} />
      ))}
    </WorkList>
  );
}
