"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/responsive-dialog";
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
      <section className="border border-[#e8e8e8] bg-white p-5">
        <div>
          <p className="text-sm text-[#7f7f7f]">Loading client trust signals...</p>
        </div>
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
    <section className="border border-[#e8e8e8] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <SectionLabel>Client Trust</SectionLabel>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#FF7003]" />
            <h2 className="text-lg font-semibold text-[#0a0a0a]">
              {shortenWalletAddress(clientWallet)}
            </h2>
          </div>
        </div>
        <div className={`grid gap-5 ${compact ? "grid-cols-2" : "sm:grid-cols-3"}`}>
          <HighrableV2Metric label="Posted" value={trustStats.jobsPosted} />
          <HighrableV2Metric label="Funded" value={trustStats.fundedJobs} />
          <HighrableV2Metric label="Disputed" value={trustStats.disputedJobs} />
        </div>
        <ResponsiveDialog>
          <ResponsiveDialogTrigger asChild>
            <AppButton type="button" variant="secondary" className="rounded-none">
              View trust signals
            </AppButton>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="rounded-none sm:max-w-2xl">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Client Trust Signals</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Escrow activity for {shortenWalletAddress(clientWallet)}.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody>
              <div className="grid gap-5 border-y border-[#e8e8e8] py-5 sm:grid-cols-2">
                <HighrableV2Metric label="Wallet" value={shortenWalletAddress(clientWallet)} />
                <HighrableV2Metric label="Jobs posted" value={trustStats.jobsPosted} />
                <HighrableV2Metric label="Jobs funded" value={trustStats.fundedJobs} />
                <HighrableV2Metric label="Jobs completed" value={trustStats.completedJobs} />
                <HighrableV2Metric label="Jobs disputed" value={trustStats.disputedJobs} />
                <HighrableV2Metric label="Total escrow funded" value={fundedAssets} />
              </div>
              <Link
                href={`/clients/${encodeURIComponent(clientWallet)}`}
                className="font-medium text-[#FF7003] hover:text-[#E85D00]"
              >
                View full client profile
              </Link>
            </ResponsiveDialogBody>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>
    </section>
  );
}
