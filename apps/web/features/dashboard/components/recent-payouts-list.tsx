"use client";

import { RouteEmptyState, SectionHeading } from "@/features/common";
import { RecentPayoutItem } from "@/features/dashboard/components/recent-payout-item";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";

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
    >
      <section className="space-y-5">
        <SectionHeading
          icon={Wallet}
          title="Recent payments received"
          description="Each payment here is linked to a finished job."
        />

        {payouts.length === 0 ? (
          <RouteEmptyState
            icon={<Wallet className="h-10 w-10" />}
            title="No completed payouts yet"
            description="Completed payment releases will appear here."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {payouts.map((payout) => (
              <RecentPayoutItem key={payout.escrowId} payout={payout} />
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
