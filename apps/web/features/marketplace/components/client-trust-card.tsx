"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import Link from "next/link";
import React from "react";

interface IClientTrustCardProps {
  readonly clientWallet: string;
  readonly compact?: boolean;
}

export function ClientTrustCard({ clientWallet, compact = false }: IClientTrustCardProps) {
  const trustStats = useQuery(
    api.escrows.getClientTrustStats,
    clientWallet.trim().length > 0 ? { clientWallet } : "skip",
  );

  if (trustStats === undefined) {
    return <p className="text-sm text-muted-foreground">Loading client history…</p>;
  }

  const fundedAssets =
    trustStats.totalEscrowFundedByAsset.length > 0
      ? trustStats.totalEscrowFundedByAsset
          .map((row) => `${formatAmount(row.amount)} ${formatAssetLabel(row.asset)}`)
          .join(", ")
      : "None yet";

  const rows: readonly (readonly [string, string | number])[] = [
    ["Jobs posted", trustStats.jobsPosted],
    ["Jobs funded", trustStats.fundedJobs],
    ["Jobs completed", trustStats.completedJobs],
    ["Jobs disputed", trustStats.disputedJobs],
    ["Total put on hold", fundedAssets],
  ];

  return (
    <div className="space-y-3">
      <dl
        className={
          compact
            ? "space-y-1.5 text-sm"
            : "grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="hr-text-secondary">{label}</dt>
            <dd className="hr-text-primary hr-num text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href={`/clients/${encodeURIComponent(clientWallet)}`}
        className="hr-mode-text inline-flex text-sm hover:underline"
      >
        View {shortenWalletAddress(clientWallet)}'s profile
      </Link>
    </div>
  );
}
