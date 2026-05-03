"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";

export function WalletAccountButton({ className }: { className?: string }) {
  const { walletState, disconnectWallet, authenticateWallet, authSession } = useWallet();

  if (!walletState.account) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void authenticateWallet()}
        className="rounded-lg border border-[#FF7003]/30 px-3 py-2 text-sm font-medium text-[#FF7003] transition-colors hover:bg-[#FF7003]/10"
      >
        {authSession ? "Authenticated" : "Authenticate"}
      </button>
      <button type="button" onClick={() => void disconnectWallet()} className={className}>
        {walletState.account.displayAddress}
      </button>
    </div>
  );
}
