"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";

export function WalletConnectTrigger({
  className,
  label = "Connect Stellar Wallet",
}: {
  className?: string;
  label?: string;
}) {
  const { connectWallet, walletState } = useWallet();

  return (
    <button
      type="button"
      onClick={() => void connectWallet()}
      disabled={walletState.isConnecting}
      className={className}
    >
      {walletState.isConnecting ? "Connecting wallet..." : label}
    </button>
  );
}
