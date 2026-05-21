"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { usePaginatedQuery } from "convex/react";

import type { IPaginatedDashboardState, IPostedJobItem } from "@/features/dashboard/types";

const INITIAL_PAGE_SIZE = 8;
const NEXT_PAGE_SIZE = 8;

export interface IClientPostedJobsState extends IPaginatedDashboardState<IPostedJobItem> {
  readonly nextPageSize: number;
}

export function useClientPostedJobs(): IClientPostedJobsState {
  const walletIdentity = useHighrableWalletIdentity();

  const { results, status, isLoading, loadMore } = usePaginatedQuery(
    api.dashboard.queries.listClientPostedJobsPage,
    walletIdentity.isConnected && walletIdentity.walletAddress
      ? { clientWallet: walletIdentity.walletAddress }
      : "skip",
    { initialNumItems: INITIAL_PAGE_SIZE },
  );

  return {
    items: results,
    status,
    isInitialLoading: isLoading,
    canLoadMore: status === "CanLoadMore",
    isLoadingMore: status === "LoadingMore",
    loadMore,
    nextPageSize: NEXT_PAGE_SIZE,
  };
}
