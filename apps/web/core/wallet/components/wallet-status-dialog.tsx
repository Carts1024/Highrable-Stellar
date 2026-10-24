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
  const { activeWalletMode, isEnabled } = usePasskeySmartAccount();
  const hasExternalWalletConnection = walletState.isConnected && Boolean(walletState.walletAddress);
  const showPasskeyWalletDetails =
    isEnabled && (activeWalletMode === "passkey_smart_account" || !hasExternalWalletConnection);

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>{trigger}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Wallet Details</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Review your connected Stellar wallet state and available wallet actions.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {!isEnabled && !hasExternalWalletConnection ? (
            <p className="text-sm text-muted-foreground">
              Passkey accounts are disabled. Connect an external wallet to use wallet features.
            </p>
          ) : !showPasskeyWalletDetails && hasExternalWalletConnection ? (
            <ExternalWalletDetailsCardContainer />
          ) : (
            <PasskeySmartAccountCard />
          )}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
