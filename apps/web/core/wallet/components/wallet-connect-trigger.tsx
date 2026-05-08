"use client";

import { usePasskeySmartAccount } from "@/core/wallet/hooks/use-passkey-smart-account";
import { useWallet } from "@/core/wallet/hooks/use-wallet";

export function WalletConnectTrigger({
  className,
  icon,
  label = "Connect Wallet",
}: {
  className?: string;
  icon?: React.ReactNode;
  label?: string;
}) {
  const { connectWallet, walletState } = useWallet();
  const { disconnectPasskeyAccount, isPasskeyConnected } = usePasskeySmartAccount();

  const handleConnectWallet = async () => {
    if (isPasskeyConnected) {
      await disconnectPasskeyAccount();
    }

    await connectWallet();
  };

  return (
    <button
      type="button"
      onClick={() => void handleConnectWallet()}
      disabled={walletState.isConnecting}
      className={className}
    >
      {icon}
      {walletState.isConnecting ? "Connecting wallet..." : label}
    </button>
  );
}
