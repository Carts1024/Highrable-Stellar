"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

import type { TFreelancerIncomeSummary } from "@/features/dashboard/types";

export interface IFreelancerDashboardState {
  readonly summary: TFreelancerIncomeSummary | undefined;
  readonly isLoading: boolean;
  readonly isConnected: boolean;
  readonly address: string | null;
  readonly isFunded: boolean | null;
  readonly isTestnet: boolean;
}

/**
 * Hook to manage and provide data for the freelancer's financial dashboard.
 * Following strictly typed, maintainable, and reusable patterns.
 */
export function useFreelancerDashboard(): IFreelancerDashboardState {
  const { walletState } = useWallet();
  const walletIdentity = useHighrableWalletIdentity();

  // Strictly typed query via Convex API bindings.
  const summary = useQuery(
    api.dashboard.queries.getFreelancerIncomeSummary,
    walletIdentity.isConnected && walletIdentity.walletAddress
      ? { freelancerWallet: walletIdentity.walletAddress }
      : "skip",
  );

  const isLoading =
    walletIdentity.isConnected && walletIdentity.walletAddress != null && summary === undefined;

  return {
    summary: summary ?? undefined,
    isLoading,
    isConnected: walletIdentity.isConnected,
    address: walletIdentity.walletAddress,
    isFunded: walletState.isFunded,
    isTestnet: walletState.isTestnet,
  };
}
