"use client";

import { WalletStatusDialog } from "@/core/wallet/components/wallet-status-dialog";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { useEffect, useState } from "react";

export function WalletAccountButton({ className }: { className?: string }) {
  const { walletState } = useWallet();
  const [isWalletStatusDialogOpen, setIsWalletStatusDialogOpen] = useState(false);

  useEffect(() => {
    if (!walletState.isConnected) {
      setIsWalletStatusDialogOpen(false);
    }
  }, [walletState.isConnected]);

  if (!walletState.isConnected || !walletState.account) {
    return null;
  }

  const toneClassName = !walletState.isTestnet
    ? "border-amber-300 bg-amber-50 text-amber-700"
    : walletState.isFunded
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "border-[#FF7003]/30 bg-[#FF7003]/10 text-[#FF7003]";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsWalletStatusDialogOpen(true)}
        className={`rounded-lg border px-3 py-2 text-sm font-medium ${toneClassName} ${className ?? ""}`}
      >
        <span>{walletState.account.displayAddress}</span>
      </button>
      <WalletStatusDialog
        isOpen={isWalletStatusDialogOpen}
        onOpenChange={setIsWalletStatusDialogOpen}
      />
    </>
  );
}
