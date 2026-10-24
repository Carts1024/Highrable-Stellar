"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { WorkListRow, WorkMeta } from "@/features/common/components/work-list";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Star } from "lucide-react";
import Link from "next/link";
import React from "react";

import type { TRecentPayout } from "@/features/dashboard/types";

type IRecentPayoutItemProps = {
  payout: TRecentPayout;
};

export function RecentPayoutItem({ payout }: IRecentPayoutItemProps) {
  const {
    escrowId,
    jobId,
    jobTitle,
    milestoneTitle,
    amount,
    asset,
    clientWallet,
    releaseTxHash,
    rating,
    reviewText,
    releasedAt,
  } = payout;

  return (
    <WorkListRow
      href={`/marketplace/jobs/${jobId}`}
      title={jobTitle ?? "Untitled job"}
      subtitle={milestoneTitle ? `Milestone: ${milestoneTitle}` : undefined}
      amount={`${formatAmount(amount)} ${formatAsset(asset)}`}
      amountLabel="Paid"
      meta={
        <>
          {releasedAt ? (
            <WorkMeta label="Released">{new Date(releasedAt).toLocaleDateString()}</WorkMeta>
          ) : null}
          <WorkMeta label="Client">
            <Link
              href={`/clients/${encodeURIComponent(clientWallet)}`}
              className="font-mono hover:underline"
            >
              {shortenWalletAddress(clientWallet)}
            </Link>
          </WorkMeta>
          {rating !== undefined ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="hr-text-primary">{rating}/5</span>
            </span>
          ) : (
            <span className="hr-text-muted">Not rated</span>
          )}
        </>
      }
    >
      {reviewText ? (
        <p className="hr-text-secondary mt-2 line-clamp-2 text-sm leading-relaxed">
          “{reviewText}”
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link
          href={`/proof/${encodeURIComponent(escrowId)}`}
          className="hr-mode-text hover:underline"
        >
          Payment proof
        </Link>
        {releaseTxHash ? (
          <a
            href={getTxExplorerUrl(releaseTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="hr-text-secondary hover:underline"
          >
            Transaction on Stellar
          </a>
        ) : (
          <span className="hr-text-muted">Transaction hash not stored</span>
        )}
      </div>
    </WorkListRow>
  );
}
