"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";

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
      <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
        <p className="text-sm text-[#7f7f7f]">Loading client trust signals...</p>
      </section>
    );
  }

  const fundedAssets =
    trustStats.totalEscrowFundedByAsset.length > 0
      ? trustStats.totalEscrowFundedByAsset
          .map((row) => `${formatAmount(row.amount)} ${formatAssetLabel(row.asset)}`)
          .join(", ")
      : "None yet";

  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#FF7003]" />
        <h2 className="text-lg font-semibold text-[#0a0a0a]">Client Trust Signals</h2>
      </div>
      <p className="mt-1 text-xs text-[#5f5f5f]">
        Client trust signals are based on Highrable escrow activity.
      </p>

      <dl className={`mt-4 grid gap-3 text-sm ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
        <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="text-[#7f7f7f]">Wallet</dt>
          <dd className="font-semibold text-[#0a0a0a]">{shortenWalletAddress(clientWallet)}</dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="text-[#7f7f7f]">Jobs posted</dt>
          <dd className="font-semibold text-[#0a0a0a]">{trustStats.jobsPosted}</dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="text-[#7f7f7f]">Jobs funded</dt>
          <dd className="font-semibold text-[#0a0a0a]">{trustStats.fundedJobs}</dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="text-[#7f7f7f]">Jobs completed</dt>
          <dd className="font-semibold text-[#0a0a0a]">{trustStats.completedJobs}</dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="text-[#7f7f7f]">Jobs disputed</dt>
          <dd className="font-semibold text-[#0a0a0a]">{trustStats.disputedJobs}</dd>
        </div>
        <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="text-[#7f7f7f]">Total escrow funded</dt>
          <dd className="font-semibold text-[#0a0a0a]">{fundedAssets}</dd>
        </div>
      </dl>
    </section>
  );
}
