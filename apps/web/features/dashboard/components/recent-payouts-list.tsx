"use client";

import { RecentPayoutItem } from "@/features/dashboard/components/recent-payout-item";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { motion } from "framer-motion";

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
      <section className="space-y-4">
        <div>
          <SectionLabel>Recent Payouts</SectionLabel>
          <h2 className="mt-2 text-lg font-semibold text-[#0a0a0a]">Verified releases</h2>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Verified payouts are linked to completed escrow records.
          </p>
        </div>

        <div className="border-y border-[#e8e8e8]">
          {payouts.length === 0 ? (
            <p className="bg-[#fafafa] px-1 py-10 text-center text-sm text-[#5f5f5f] sm:px-4">
              No completed payouts yet. Completed payment releases will appear here.
            </p>
          ) : (
            payouts.map((payout) => <RecentPayoutItem key={payout.escrowId} payout={payout} />)
          )}
        </div>
      </section>
    </motion.div>
  );
}
