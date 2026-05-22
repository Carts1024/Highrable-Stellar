"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { api } from "@repo/convex-client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";

interface IWalletTransferActivityProps {
  readonly walletAddress: string;
}

type TWalletTransferActivityItem = {
  readonly _id: string;
  readonly status: "pending" | "success" | "failed";
  readonly txHash?: string;
  readonly recipientAddress?: string;
  readonly recipientType?: "classic_account" | "contract_account";
  readonly asset?: "XLM" | "USDC";
  readonly amount?: string;
  readonly errorMessage?: string;
  readonly createdAt: number;
};

function formatRecipientType(recipientType: TWalletTransferActivityItem["recipientType"]): string {
  return recipientType === "contract_account" ? "Passkey Smart Account" : "External Wallet";
}

function formatTimestamp(value: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function shortenAddress(address: string | undefined): string {
  if (!address) {
    return "Unknown recipient";
  }

  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function getStatusBadgeVariant(status: TWalletTransferActivityItem["status"]) {
  return status === "success" ? "default" : status === "failed" ? "destructive" : "secondary";
}

export function WalletTransferActivity({ walletAddress }: IWalletTransferActivityProps) {
  const transfers = useQuery(api.transactions.listWalletTransfersByWallet, { walletAddress }) as
    | readonly TWalletTransferActivityItem[]
    | undefined;

  return (
    <section className="border border-[#d8d8d8] bg-white">
      <div className="flex items-center justify-between border-b border-[#e8e8e8] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">Recent transfers</h3>
          <p className="text-xs text-[#6f6f6f]">Passkey wallet transfer activity</p>
        </div>
      </div>
      <div className="divide-y divide-[#ececec]">
        {transfers === undefined ? (
          <p className="px-4 py-4 text-sm text-[#6f6f6f]">Loading transfer activity...</p>
        ) : transfers.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[#6f6f6f]">No passkey transfers yet.</p>
        ) : (
          transfers.map((transfer) => (
            <article key={transfer._id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-1.5 w-1.5 bg-[#f97316]" aria-hidden="true" />
                  <p className="font-mono text-xs font-semibold text-[#0a0a0a]">
                    {transfer.amount ?? "0"} {transfer.asset ?? "USDC"}
                  </p>
                  <Badge variant={getStatusBadgeVariant(transfer.status)}>{transfer.status}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-[#555]">
                  To {shortenAddress(transfer.recipientAddress)} /{" "}
                  {formatRecipientType(transfer.recipientType)}
                </p>
                {transfer.errorMessage ? (
                  <p className="mt-1 text-xs text-red-700">{transfer.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="font-mono text-[11px] text-[#777]">
                  {formatTimestamp(transfer.createdAt)}
                </span>
                {transfer.txHash ? (
                  <Button asChild type="button" variant="outline" size="icon" className="h-8 w-8">
                    <a
                      href={getTxExplorerUrl(transfer.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open transfer on Stellar explorer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
