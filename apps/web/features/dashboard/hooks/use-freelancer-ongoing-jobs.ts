"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { api } from "@repo/convex-client";
import { usePaginatedQuery } from "convex/react";

import type { IOngoingJobItem, IPaginatedDashboardState } from "@/features/dashboard/types";

const INITIAL_PAGE_SIZE = 8;
const NEXT_PAGE_SIZE = 8;

export interface IFreelancerOngoingJobsState extends IPaginatedDashboardState<IOngoingJobItem> {
  readonly nextPageSize: number;
}

export function useFreelancerOngoingJobs(): IFreelancerOngoingJobsState {
  const { isConnected, address } = useWallet();

  const { results, status, isLoading, loadMore } = usePaginatedQuery(
    api.dashboard.queries.listFreelancerOngoingJobsPage,
    isConnected && address ? { freelancerWallet: address } : "skip",
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
