"use client";

import { ExternalWalletDetailsCardContainer } from "@/core/wallet/components/external-wallet-details-card";
import { PasskeySmartAccountCard } from "@/core/wallet/components/passkey-smart-account-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";

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
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[min(90vh,48rem)] max-w-4xl overflow-hidden border border-[#e8e8e8] bg-white p-0 shadow-(--highrable-shadow-hard) sm:max-w-4xl">
        <DialogHeader className="border-b border-[#e8e8e8] px-5 py-4 sm:px-6">
          <DialogTitle>Wallet details</DialogTitle>
          <DialogDescription>
            Review your connected Stellar wallet state and available wallet actions.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(90vh,42rem)] overflow-y-auto overscroll-contain p-5 sm:p-6">
          {!showPasskeyWalletDetails && hasExternalWalletConnection ? (
            <ExternalWalletDetailsCardContainer />
          ) : (
            <PasskeySmartAccountCard />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
