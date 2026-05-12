"use client";

import {
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_RPC_URL,
} from "@/core/config/stellar-contracts";
import { fromTokenUnits, toTokenUnits } from "@/core/stellar/amounts";
import { getStablecoinBalanceOnChain } from "@/core/stellar/escrow-contract";
import {
  stablecoinConfig,
  validateStablecoinConfig,
} from "@/core/stellar/stablecoin-config";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TStablecoinReadinessState = {
  balanceAtomic: bigint | null;
  isLoading: boolean;
  error: string | null;
};

interface IUseStablecoinReadinessParams {
  readonly walletAddress: string | null | undefined;
  readonly requiredAmount?: number | string;
  readonly tokenContractId?: string;
  readonly enabled?: boolean;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Could not read stablecoin balance. Check the token contract ID and network.";
}

export type TStablecoinReadinessResult = {
  readonly symbol: string;
  readonly decimals: number;
  readonly tokenContractId?: string;
  readonly requiredAmountAtomic: bigint | null;
  readonly requiredAmountDisplay: string | null;
  readonly balanceAtomic: bigint | null;
  readonly balanceDisplay: string | null;
  readonly deficitAtomic: bigint | null;
  readonly deficitDisplay: string | null;
  readonly hasSufficientBalance: boolean | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
};

export function useStablecoinReadiness({
  walletAddress,
  requiredAmount,
  tokenContractId,
  enabled = true,
}: IUseStablecoinReadinessParams): TStablecoinReadinessResult {
  const activeRequestRef = useRef(0);
  const [state, setState] = useState<TStablecoinReadinessState>({
    balanceAtomic: null,
    isLoading: false,
    error: null,
  });

  const sanitizedWalletAddress = useMemo(() => {
    if (!walletAddress) {
      return null;
    }

    try {
      return TStellarPublicKeySchema.parse(walletAddress);
    } catch {
      return null;
    }
  }, [walletAddress]);

  const resolvedTokenContractId = tokenContractId ?? stablecoinConfig.tokenContractId;
  const configValidation = useMemo(
    () =>
      validateStablecoinConfig({
        ...stablecoinConfig,
        tokenContractId: resolvedTokenContractId,
      }),
    [resolvedTokenContractId],
  );

  const requiredAmountAtomic = useMemo(() => {
    if (requiredAmount === undefined || requiredAmount === null || String(requiredAmount).trim() === "") {
      return null;
    }

    try {
      return toTokenUnits(requiredAmount, stablecoinConfig.decimals);
    } catch {
      return null;
    }
  }, [requiredAmount]);

  const refresh = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    if (!enabled) {
      setState({
        balanceAtomic: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    if (!configValidation.isValid || !resolvedTokenContractId) {
      setState((currentValue) => ({
        ...currentValue,
        balanceAtomic: null,
        isLoading: false,
        error: configValidation.message ?? "Stablecoin token contract is not configured.",
      }));
      return;
    }

    if (!sanitizedWalletAddress) {
      setState((currentValue) => ({
        ...currentValue,
        balanceAtomic: null,
        isLoading: false,
        error: "Connect a valid Stellar wallet to check stablecoin readiness.",
      }));
      return;
    }

    if (
      requiredAmount !== undefined &&
      requiredAmount !== null &&
      String(requiredAmount).trim() !== "" &&
      requiredAmountAtomic === null
    ) {
      setState((currentValue) => ({
        ...currentValue,
        balanceAtomic: null,
        isLoading: false,
        error: "Escrow amount is invalid. Refresh job details and try again.",
      }));
      return;
    }

    setState((currentValue) => ({
      ...currentValue,
      isLoading: true,
      error: null,
    }));

    try {
      const balanceAtomic = await getStablecoinBalanceOnChain({
        rpcUrl: STELLAR_RPC_URL,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
        stablecoinTokenContractId: resolvedTokenContractId,
        sourceAddress: sanitizedWalletAddress,
        walletAddress: sanitizedWalletAddress,
      });

      if (activeRequestRef.current !== requestId) {
        return;
      }

      setState({
        balanceAtomic,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }

      setState((currentValue) => ({
        ...currentValue,
        isLoading: false,
        error: toErrorMessage(error),
      }));
    }
  }, [
    configValidation.isValid,
    configValidation.message,
    enabled,
    requiredAmount,
    requiredAmountAtomic,
    resolvedTokenContractId,
    sanitizedWalletAddress,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const deficitAtomic = useMemo(() => {
    if (requiredAmountAtomic === null || state.balanceAtomic === null) {
      return null;
    }

    return requiredAmountAtomic > state.balanceAtomic
      ? requiredAmountAtomic - state.balanceAtomic
      : 0n;
  }, [requiredAmountAtomic, state.balanceAtomic]);

  const hasSufficientBalance = useMemo(() => {
    if (requiredAmountAtomic === null || state.balanceAtomic === null) {
      return null;
    }

    return state.balanceAtomic >= requiredAmountAtomic;
  }, [requiredAmountAtomic, state.balanceAtomic]);

  return {
    symbol: stablecoinConfig.symbol,
    decimals: stablecoinConfig.decimals,
    tokenContractId: resolvedTokenContractId,
    requiredAmountAtomic,
    requiredAmountDisplay:
      requiredAmountAtomic === null
        ? null
        : fromTokenUnits(requiredAmountAtomic, stablecoinConfig.decimals),
    balanceAtomic: state.balanceAtomic,
    balanceDisplay:
      state.balanceAtomic === null
        ? null
        : fromTokenUnits(state.balanceAtomic, stablecoinConfig.decimals),
    deficitAtomic,
    deficitDisplay:
      deficitAtomic === null
        ? null
        : fromTokenUnits(deficitAtomic, stablecoinConfig.decimals),
    hasSufficientBalance,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  };
}
