"use client";

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
      className="rounded-2xl border border-gray-100 bg-gray-50 p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-5 w-5 text-[#FF7003]" />
        <h2 className="text-xl font-semibold text-gray-900">Recent payouts</h2>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Verified payouts are linked to completed escrow records.
      </p>

      {payouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-10 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No completed payouts yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <RecentPayoutItem key={payout.escrowId} payout={payout} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
