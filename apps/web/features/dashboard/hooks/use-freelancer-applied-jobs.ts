"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { usePaginatedQuery } from "convex/react";

import type { IAppliedJobItem, IPaginatedDashboardState } from "@/features/dashboard/types";

const INITIAL_PAGE_SIZE = 8;
const NEXT_PAGE_SIZE = 8;

export interface IFreelancerAppliedJobsState extends IPaginatedDashboardState<IAppliedJobItem> {
  readonly nextPageSize: number;
}

export function useFreelancerAppliedJobs(): IFreelancerAppliedJobsState {
  const walletIdentity = useHighrableWalletIdentity();

  const { results, status, isLoading, loadMore } = usePaginatedQuery(
    api.dashboard.queries.listFreelancerAppliedJobsPage,
    walletIdentity.isConnected && walletIdentity.walletAddress
      ? { freelancerWallet: walletIdentity.walletAddress }
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
