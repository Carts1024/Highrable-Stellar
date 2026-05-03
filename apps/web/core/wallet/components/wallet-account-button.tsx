"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";

export function WalletAccountButton({ className }: { className?: string }) {
  const { walletState } = useWallet();

  if (!walletState.isConnected || !walletState.account) {
    return null;
  }

  const toneClassName = !walletState.isTestnet
    ? "border-amber-300 bg-amber-50 text-amber-700"
    : walletState.isFunded
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "border-[#FF7003]/30 bg-[#FF7003]/10 text-[#FF7003]";

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm font-medium ${toneClassName} ${className ?? ""}`}
    >
      <span>{walletState.account.displayAddress}</span>
    </div>
  );
}
