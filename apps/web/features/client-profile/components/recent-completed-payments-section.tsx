"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import type { TClientEscrowActivity } from "@/features/client-profile/types";

export function RecentCompletedPaymentsSection({
  payments,
}: {
  readonly payments: readonly TClientEscrowActivity[];
}) {
  return (
    <section className="border border-[#e8e8e8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e8e8] p-5 sm:p-6">
        <div>
          <SectionLabel>Completed Payments</SectionLabel>
          <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">Recent released escrows</h2>
        </div>
        <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
          {payments.length} record{payments.length === 1 ? "" : "s"}
        </p>
      </div>
      {payments.length === 0 ? (
        <p className="p-5 text-sm text-[#5f5f5f] sm:p-6">No completed escrow payments yet.</p>
      ) : (
        <div className="divide-y divide-[#e8e8e8]">
          {payments.map((payment) => (
            <article key={payment.escrowId} className="p-5 transition-colors hover:bg-[#fafafa]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-white text-emerald-800"
                    >
                      {getClientWorkTypeLabel(payment.milestoneId ? "milestone" : "micro_gig")}
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Paid through Stellar escrow
                    </Badge>
                  </div>
                  <div>
                    <Link
                      href={`/marketplace/jobs/${payment.jobId}`}
                      className="font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
                    >
                      {payment.jobTitle}
                    </Link>
                    {payment.milestoneTitle ? (
                      <p className="mt-1 text-sm text-[#5f5f5f]">
                        Milestone: {payment.milestoneTitle}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#5f5f5f]">
                    Freelancer{" "}
                    {payment.freelancerWallet ? (
                      <Link
                        href={`/freelancers/${encodeURIComponent(payment.freelancerWallet)}`}
                        className="font-medium text-[#FF7003] hover:text-[#E85D00]"
                      >
                        {shortenWalletAddress(payment.freelancerWallet)}
                      </Link>
                    ) : (
                      "not recorded"
                    )}
                  </p>
                </div>

                <div className="min-w-44 space-y-2 text-left md:text-right">
                  <p className="font-semibold text-[#0a0a0a]">
                    {formatAmount(payment.amount)} {formatAsset(payment.asset)}
                  </p>
                  {payment.releaseTxHash ? (
                    <Link
                      href={getTxExplorerUrl(payment.releaseTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
                    >
                      Release tx <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  <Link
                    href={`/proof/${encodeURIComponent(payment.escrowId)}`}
                    className="block text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
                  >
                    View proof
                  </Link>
                  <p className="text-xs text-[#7f7f7f]">
                    Updated {formatShortDate(payment.updatedAt)}
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
