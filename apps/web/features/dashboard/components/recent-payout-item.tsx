"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { CheckCircle, ExternalLink, Star, Wallet } from "lucide-react";

import type { TRecentPayout } from "@/features/dashboard/types";

type IRecentPayoutItemProps = {
  payout: TRecentPayout;
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="h-3.5 w-3.5"
          fill={i < rating ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">{rating}/5</span>
    </span>
  );
}

export function RecentPayoutItem({ payout }: IRecentPayoutItemProps) {
  const { jobTitle, amount, asset, clientWallet, releaseTxHash, rating, reviewText } = payout;

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-gray-900">{jobTitle ?? "Untitled Job"}</p>

        <p className="text-sm font-semibold text-emerald-600">
          {formatAmount(amount)} {formatAsset(asset)}
        </p>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span>Client: {shortenWalletAddress(clientWallet)}</span>
        </div>

        {rating !== undefined && <RatingStars rating={rating} />}

        {reviewText && <p className="line-clamp-2 text-xs text-gray-500 italic">"{reviewText}"</p>}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5" />
          Paid
        </span>

        {releaseTxHash ? (
          <a
            href={getTxExplorerUrl(releaseTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#FF7003] transition-colors hover:text-[#E85D00]"
          >
            View transaction
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-xs text-gray-400">No transaction hash stored</span>
        )}
      </div>
    </div>
  );
}
