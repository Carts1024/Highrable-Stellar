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
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
            Recent Transfers
          </p>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Passkey wallet transfer activity
          </p>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {transfers === undefined ? (
          <div className="flex items-center gap-2 px-5 py-4 font-sans text-sm text-muted-foreground">
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-highrable-orange-2/60"
              aria-hidden="true"
            />
            Loading transfer activity...
          </div>
        ) : transfers.length === 0 ? (
          <p className="px-5 py-4 font-sans text-sm text-muted-foreground">
            No passkey transfers yet.
          </p>
        ) : (
          transfers.map((transfer) => (
            <article
              key={transfer._id}
              className="grid gap-3 px-5 py-4 transition-colors hover:bg-gray-100/60 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-highrable-orange-2"
                    aria-hidden="true"
                  />
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {transfer.amount ?? "0"} {transfer.asset ?? "USDC"}
                  </p>
                  <Badge variant={getStatusBadgeVariant(transfer.status)}>{transfer.status}</Badge>
                </div>
                <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">
                  To {shortenAddress(transfer.recipientAddress)} /{" "}
                  {formatRecipientType(transfer.recipientType)}
                </p>
                {transfer.errorMessage ? (
                  <p className="mt-1 text-xs font-medium text-red-600">{transfer.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="font-mono text-xs text-muted-foreground/70">
                  {formatTimestamp(transfer.createdAt)}
                </span>
                {transfer.txHash ? (
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                  >
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
