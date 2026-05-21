"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
import Link from "next/link";

import type { TDisputeReasonCategory } from "../types";

import { formatDisputeDate, getDisputeReasonLabel } from "../lib";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "./dispute-status-badge";

export function DisputeList() {
  const walletIdentity = useHighrableWalletIdentity();
  const disputes = useQuery(
    api.disputes.getDisputesForWallet,
    walletIdentity.walletAddress ? { walletAddress: walletIdentity.walletAddress } : "skip",
  );

  if (!walletIdentity.walletAddress) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm text-[#5f5f5f]">
        Connect your wallet to view disputes.
      </p>
    );
  }

  if (disputes === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm">Loading disputes...</p>
    );
  }

  if (disputes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
        No disputes found for this wallet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map((dispute) => (
        <article key={dispute._id} className="rounded-lg border border-[#e8e8e8] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-[#5f5f5f] uppercase">{dispute.disputeNumber}</p>
              <h2 className="mt-1 text-lg font-semibold text-[#0a0a0a]">{dispute.title}</h2>
              <p className="mt-1 text-sm text-[#5f5f5f]">
                {getDisputeReasonLabel(dispute.reasonCategory as TDisputeReasonCategory)} ·{" "}
                {formatDisputeDate(dispute.openedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DisputeStatusBadge status={dispute.status} />
              <DisputeOnChainStatusBadge status={dispute.onChainStatus} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <AppButton asChild variant="secondary" size="sm">
              <Link href={`/disputes/${dispute._id}`}>View Dispute</Link>
            </AppButton>
          </div>
        </article>
      ))}
    </div>
  );
}
