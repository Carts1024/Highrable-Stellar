"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import {
  formatShortDate,
  getClientWorkTypeLabel,
} from "@/features/client-profile/lib/client-profile-format";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
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
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Recent completed payments</h2>
      {payments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e8e8e8] bg-white p-5 text-sm text-[#5f5f5f]">
          No completed escrow payments yet.
        </p>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <article
              key={payment.escrowId}
              className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
            >
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

                <div className="space-y-2 text-left md:text-right">
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
