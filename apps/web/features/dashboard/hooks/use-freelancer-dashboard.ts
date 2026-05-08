"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
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
  const walletIdentity = useHighrableWalletIdentity();

  const summary = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).dashboard.queries.getFreelancerIncomeSummary,
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
    isFunded: walletIdentity.isFunded,
    isTestnet: walletIdentity.isTestnet,
  };
}
