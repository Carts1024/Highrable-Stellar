"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import Link from "next/link";

interface ILandingConnectButtonProps {
  readonly className: string;
}

/** The single landing-page action: Connect Wallet, or a dashboard link once connected. */
export function LandingConnectButton({ className }: ILandingConnectButtonProps) {
  const walletIdentity = useHighrableWalletIdentity();

  if (walletIdentity.isConnected) {
    return (
      <Link href="/dashboard" className={className}>
        Open Dashboard
      </Link>
    );
  }

  return <WalletConnectTrigger className={className} />;
}
