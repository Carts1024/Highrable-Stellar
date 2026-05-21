"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";

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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#FF7003]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#FF7003] uppercase">
              {walletState.selectedWallet ?? "Stellar Wallet"}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {walletState.network ?? "Unknown network"}
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-500">Connected address</p>
            <p className="font-mono text-sm break-all text-gray-900">{walletState.walletAddress}</p>
          </div>
        </div>

        <div className="space-y-3 lg:min-w-60">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshWalletState()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void checkFundingStatus()}
              disabled={!walletState.isTestnet || walletState.isCheckingFunding}
              className="rounded-lg border border-[#FF7003]/25 px-4 py-2 text-sm font-medium text-[#FF7003] transition-colors hover:bg-[#FF7003]/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Check funding
            </button>
            <button
              type="button"
              onClick={() => void disconnectWallet()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Disconnect
            </button>
          </div>

          {walletState.isTestnet && walletState.isFunded === false ? (
            <button
              type="button"
              onClick={() => void fundTestnetAccount()}
              disabled={walletState.isFundingWithFriendbot}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {walletState.isFundingWithFriendbot ? "Funding..." : "Fund Testnet Account"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
