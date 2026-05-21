"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

export interface IOnboardingState {
  readonly isConnected: boolean;
  readonly walletAddress: string | null;
  readonly walletType: "external_wallet" | "passkey_smart_account" | null;
  readonly isLoading: boolean;
  readonly isComplete: boolean;
  readonly isAdmin: boolean;
}

export function useOnboardingState(): IOnboardingState {
  const walletIdentity = useHighrableWalletIdentity();
  const onboardingState = useQuery(
    api.users.queries.getOnboardingState,
    walletIdentity.walletAddress ? { walletAddress: walletIdentity.walletAddress } : "skip",
  );

  return {
    isConnected: walletIdentity.isConnected,
    walletAddress: walletIdentity.walletAddress,
    walletType: walletIdentity.walletType,
    isLoading: walletIdentity.isConnected && onboardingState === undefined,
    isComplete: Boolean(onboardingState?.isComplete || onboardingState?.user?.role === "admin"),
    isAdmin: onboardingState?.user?.role === "admin",
  };
}
