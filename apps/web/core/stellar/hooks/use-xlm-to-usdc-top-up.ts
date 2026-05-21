"use client";

import { STELLAR_NETWORK } from "@/core/config/stellar-contracts";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  classifyPathPaymentError,
  executeXlmToUsdcTopUp,
  getClassicXlmBalance,
  hasEnoughXlmForPathPayment,
  quoteXlmToUsdcStrictReceive,
  validatePathPaymentConfig,
  type TExecutePathPaymentResult,
  type TPathPaymentQuote,
} from "../path-payments";
import { isStablecoinEscrowAsset } from "../payment-assets";

type TWalletType = "external_wallet" | "passkey_smart_account";

type TTopUpState = {
  readonly quote?: TPathPaymentQuote;
  readonly quoteError?: string;
  readonly isQuoting: boolean;
  readonly isExecuting: boolean;
  readonly executionError?: string;
  readonly lastTxHash?: string;
  readonly xlmBalance?: string;
};

export type TUseXlmToUsdcTopUpArgs = {
  readonly walletAddress?: string | null;
  readonly walletType?: TWalletType | null;
  readonly missingUsdcAmount?: string | null;
  readonly usdcBalance?: string | null;
  readonly xlmFeeBalance?: string | null;
  readonly jobAssetContractId?: string | null;
  readonly isWalletOnConfiguredNetwork?: boolean;
  readonly onSuccess?: () => Promise<void> | void;
};

export type TUseXlmToUsdcTopUpResult = TTopUpState & {
  readonly isAvailable: boolean;
  readonly unavailableReason?: string;
  readonly requestQuote: () => Promise<void>;
  readonly executeTopUp: () => Promise<TExecutePathPaymentResult>;
  readonly reset: () => void;
};

function hasPositiveAmount(amount: string | null | undefined): boolean {
  if (!amount) {
    return false;
  }

  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) && numericAmount > 0;
}

function getUnavailableReason({
  walletAddress,
  walletType,
  missingUsdcAmount,
  jobAssetContractId,
  isWalletOnConfiguredNetwork = true,
}: TUseXlmToUsdcTopUpArgs): string | undefined {
  const configValidation = validatePathPaymentConfig();
  if (!configValidation.isValid) {
    return configValidation.message ?? "Path payment configuration is missing.";
  }

  if (walletType === "passkey_smart_account") {
    return "XLM to USDC conversion is currently available only for external wallets. To use this top-up flow, switch to Freighter or WalletConnect. Passkey smart accounts can fund escrow once they already hold USDC.";
  }

  if (walletType !== "external_wallet") {
    return "Connect an external Stellar wallet to convert XLM to USDC.";
  }

  if (!isWalletOnConfiguredNetwork) {
    return "Your wallet network does not match the configured Highrable network.";
  }

  if (!walletAddress) {
    return "Connect an external Stellar wallet to convert XLM to USDC.";
  }

  if (!TStellarPublicKeySchema.safeParse(walletAddress).success) {
    return "XLM to USDC conversion requires a classic Stellar G... wallet address.";
  }

  if (!jobAssetContractId || !isStablecoinEscrowAsset(jobAssetContractId)) {
    return "XLM to USDC top-up is only available for USDC escrow jobs.";
  }

  if (!hasPositiveAmount(missingUsdcAmount)) {
    return "USDC top-up is only needed when the escrow wallet has an insufficient USDC balance.";
  }

  return undefined;
}

export function useXlmToUsdcTopUp({
  walletAddress,
  walletType,
  missingUsdcAmount,
  xlmFeeBalance,
  jobAssetContractId,
  onSuccess,
}: TUseXlmToUsdcTopUpArgs): TUseXlmToUsdcTopUpResult {
  const { signTransaction, walletState } = useWallet();
  const isWalletOnConfiguredNetwork = STELLAR_NETWORK === "testnet" ? walletState.isTestnet : true;
  const [state, setState] = useState<TTopUpState>({
    isQuoting: false,
    isExecuting: false,
    ...(xlmFeeBalance ? { xlmBalance: xlmFeeBalance } : {}),
  });

  const unavailableReason = useMemo(
    () =>
      getUnavailableReason({
        walletAddress,
        walletType,
        missingUsdcAmount,
        jobAssetContractId,
        isWalletOnConfiguredNetwork,
      }),
    [jobAssetContractId, isWalletOnConfiguredNetwork, missingUsdcAmount, walletAddress, walletType],
  );
  const isAvailable = unavailableReason === undefined;

  useEffect(() => {
    if (!isAvailable || xlmFeeBalance || !walletAddress) {
      return;
    }

    let isMounted = true;
    void getClassicXlmBalance(walletAddress)
      .then((balance) => {
        if (isMounted && balance !== null) {
          setState((currentValue) => ({ ...currentValue, xlmBalance: balance }));
        }
      })
      .catch(() => {
        if (isMounted) {
          setState((currentValue) => ({ ...currentValue, xlmBalance: undefined }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAvailable, walletAddress, xlmFeeBalance]);

  const reset = useCallback(() => {
    setState({
      isQuoting: false,
      isExecuting: false,
      ...(xlmFeeBalance ? { xlmBalance: xlmFeeBalance } : {}),
    });
  }, [xlmFeeBalance]);

  const requestQuote = useCallback(async () => {
    if (!isAvailable || !walletAddress || !missingUsdcAmount) {
      setState((currentValue) => ({
        ...currentValue,
        quoteError: unavailableReason ?? "XLM to USDC top-up is not available.",
      }));
      return;
    }

    setState((currentValue) => ({
      ...currentValue,
      isQuoting: true,
      quoteError: undefined,
      executionError: undefined,
    }));

    try {
      const quote = await quoteXlmToUsdcStrictReceive({
        sourceAccount: walletAddress,
        destinationAccount: walletAddress,
        destAmount: missingUsdcAmount,
      });
      const xlmBalance = xlmFeeBalance ?? (await getClassicXlmBalance(walletAddress));

      if (!hasEnoughXlmForPathPayment({ xlmBalance, sendMax: quote.sendMax })) {
        throw new Error("You do not have enough XLM for this conversion and network fees.");
      }

      setState((currentValue) => ({
        ...currentValue,
        quote,
        xlmBalance: xlmBalance ?? currentValue.xlmBalance,
        isQuoting: false,
        quoteError: undefined,
      }));
    } catch (error) {
      setState((currentValue) => ({
        ...currentValue,
        quote: undefined,
        isQuoting: false,
        quoteError: classifyPathPaymentError(error).message,
      }));
    }
  }, [isAvailable, missingUsdcAmount, unavailableReason, walletAddress, xlmFeeBalance]);

  const executeTopUp = useCallback(async () => {
    if (!isAvailable || !walletAddress || !missingUsdcAmount) {
      throw new Error(unavailableReason ?? "XLM to USDC top-up is not available.");
    }

    if (!state.quote) {
      throw new Error("Get a quote before converting XLM to USDC.");
    }

    setState((currentValue) => ({
      ...currentValue,
      isExecuting: true,
      executionError: undefined,
      lastTxHash: undefined,
    }));

    try {
      const result = await executeXlmToUsdcTopUp({
        sourceAccount: walletAddress,
        destinationAccount: walletAddress,
        destAmount: missingUsdcAmount,
        sendMax: state.quote.sendMax,
        path: state.quote.path,
        signTransaction,
      });

      await onSuccess?.();

      setState((currentValue) => ({
        ...currentValue,
        isExecuting: false,
        lastTxHash: result.hash,
        executionError: undefined,
      }));

      return result;
    } catch (error) {
      const normalizedError = classifyPathPaymentError(error);
      setState((currentValue) => ({
        ...currentValue,
        isExecuting: false,
        executionError: normalizedError.message,
      }));
      throw normalizedError;
    }
  }, [
    isAvailable,
    missingUsdcAmount,
    onSuccess,
    signTransaction,
    state.quote,
    unavailableReason,
    walletAddress,
  ]);

  return {
    ...state,
    isAvailable,
    unavailableReason,
    requestQuote,
    executeTopUp,
    reset,
  };
}
