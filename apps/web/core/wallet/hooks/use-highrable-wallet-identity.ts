"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { useEffect, useMemo } from "react";

export type THighrableWalletIdentity = {
  walletAddress: string | null;
  walletType: "external_wallet" | "passkey_smart_account" | null;
  isConnected: boolean;
  canSignEscrowTransactions: boolean;
  displayAddress: string | null;
  source: "stellar_wallets_kit" | "passkey_smart_account" | null;
  activeWalletMode: "external_wallet" | "passkey_smart_account";
  setActiveWalletMode: (mode: "external_wallet" | "passkey_smart_account") => void;
};

export function useHighrableWalletIdentity(): THighrableWalletIdentity {
  const { address: externalWalletAddress, isConnected: isExternalConnected } = useWallet();
  const { activeWalletMode, isPasskeyConnected, smartAccountAddress, setActiveWalletMode } =
    usePasskeySmartAccount();

  useEffect(() => {
    if (isPasskeyConnected && smartAccountAddress) {
      setActiveWalletMode("passkey_smart_account");
    }
  }, [isPasskeyConnected, setActiveWalletMode, smartAccountAddress]);

  useEffect(() => {
    if (isExternalConnected && externalWalletAddress && !isPasskeyConnected) {
      setActiveWalletMode("external_wallet");
    }
  }, [externalWalletAddress, isExternalConnected, isPasskeyConnected, setActiveWalletMode]);

  return useMemo(() => {
    if (activeWalletMode === "passkey_smart_account" && isPasskeyConnected && smartAccountAddress) {
      return {
        walletAddress: smartAccountAddress,
        walletType: "passkey_smart_account",
        isConnected: true,
        canSignEscrowTransactions: false,
        displayAddress: shortenWalletAddress(smartAccountAddress),
        source: "passkey_smart_account",
        activeWalletMode,
        setActiveWalletMode,
      };
    }

    if (isExternalConnected && externalWalletAddress) {
      return {
        walletAddress: externalWalletAddress,
        walletType: "external_wallet",
        isConnected: true,
        canSignEscrowTransactions: true,
        displayAddress: shortenWalletAddress(externalWalletAddress),
        source: "stellar_wallets_kit",
        activeWalletMode,
        setActiveWalletMode,
      };
    }

    return {
      walletAddress: null,
      walletType: null,
      isConnected: false,
      canSignEscrowTransactions: false,
      displayAddress: null,
      source: null,
      activeWalletMode,
      setActiveWalletMode,
    };
  }, [
    activeWalletMode,
    externalWalletAddress,
    isExternalConnected,
    isPasskeyConnected,
    setActiveWalletMode,
    smartAccountAddress,
  ]);
}
