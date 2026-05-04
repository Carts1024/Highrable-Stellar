"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

import type { TFreelancerIncomeSummary } from "@/features/dashboard/types";

type TFreelancerDashboardState = {
  summary: TFreelancerIncomeSummary | undefined;
  isLoading: boolean;
  isConnected: boolean;
  address: string | null;
  isFunded: boolean | null;
  isTestnet: boolean;
};

export function useFreelancerDashboard(): TFreelancerDashboardState {
  const { isConnected, address, walletState } = useWallet();

  const summary = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).dashboard.queries.getFreelancerIncomeSummary,
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
