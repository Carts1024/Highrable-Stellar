"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { HighrableV2Metric } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

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
    return (
      <p className="text-sm text-muted-foreground">Loading client trust signals...</p>
    );
  }

  const fundedAssets =
    trustStats.totalEscrowFundedByAsset.length > 0
      ? trustStats.totalEscrowFundedByAsset
          .map((row) => `${formatAmount(row.amount)} ${formatAssetLabel(row.asset)}`)
          .join(", ")
      : "None yet";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-highrable-orange-2" />
          <h2 className="hr-text-primary font-sans text-lg font-semibold">
            {shortenWalletAddress(clientWallet)}
          </h2>
        </div>
        <AppButton
          asChild
          variant="outline"
          className="border-border text-xs text-foreground hover:text-foreground"
        >
          <Link href={`/clients/${encodeURIComponent(clientWallet)}`}>View Client Profile</Link>
        </AppButton>
      </div>

      <div className={`grid gap-4 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        <HighrableV2Metric label="Jobs posted" value={trustStats.jobsPosted} />
        <HighrableV2Metric label="Jobs funded" value={trustStats.fundedJobs} />
        <HighrableV2Metric label="Jobs completed" value={trustStats.completedJobs} />
        <HighrableV2Metric label="Jobs disputed" value={trustStats.disputedJobs} />
        <HighrableV2Metric label="Total payment hold funded" value={fundedAssets} />
      </div>
    </div>
  );
}
