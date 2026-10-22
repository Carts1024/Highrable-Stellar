"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { RouteEmptyState, WorkList, WorkListRow, WorkMeta } from "@/features/common";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import Link from "next/link";
import React from "react";

import type { TClientEscrowActivity } from "@/features/client-profile/types";

export function RecentCompletedPaymentsSection({
  payments,
}: {
  readonly payments: readonly TClientEscrowActivity[];
}) {
  if (payments.length === 0) {
    return <RouteEmptyState description="No payments from this client have been released yet." />;
  }

  return (
    <WorkList>
      {payments.map((payment) => (
        <WorkListRow
          key={payment.escrowId}
          href={`/marketplace/jobs/${payment.jobId}`}
          title={payment.jobTitle}
          subtitle={payment.milestoneTitle ? `Milestone: ${payment.milestoneTitle}` : undefined}
          amount={`${formatAmount(payment.amount)} ${formatAsset(payment.asset)}`}
          amountLabel="Paid"
          meta={
            <>
              <span>{getClientWorkTypeLabel(payment.milestoneId ? "milestone" : "micro_gig")}</span>
              <WorkMeta label="Freelancer">
                {payment.freelancerWallet ? (
                  <Link
                    href={`/freelancers/${encodeURIComponent(payment.freelancerWallet)}`}
                    className="font-mono hover:underline"
                  >
                    {shortenWalletAddress(payment.freelancerWallet)}
                  </Link>
                ) : (
                  "Not recorded"
                )}
              </WorkMeta>
              <WorkMeta label="Updated">{formatShortDate(payment.updatedAt)}</WorkMeta>
              <Link
                href={`/proof/${encodeURIComponent(payment.escrowId)}`}
                className="hr-mode-text hover:underline"
              >
                Payment proof
              </Link>
              {payment.releaseTxHash ? (
                <a
                  href={getTxExplorerUrl(payment.releaseTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Release transaction
                </a>
              ) : null}
            </>
          }
        />
      ))}
    </WorkList>
  );
}
