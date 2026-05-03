"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";

export function WalletConnectTrigger({
  className,
  label = "Connect Wallet",
}: {
  className?: string;
  label?: string;
}) {
  const { connectWallet, walletState } = useWallet();

  return (
    <button
      type="button"
      onClick={() => void connectWallet()}
      disabled={walletState.status === "connecting"}
      className={className}
    >
      {walletState.status === "connecting" ? "Connecting..." : label}
    </button>
  );
}
