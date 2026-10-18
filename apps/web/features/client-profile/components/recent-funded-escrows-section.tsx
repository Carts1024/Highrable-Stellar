"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { RouteEmptyState, WorkList, WorkListRow, WorkMeta } from "@/features/common";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import Link from "next/link";
import React from "react";

import type { TClientEscrowActivity } from "@/features/client-profile/types";

export function RecentFundedEscrowsSection({
  escrows,
}: {
  readonly escrows: readonly TClientEscrowActivity[];
}) {
  if (escrows.length === 0) {
    return <RouteEmptyState description="This client has no funded payment hold history yet." />;
  }

  return (
    <WorkList>
      {escrows.map((escrow) => (
        <WorkListRow
          key={escrow.escrowId}
          href={`/marketplace/jobs/${escrow.jobId}`}
          title={escrow.jobTitle}
          subtitle={escrow.milestoneTitle ? `Milestone: ${escrow.milestoneTitle}` : undefined}
          amount={`${formatAmount(escrow.amount)} ${formatAsset(escrow.asset)}`}
          amountLabel="On hold"
          status={<StatusBadge label={escrow.status} />}
          meta={
            <>
              <span>{getClientWorkTypeLabel(escrow.milestoneId ? "milestone" : "micro_gig")}</span>
              <WorkMeta label="Freelancer">
                {escrow.freelancerWallet ? (
                  <Link
                    href={`/freelancers/${encodeURIComponent(escrow.freelancerWallet)}`}
                    className="font-mono hover:underline"
                  >
                    {shortenWalletAddress(escrow.freelancerWallet)}
                  </Link>
                ) : (
                  "Not assigned"
                )}
              </WorkMeta>
              <WorkMeta label="Updated">{formatShortDate(escrow.updatedAt)}</WorkMeta>
              {escrow.fundTxHash ? (
                <a
                  href={getTxExplorerUrl(escrow.fundTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hr-mode-text hover:underline"
                >
                  Funding transaction
                </a>
              ) : null}
            </>
          }
        />
      ))}
    </WorkList>
  );
}
