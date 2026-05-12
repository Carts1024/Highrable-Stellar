"use client";

import { getRequiredEscrowActionConfig } from "@/core/config/stellar-contracts";
import { fromTokenAmount, toTokenAmount } from "@/core/stellar/amounts";
import { getStablecoinBalanceOnChain } from "@/core/stellar/escrow-contract";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TStablecoinReadinessState = {
  balanceAtomic: bigint | null;
  isLoading: boolean;
  error: string | null;
};

interface IUseStablecoinReadinessParams {
  readonly walletAddress: string | null | undefined;
  readonly requiredAmount: number | string;
  readonly enabled?: boolean;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Could not fetch stablecoin balance right now. Try again.";
}

export function useStablecoinReadiness({
  walletAddress,
  requiredAmount,
  enabled = true,
}: IUseStablecoinReadinessParams) {
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

  const requiredAmountAtomic = useMemo(() => {
    try {
      return toTokenAmount(requiredAmount);
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

    if (!sanitizedWalletAddress) {
      setState((currentValue) => ({
        ...currentValue,
        balanceAtomic: null,
        isLoading: false,
        error: "Connect a valid Stellar wallet to check stablecoin readiness.",
      }));
      return;
    }

    if (requiredAmountAtomic === null) {
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
      const config = getRequiredEscrowActionConfig();
      const balanceAtomic = await getStablecoinBalanceOnChain({
        rpcUrl: config.rpcUrl,
        networkPassphrase: config.networkPassphrase,
        stablecoinTokenContractId: config.stablecoinTokenContractId,
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
  }, [enabled, requiredAmountAtomic, sanitizedWalletAddress]);

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
    requiredAmountAtomic,
    requiredAmountDisplay: requiredAmountAtomic ? fromTokenAmount(requiredAmountAtomic) : null,
    balanceAtomic: state.balanceAtomic,
    balanceDisplay: state.balanceAtomic === null ? null : fromTokenAmount(state.balanceAtomic),
    deficitAtomic,
    deficitDisplay: deficitAtomic === null ? null : fromTokenAmount(deficitAtomic),
    hasSufficientBalance,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  };
}
