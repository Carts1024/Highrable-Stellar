"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { WalletAddressTile } from "@/features/common";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Wallet } from "lucide-react";

export function WalletStatusCard() {
  const {
    walletState,
    disconnectWallet,
    refreshWalletState,
    checkFundingStatus,
    fundTestnetAccount,
  } = useWallet();

  if (!walletState.isConnected) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card">
      <div className="hr-card-head flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5" aria-hidden="true" />
          <h2 className="font-sans text-base font-bold">Your connected wallet</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full border-transparent bg-white px-3 py-0.5 font-mono text-xs font-semibold tracking-wider text-[var(--mode-text)] uppercase">
            {walletState.selectedWallet ?? "Stellar Wallet"}
          </Badge>
          <Badge className="rounded-full border-transparent bg-white/70 px-3 py-0.5 font-mono text-xs text-foreground">
            {walletState.network ?? "Unknown network"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: identity info */}
        <WalletAddressTile
          address={walletState.walletAddress ?? ""}
          label="Connected address"
          className="lg:max-w-2xl lg:flex-1"
        />

        {/* Right: actions */}
        <div className="space-y-3 lg:min-w-60">
          <div className="flex flex-wrap gap-2">
            <AppButton
              type="button"
              variant="outline"
              className="font-medium"
              onClick={() => void refreshWalletState()}
            >
              Refresh
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              className="border-highrable-orange-2/25 font-medium text-highrable-orange-4 hover:bg-highrable-orange-2/5 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void checkFundingStatus()}
              disabled={!walletState.isTestnet || walletState.isCheckingFunding}
            >
              Check Funding
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              className="font-medium"
              onClick={() => void disconnectWallet()}
            >
              Disconnect
            </AppButton>
          </div>

          {walletState.isTestnet && walletState.isFunded === false ? (
            <AppButton
              type="button"
              variant="outline"
              className="w-full border-amber-300 font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => void fundTestnetAccount()}
              disabled={walletState.isFundingWithFriendbot}
            >
              {walletState.isFundingWithFriendbot ? "Funding..." : "Fund Testnet Account"}
            </AppButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
