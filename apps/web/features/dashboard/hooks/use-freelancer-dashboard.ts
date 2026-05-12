"use client";

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
  const { isConnected, address, walletState } = useWallet();

  // Strictly typed query via Convex API bindings.
  const summary = useQuery(
    api.dashboard.queries.getFreelancerIncomeSummary,
    isConnected && address ? { freelancerWallet: address } : "skip",
  );

  const isLoading = isConnected && address != null && summary === undefined;

  return {
    summary: summary ?? undefined,
    isLoading,
    isConnected,
    address,
    isFunded: walletState.isFunded,
    isTestnet: walletState.isTestnet,
  };
}
