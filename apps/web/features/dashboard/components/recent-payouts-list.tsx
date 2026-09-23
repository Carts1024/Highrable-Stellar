"use client";

import { RouteEmptyState } from "@/features/common";
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
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Recent Payouts
          </p>
          <h2 className="hr-text-primary font-sans text-lg font-semibold">Verified releases</h2>
          <p className="hr-text-secondary mt-1 font-sans text-sm">
            Verified payouts are linked to completed escrow records.
          </p>
        </div>

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
