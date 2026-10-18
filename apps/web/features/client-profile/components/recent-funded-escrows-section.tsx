"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import type { TClientEscrowActivity } from "@/features/client-profile/types";

export function RecentFundedEscrowsSection({
  escrows,
}: {
  readonly escrows: readonly TClientEscrowActivity[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--mode-border)] bg-white shadow-sm">
      <div className="hr-card-head flex flex-wrap items-center justify-between gap-3 p-5 sm:px-6">
        <div>
          <SectionLabel>Funded Payment Holds</SectionLabel>
          <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">Recent Funding Activity</h2>
        </div>
        <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
          {escrows.length} record{escrows.length === 1 ? "" : "s"}
        </p>
      </div>
      {escrows.length === 0 ? (
        <p className="p-5 text-sm text-[#5f5f5f] sm:p-6">
          This client has no funded payment hold history yet.
        </p>
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          {escrows.map((escrow) => (
            <article
              key={escrow.escrowId}
              className="rounded-xl border border-[var(--mode-border)] bg-white p-5 shadow-sm transition-colors hover:bg-[#fafafa]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-[#e8e8e8] bg-[#fafafa]">
                      {getClientWorkTypeLabel(escrow.milestoneId ? "milestone" : "micro_gig")}
                    </Badge>
                    <StatusBadge label={escrow.status} />
                  </div>
                  <div>
                    <Link
                      href={`/marketplace/jobs/${escrow.jobId}`}
                      className="font-semibold text-[#0a0a0a] hover:text-highrable-orange-3"
                    >
                      {escrow.jobTitle}
                    </Link>
                    {escrow.milestoneTitle ? (
                      <p className="mt-1 text-sm text-[#5f5f5f]">
                        Milestone: {escrow.milestoneTitle}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#5f5f5f]">
                    Freelancer{" "}
                    {escrow.freelancerWallet ? (
                      <Link
                        href={`/freelancers/${encodeURIComponent(escrow.freelancerWallet)}`}
                        className="hr-mode-text font-medium hover:text-highrable-orange-4"
                      >
                        {shortenWalletAddress(escrow.freelancerWallet)}
                      </Link>
                    ) : (
                      "not assigned"
                    )}
                  </p>
                </div>

                <div className="min-w-44 space-y-2 text-left md:text-right">
                  <p className="font-semibold text-[#0a0a0a]">
                    {formatAmount(escrow.amount)} {formatAsset(escrow.asset)}
                  </p>
                  {escrow.fundTxHash ? (
                    <Link
                      href={getTxExplorerUrl(escrow.fundTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hr-mode-text inline-flex items-center gap-1 text-sm font-medium hover:text-highrable-orange-4"
                    >
                      Fund tx <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  <p className="text-xs text-[#7f7f7f]">
                    Updated {formatShortDate(escrow.updatedAt)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
