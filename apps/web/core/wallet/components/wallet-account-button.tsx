"use client";

import { WalletStatusDialog } from "@/core/wallet/components/wallet-status-dialog";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { useEffect, useState } from "react";

export function WalletAccountButton({ className }: { className?: string }) {
  const { walletState } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();
  const [isWalletStatusDialogOpen, setIsWalletStatusDialogOpen] = useState(false);

  useEffect(() => {
    if (!walletIdentity.isConnected) {
      setIsWalletStatusDialogOpen(false);
    }
  }, [walletIdentity.isConnected]);

  if (!walletIdentity.isConnected || !walletIdentity.displayAddress) {
    return null;
  }

  const toneClassName =
    walletIdentity.walletType === "passkey_smart_account"
      ? "border-blue-300 bg-blue-50 text-blue-700"
      : !walletState.isTestnet
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
        <span>{walletIdentity.displayAddress}</span>
      </button>
      <WalletStatusDialog
        isOpen={isWalletStatusDialogOpen}
        onOpenChange={setIsWalletStatusDialogOpen}
      />
    </>
  );
}
