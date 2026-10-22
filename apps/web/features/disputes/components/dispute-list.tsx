"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
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
    return <p className="hr-text-secondary text-sm">Connect your wallet to view disputes.</p>;
  }

  if (visibleDisputes === undefined) {
    return (
      <p className="hr-text-secondary text-sm" role="status">
        Loading disputes...
      </p>
    );
  }

  if (visibleDisputes.length === 0) {
    return (
      <p className="hr-text-secondary rounded-lg border border-dashed px-4 py-5 text-sm">
        No disputes found for this wallet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {visibleDisputes.map((dispute) => {
        const isClient =
          dispute.clientWallet.toUpperCase() === walletIdentity.walletAddress?.toUpperCase();

        return (
          <li
            key={dispute._id}
            className="hr-clickable-card grid gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-4 transition-colors hover:border-(--mode-border) hover:bg-muted/30 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="hr-text-muted font-mono text-xs">{dispute.disputeNumber}</span>
                <Link
                  href={`/disputes/${dispute._id}`}
                  className="hr-card-link hr-text-primary text-base font-medium"
                >
                  {dispute.title}
                </Link>
              </div>
              <p className="hr-text-secondary text-xs">
                {getDisputeReasonLabel(dispute.reasonCategory)} · Opened{" "}
                {formatDisputeDate(dispute.openedAt)} ·{" "}
                <span>{`Your role: ${isClient ? "Client" : "Freelancer"}`}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:justify-end">
              <DisputeStatusBadge status={dispute.status} />
              <DisputeOnChainStatusBadge
                status={dispute.onChainStatus}
                transactionHash={dispute.transactionHash}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
