"use client";

import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { HighrableV2Metric } from "@repo/ui/components/highrable/v2-marketing";
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
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <p className="text-sm text-muted-foreground">Loading client trust signals...</p>
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
    <section className="space-y-3 rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Client Trust
          </p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-highrable-orange-2" />
            <h2 className="hr-text-primary mt-0.5 font-sans text-lg font-semibold">
              {shortenWalletAddress(clientWallet)}
            </h2>
          </div>
        </div>
      </div>

      {/* Trust Metrics */}
      <div className={`grid gap-5 ${compact ? "grid-cols-2" : "sm:grid-cols-3"}`}>
        <HighrableV2Metric label="Posted" value={trustStats.jobsPosted} />
        <HighrableV2Metric label="Funded" value={trustStats.fundedJobs} />
        <HighrableV2Metric label="Disputed" value={trustStats.disputedJobs} />
      </div>

      {/* Trust Signals Button and Dialog */}
      <ResponsiveDialog>
        <div className="mt-4 flex justify-end">
          <ResponsiveDialogTrigger asChild>
            <AppButton type="button" variant="primary" className="text-xs">
              View Trust Signals
            </AppButton>
          </ResponsiveDialogTrigger>
        </div>

        <ResponsiveDialogContent className="max-w-3xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Client Trust Signals</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Escrow activity for {shortenWalletAddress(clientWallet)}.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <div className="grid gap-5 sm:grid-cols-2">
              <HighrableV2Metric label="Wallet" value={shortenWalletAddress(clientWallet)} />
              <HighrableV2Metric label="Jobs posted" value={trustStats.jobsPosted} />
              <HighrableV2Metric label="Jobs funded" value={trustStats.fundedJobs} />
              <HighrableV2Metric label="Jobs completed" value={trustStats.completedJobs} />
              <HighrableV2Metric label="Jobs disputed" value={trustStats.disputedJobs} />
              <HighrableV2Metric label="Total escrow funded" value={fundedAssets} />
            </div>

            <div className="mt-6 flex justify-end">
              <AppButton asChild variant="primary">
                <Link href={`/clients/${encodeURIComponent(clientWallet)}`}>
                  View Client Profile
                </Link>
              </AppButton>
            </div>
          </ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </section>
  );
}
