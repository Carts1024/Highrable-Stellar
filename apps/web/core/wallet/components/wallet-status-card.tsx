"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Check, Copy, Coins, LogOut, MoreVertical, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";

/** Splits the address into groups of four so it reads like a card number. */
function formatAddressGroups(address: string): string {
  return address.replace(/(.{4})/g, "$1 ").trim();
}

export function WalletStatusCard() {
  const {
    walletState,
    disconnectWallet,
    refreshWalletState,
    checkFundingStatus,
    fundTestnetAccount,
  } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!walletState.isConnected) {
    return null;
  }

  const address = walletState.walletAddress ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="w-full">
      {/* The wallet, drawn as a card */}
      <div
        className="relative h-full w-full overflow-hidden rounded-2xl p-5 shadow-lg sm:p-6"
        style={{
          backgroundImage: "var(--mode-gradient)",
          color: "var(--mode-on, #fff)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-12 h-48 w-48 rounded-full bg-white/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -bottom-20 h-48 w-48 rounded-full bg-black/10"
        />

        <div className="relative flex min-h-44 flex-col justify-between gap-6 sm:min-h-52">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5" aria-hidden="true" />
              <h2 className="font-sans text-sm font-bold">Your Connected Wallet</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-black/15 px-3 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
                {walletState.network ?? "Unknown network"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Wallet options"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/15 transition-colors hover:bg-black/25"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem onSelect={() => void refreshWalletState()}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!walletState.isTestnet || walletState.isCheckingFunding}
                    onSelect={() => void checkFundingStatus()}
                  >
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    Check Funding
                  </DropdownMenuItem>
                  {walletState.isTestnet && walletState.isFunded === false ? (
                    <DropdownMenuItem
                      disabled={walletState.isFundingWithFriendbot}
                      onSelect={() => void fundTestnetAccount()}
                    >
                      <Coins className="h-4 w-4" aria-hidden="true" />
                      {walletState.isFundingWithFriendbot ? "Funding..." : "Fund Testnet Account"}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => void disconnectWallet()}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="block h-7 w-10 rounded-md border border-black/15 bg-white/45"
            />
            <span className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-80">
              Stellar
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <p className="font-mono text-sm leading-relaxed tracking-wider break-all select-all sm:text-base">
                {formatAddressGroups(address)}
              </p>
              <button
                type="button"
                onClick={() => void handleCopy()}
                aria-label={copied ? "Address copied" : "Copy wallet address"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/15 transition-colors hover:bg-black/25"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-80">
                {walletState.selectedWallet ?? "Stellar Wallet"}
              </p>
              {walletState.isTestnet && walletState.isFunded === false ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-amber-800 uppercase">
                  Unfunded · open menu to fund
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
