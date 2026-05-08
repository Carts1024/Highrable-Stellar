"use client";

import { usePasskeySmartAccount } from "@/core/wallet/hooks/use-passkey-smart-account";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { useMemo } from "react";

import type { THighrableWalletType } from "@/core/wallet/context/passkey-smart-account-context";

export type THighrableWalletIdentity = {
  walletAddress: string | null;
  walletType: THighrableWalletType | null;
  isConnected: boolean;
  isFunded: boolean | null;
  isTestnet: boolean;
  displayAddress: string | null;
};

export function useHighrableWalletIdentity(): THighrableWalletIdentity {
  const externalWallet = useWallet();
  const passkeySmartAccount = usePasskeySmartAccount();

  return useMemo(() => {
    if (passkeySmartAccount.isPasskeyConnected && passkeySmartAccount.smartAccountAddress) {
      return {
        walletAddress: passkeySmartAccount.smartAccountAddress,
        walletType: "passkey_smart_account",
        isConnected: true,
        isFunded: null,
        isTestnet: true,
        displayAddress: shortenWalletAddress(passkeySmartAccount.smartAccountAddress),
      };
    }

    if (externalWallet.isConnected && externalWallet.address) {
      return {
        walletAddress: externalWallet.address,
        walletType: "external_wallet",
        isConnected: true,
        isFunded: externalWallet.walletState.isFunded,
        isTestnet: externalWallet.walletState.isTestnet,
        displayAddress: shortenWalletAddress(externalWallet.address),
      };
    }

    return {
      walletAddress: null,
      walletType: null,
      isConnected: false,
      isFunded: null,
      isTestnet: true,
      displayAddress: null,
    };
  }, [
    externalWallet.address,
    externalWallet.isConnected,
    externalWallet.walletState.isFunded,
    externalWallet.walletState.isTestnet,
    passkeySmartAccount.isPasskeyConnected,
    passkeySmartAccount.smartAccountAddress,
  ]);
}
