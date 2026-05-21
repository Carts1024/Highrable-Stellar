"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

import type { TDashboardRole } from "@/features/dashboard/types";

export interface IDashboardRoleState {
  readonly role: TDashboardRole | null;
  readonly isLoading: boolean;
}

export function useDashboardRole(): IDashboardRoleState {
  const walletIdentity = useHighrableWalletIdentity();

  const user = useQuery(
    api.users.queries.getUserByWallet,
    walletIdentity.isConnected && walletIdentity.walletAddress
      ? { walletAddress: walletIdentity.walletAddress }
      : "skip",
  );

  const role = (user?.role as TDashboardRole | undefined) ?? null;
  const isLoading =
    walletIdentity.isConnected && walletIdentity.walletAddress != null && user === undefined;

  return { role, isLoading };
}
