"use client";

import {
  enableUsdcTrustline,
  hasUsdcTrustline,
  UsdcTrustlineError,
} from "@/core/stellar/trustline";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { useCallback, useEffect, useRef, useState } from "react";

type TUseUsdcTrustlineState = {
  hasTrustline: boolean | null;
  isChecking: boolean;
  isEnabling: boolean;
  error: string | null;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof UsdcTrustlineError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Could not enable USDC payments. Please make sure your wallet is funded with testnet XLM and try again.";
}

export function useUsdcTrustline(publicKey: string | null | undefined) {
  const { signTransaction, walletState } = useWallet();
  const activeRequestRef = useRef(0);
  const [state, setState] = useState<TUseUsdcTrustlineState>({
    hasTrustline: null,
    isChecking: false,
    isEnabling: false,
    error: null,
  });

  const refreshTrustlineStatus = useCallback(async (): Promise<boolean | null> => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    if (!publicKey) {
      setState({
        hasTrustline: null,
        isChecking: false,
        isEnabling: false,
        error: null,
      });
      return null;
    }

    if (!walletState.isTestnet) {
      setState((currentValue) => ({
        ...currentValue,
        hasTrustline: false,
        isChecking: false,
        error: "Switch your wallet to Stellar Testnet before enabling USDC payments.",
      }));
      return false;
    }

    setState((currentValue) => ({
      ...currentValue,
      isChecking: true,
      error: null,
    }));

    try {
      const trustlineExists = await hasUsdcTrustline(publicKey);

      if (activeRequestRef.current === requestId) {
        setState((currentValue) => ({
          ...currentValue,
          hasTrustline: trustlineExists,
          isChecking: false,
          error: null,
        }));
      }

      return trustlineExists;
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      if (activeRequestRef.current === requestId) {
        setState((currentValue) => ({
          ...currentValue,
          hasTrustline: false,
          isChecking: false,
          error: errorMessage,
        }));
      }

      return false;
    }
  }, [publicKey, walletState.isTestnet]);

  const enableUsdcPayments = useCallback(async (): Promise<void> => {
    if (!publicKey) {
      setState((currentValue) => ({
        ...currentValue,
        error: "Connect a wallet before enabling USDC payments.",
      }));
      return;
    }

    setState((currentValue) => ({
      ...currentValue,
      isEnabling: true,
      error: null,
    }));

    try {
      await enableUsdcTrustline({
        publicKey,
        signTransaction,
      });

      const trustlineExists = await refreshTrustlineStatus();

      setState((currentValue) => ({
        ...currentValue,
        hasTrustline: trustlineExists === true,
        isEnabling: false,
        error:
          trustlineExists === true
            ? null
            : "USDC setup was submitted, but confirmation is delayed. Please try refreshing in a moment.",
      }));
    } catch (error) {
      setState((currentValue) => ({
        ...currentValue,
        isEnabling: false,
        error: toErrorMessage(error),
      }));
    }
  }, [publicKey, refreshTrustlineStatus, signTransaction]);

  useEffect(() => {
    void refreshTrustlineStatus();
  }, [refreshTrustlineStatus]);

  return {
    ...state,
    refreshTrustlineStatus,
    enableUsdcPayments,
  };
}
