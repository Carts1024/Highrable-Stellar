"use client";

import { RouteEmptyState, RoutePanel, RoutePanelHeader } from "@/features/common";
import { RecentPayoutItem } from "@/features/dashboard/components/recent-payout-item";
import { motion } from "framer-motion";
import { Receipt } from "lucide-react";

import type { TRecentPayout } from "@/features/dashboard/types";

type IRecentPayoutsListProps = {
  payouts: TRecentPayout[];
};

export function RecentPayoutsList({ payouts }: IRecentPayoutsListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className=""
    >
      <RoutePanel className="overflow-hidden">
        <RoutePanelHeader
          title="Recent payouts"
          description="Verified payouts are linked to completed escrow records."
          icon={<Receipt className="h-5 w-5" />}
        />

        <div className="px-6 pb-6">
          {payouts.length === 0 ? (
            <RouteEmptyState
              icon={<Receipt className="h-5 w-5" />}
              description="No completed payouts yet. Completed payment releases will appear here."
            />
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <RecentPayoutItem key={payout.escrowId} payout={payout} />
              ))}
            </div>
          )}
        </div>
      </RoutePanel>
    </motion.div>
  );
}
