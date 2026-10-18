"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
import { Scale } from "lucide-react";
import Link from "next/link";
import React from "react";

import { formatDisputeDate, getDisputeReasonLabel } from "../lib";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "./dispute-status-badge";

export function DisputeList() {
  const walletIdentity = useHighrableWalletIdentity();
  const disputes = useQuery(
    api.disputes.getDisputesForWallet,
    walletIdentity.walletAddress ? { walletAddress: walletIdentity.walletAddress } : "skip",
  );
  const visibleDisputes = disputes?.filter(
    (dispute) =>
      dispute.clientWallet.toUpperCase() === walletIdentity.walletAddress?.toUpperCase() ||
      dispute.freelancerWallet.toUpperCase() === walletIdentity.walletAddress?.toUpperCase(),
  );

  if (!walletIdentity.walletAddress) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm text-[#5f5f5f]">
        Connect your wallet to view disputes.
      </p>
    );
  }

  if (visibleDisputes === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm" role="status">
        Loading disputes...
      </p>
    );
  }

  if (visibleDisputes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
        No disputes found for this wallet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visibleDisputes.map((dispute) => {
        const isClient =
          dispute.clientWallet.toUpperCase() === walletIdentity.walletAddress?.toUpperCase();

        return (
          <article key={dispute._id} className="overflow-hidden rounded-xl border bg-card">
            <div className="hr-card-head-soft flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[var(--mode-text)]">
                  <Scale className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="font-mono text-xs font-semibold tracking-[0.06em] text-[#3f3f3f] uppercase">
                  {dispute.disputeNumber}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DisputeStatusBadge status={dispute.status} />
                <DisputeOnChainStatusBadge
                  status={dispute.onChainStatus}
                  transactionHash={dispute.transactionHash}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 p-5">
              <div className="min-w-0">
                <h2 className="hr-text-primary text-lg font-bold">{dispute.title}</h2>
                <p className="mt-1 text-sm text-[#5f5f5f]">
                  {getDisputeReasonLabel(dispute.reasonCategory)} ·{" "}
                  {formatDisputeDate(dispute.openedAt)}
                </p>
                <p
                  className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    isClient
                      ? "border-yellow-300 bg-yellow-100 text-yellow-900"
                      : "border-orange-300 bg-orange-100 text-orange-900"
                  }`}
                >
                  {`Your role: ${isClient ? "Client" : "Freelancer"}`}
                </p>
              </div>
              <AppButton asChild variant="secondary" size="sm">
                <Link href={`/disputes/${dispute._id}`}>View Dispute</Link>
              </AppButton>
            </div>
          </article>
        );
      })}
    </div>
  );
}
