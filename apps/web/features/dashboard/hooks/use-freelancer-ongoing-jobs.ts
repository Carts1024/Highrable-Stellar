"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { usePaginatedQuery } from "convex/react";

import type { IOngoingJobItem, IPaginatedDashboardState } from "@/features/dashboard/types";

const INITIAL_PAGE_SIZE = 8;
const NEXT_PAGE_SIZE = 8;

export interface IFreelancerOngoingJobsState extends IPaginatedDashboardState<IOngoingJobItem> {
  readonly nextPageSize: number;
}

export function useFreelancerOngoingJobs(): IFreelancerOngoingJobsState {
  const walletIdentity = useHighrableWalletIdentity();

  const { results, status, isLoading, loadMore } = usePaginatedQuery(
    api.dashboard.queries.listFreelancerOngoingJobsPage,
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
