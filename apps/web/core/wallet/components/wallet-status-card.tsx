"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";

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
    <div className="w-full overflow-hidden rounded-2xl border border-border p-6 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: identity info */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-lg border-transparent bg-highrable-orange-2/20 px-3 py-1 font-mono text-xs font-semibold tracking-wider text-highrable-orange-4 uppercase">
              {walletState.selectedWallet ?? "Stellar Wallet"}
            </Badge>
            <Badge variant="outline" className="rounded-lg px-3 py-1 font-mono text-xs">
              {walletState.network ?? "Unknown network"}
            </Badge>
          </div>

          <div>
            <p className="font-mono text-xs font-semibold tracking-wider text-gray-600 uppercase">
              Connected Address
            </p>
            <p className="mt-2 font-mono text-sm font-medium break-all text-foreground">
              {walletState.walletAddress}
            </p>
          </div>
        </div>

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
