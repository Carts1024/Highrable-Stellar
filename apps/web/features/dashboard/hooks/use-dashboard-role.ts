"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";

import type { TDashboardRole } from "@/features/dashboard/types";

export interface IDashboardRoleState {
  readonly role: TDashboardRole | null;
  readonly isLoading: boolean;
}

export function useDashboardRole(): IDashboardRoleState {
  const { isConnected, address } = useWallet();

  const user = useQuery(
    api.users.queries.getUserByWallet,
    isConnected && address ? { walletAddress: address } : "skip",
  );

  const role = (user?.role as TDashboardRole | undefined) ?? null;
  const isLoading = isConnected && address != null && user === undefined;

  return { role, isLoading };
}
