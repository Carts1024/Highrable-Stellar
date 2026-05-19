"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { getWorkTypeLabel } from "@/features/profile/lib/profile-format";
import { Badge } from "@repo/ui/components/ui/badge";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

import type { TFreelancerRecentContract } from "@/features/profile/types";

export function RecentContractsSection({
  contracts,
}: {
  readonly contracts: readonly TFreelancerRecentContract[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Work history</h2>
      {contracts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#e8e8e8] bg-white p-5 text-sm text-[#5f5f5f]">
          No active or completed escrow-backed contracts yet.
        </p>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <article
              key={contract.escrowId}
              className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-[#e8e8e8] bg-[#fafafa]">
                      {getWorkTypeLabel(contract.workType)}
                    </Badge>
                    <StatusBadge label={contract.status} />
                  </div>
                  <div>
                    <Link
                      href={`/marketplace/jobs/${contract.jobId}`}
                      className="font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
                    >
                      {contract.jobTitle}
                    </Link>
                    {contract.milestoneTitle ? (
                      <p className="mt-1 text-sm text-[#5f5f5f]">
                        Milestone: {contract.milestoneTitle}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#5f5f5f]">
                    Client{" "}
                    <Link
                      href={`/clients/${encodeURIComponent(contract.clientWallet)}`}
                      className="font-medium text-[#FF7003] hover:text-[#E85D00]"
                    >
                      {shortenWalletAddress(contract.clientWallet)}
                    </Link>
                  </p>
                </div>

                <div className="space-y-2 text-left md:text-right">
                  <p className="font-semibold text-[#0a0a0a]">
                    {formatAmount(contract.amount)} {formatAsset(contract.asset)}
                  </p>
                  {contract.releaseTxHash ? (
                    <Link
                      href={getTxExplorerUrl(contract.releaseTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
                    >
                      Release tx <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  <Link
                    href={`/proof/${encodeURIComponent(contract.escrowId)}`}
                    className="block text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
                  >
                    View proof
                  </Link>
                  <p className="text-xs text-[#7f7f7f]">
                    Updated {new Date(contract.updatedAt).toLocaleString()}
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
