"use client";

import { ExternalWalletDetailsCardContainer } from "@/core/wallet/components/external-wallet-details-card";
import { PasskeySmartAccountCard } from "@/core/wallet/components/passkey-smart-account-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/components/ui-customs/responsive-dialog";

import type { ReactElement } from "react";

interface IWalletStatusDialogProps {
  readonly trigger: ReactElement;
}

export function WalletStatusDialog({ trigger }: IWalletStatusDialogProps) {
  const { walletState } = useWallet();
  const { activeWalletMode } = usePasskeySmartAccount();
  const hasExternalWalletConnection = walletState.isConnected && Boolean(walletState.walletAddress);
  const showPasskeyWalletDetails =
    activeWalletMode === "passkey_smart_account" || !hasExternalWalletConnection;

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>{trigger}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Wallet details</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Review your connected Stellar wallet state and available wallet actions.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {!showPasskeyWalletDetails && hasExternalWalletConnection ? (
            <ExternalWalletDetailsCardContainer />
          ) : (
            <PasskeySmartAccountCard />
          )}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
