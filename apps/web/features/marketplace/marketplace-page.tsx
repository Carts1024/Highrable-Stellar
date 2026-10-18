"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  ProductPageHero,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  compareJobsBySafetyThenNewest,
  getApplicationTrustSafetyNoticeType,
  getJobSafetySortRank,
  getJobSafetyStatus,
} from "@/features/marketplace/lib/job-safety";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { useAppMode } from "@/features/mode";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import React from "react";

import type { TMarketplaceJobRow } from "@/features/marketplace/types";

import { CreateJobForm } from "./components/create-job-form";
import { JobApplicationDialog } from "./components/job-application-dialog";
import { JobList } from "./components/job-list";

type TMarketplaceFilter = "all" | "verified_funded";
type TMarketplaceSortOption = "safest" | "budget_high" | "budget_low";

const SORT_OPTIONS = [
  { value: "safest", label: "Safest first" },
  { value: "budget_high", label: "Highest budget" },
  { value: "budget_low", label: "Lowest budget" },
] as const;

const MARKETPLACE_SORTERS: Record<
  TMarketplaceSortOption,
  (left: TMarketplaceJobRow, right: TMarketplaceJobRow) => number
> = {
  safest: compareJobsBySafetyThenNewest,
  budget_high: (left, right) =>
    compareSafetyRankOnly(left, right) ||
    (right.job.totalBudget ?? right.job.budget) - (left.job.totalBudget ?? left.job.budget),
  budget_low: (left, right) =>
    compareSafetyRankOnly(left, right) ||
    (left.job.totalBudget ?? left.job.budget) - (right.job.totalBudget ?? right.job.budget),
};

function compareSafetyRankOnly(left: TMarketplaceJobRow, right: TMarketplaceJobRow): number {
  return (
    getJobSafetySortRank(getJobSafetyStatus(left).status) -
    getJobSafetySortRank(getJobSafetyStatus(right).status)
  );
}

export function MarketplacePage() {
  const router = useRouter();
  const { mode } = useAppMode();
  const walletIdentity = useHighrableWalletIdentity();
  const marketplaceRows = useQuery(api.jobs.listMarketplaceJobs, {});
  const appliedJobIds = useQuery(
    api.applications.listAppliedJobIdsByFreelancer,
    walletIdentity.walletAddress ? { freelancerWallet: walletIdentity.walletAddress } : "skip",
  );
  const applyToJob = useMutation(api.applications.applyToJob);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [selectedJobForApplyId, setSelectedJobForApplyId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TMarketplaceFilter>("all");
  const [sortBy, setSortBy] = useState<TMarketplaceSortOption>("safest");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const searchInputId = "marketplace-search-input";

  const visibleRows = useMemo(() => {
    if (!marketplaceRows) {
      return [];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return marketplaceRows
      .filter((row) => {
        const { job } = row;
        const safetyStatus = getJobSafetyStatus(row);
        if (filter === "verified_funded" && safetyStatus.status !== "verified_funded") {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          job.title.toLowerCase().includes(normalizedSearch) ||
          job.description.toLowerCase().includes(normalizedSearch) ||
          job.asset.toLowerCase().includes(normalizedSearch) ||
          job.clientWallet.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort(MARKETPLACE_SORTERS[sortBy]);
  }, [marketplaceRows, searchTerm, sortBy, filter]);

  const appliedJobIdSet = useMemo(() => {
    if (!walletIdentity.walletAddress) {
      return new Set<string>();
    }

    return appliedJobIds ? new Set<string>(appliedJobIds) : undefined;
  }, [appliedJobIds, walletIdentity.walletAddress]);

  const selectedRowForApply =
    marketplaceRows?.find((row) => row.job._id === selectedJobForApplyId) ?? null;
  const selectedJobForApply = selectedRowForApply?.job ?? null;

  const openApplyDialogFromList = (jobId: string) => {
    if (!walletIdentity.walletAddress || !marketplaceRows) {
      return;
    }

    const selectedJob = marketplaceRows.find((row) => row.job._id === jobId)?.job;
    if (!selectedJob) {
      return;
    }

    if (isSameWallet(selectedJob.clientWallet, walletIdentity.walletAddress)) {
      showWarningToast("Client cannot apply to their own job.");
      return;
    }

    if (appliedJobIdSet?.has(jobId)) {
      showWarningToast("You already applied to this job.");
      return;
    }

    setApplyError(null);
    setSelectedJobForApplyId(jobId);
  };

  const handleApplyFromList = async (proposal: string, showcasedWorkEscrowId: string | null) => {
    if (!walletIdentity.walletAddress || !selectedJobForApply) {
      return;
    }

    setApplyingJobId(selectedJobForApply._id);
    setApplyError(null);

    try {
      await applyToJob({
        jobId: selectedJobForApply._id,
        freelancerWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        ...(showcasedWorkEscrowId ? { showcasedWorkEscrowId } : {}),
        proposal,
      });
      showSuccessToast(`Application submitted for "${selectedJobForApply.title}".`);
      setSelectedJobForApplyId(null);
    } catch (error) {
      const readableError = getReadableErrorMessage(
        error,
        "Failed to apply to this job. Please try again.",
      );
      const nextError = readableError.toLowerCase().includes("already applied")
        ? "You already applied to this job."
        : readableError;
      setApplyError(nextError);
      showErrorToast(nextError);
    } finally {
      setApplyingJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      <ProductPageHero
        title={mode === "client" ? "Jobs" : "Find work"}
        description={
          mode === "client"
            ? "Post work, review applicants, and set the payment aside once you have chosen someone."
            : "Open jobs from clients on Highrable. Jobs with the payment already on hold are listed first."
        }
        actions={
          mode === "client" ? (
            <AppButton
              type="button"
              className="hr-v2-button-primary h-9 rounded-md px-4"
              onClick={() => setIsCreateJobOpen((open) => !open)}
            >
              {isCreateJobOpen ? "Close job form" : "Post a job"}
            </AppButton>
          ) : undefined
        }
      />

      {mode === "client" && isCreateJobOpen ? (
        <CreateJobForm
          onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor={searchInputId} className="relative w-full sm:max-w-md">
            <span className="sr-only">Search jobs</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <AppInput
              id={searchInputId}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, description, currency or wallet"
              className="w-full bg-white pr-3 pl-9 font-sans"
            />
          </label>

          <Select
            value={sortBy}
            onValueChange={(value: TMarketplaceSortOption) => setSortBy(value)}
          >
            <SelectTrigger className="w-full bg-white font-sans sm:w-44" aria-label="Sort jobs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            role="radiogroup"
            aria-label="Filter jobs"
            className="flex items-center gap-1 rounded-md border bg-white p-0.5 sm:ml-auto"
          >
            {(["all", "verified_funded"] as TMarketplaceFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded px-3 py-1.5 text-sm whitespace-nowrap transition-colors sm:flex-none ${
                  filter === f
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All jobs" : "Payment on hold"}
              </button>
            ))}
          </div>
        </div>

        {applyError ? (
          <p role="alert" className="text-sm text-red-700">
            {applyError}
          </p>
        ) : null}

        {marketplaceRows !== undefined ? (
          <p className="hr-text-secondary text-sm">
            {visibleRows.length} {visibleRows.length === 1 ? "job" : "jobs"}
          </p>
        ) : null}

        <JobList
          jobs={marketplaceRows === undefined ? undefined : visibleRows}
          connectedWallet={walletIdentity.walletAddress}
          onApply={openApplyDialogFromList}
          applyingJobId={applyingJobId}
          appliedJobIds={appliedJobIdSet}
        />
      </section>

      <JobApplicationDialog
        isOpen={!!selectedJobForApply}
        isSubmitting={!!applyingJobId}
        jobTitle={selectedJobForApply?.title ?? "this job"}
        trustSafetyNoticeType={getApplicationTrustSafetyNoticeType(
          selectedRowForApply ? getJobSafetyStatus(selectedRowForApply).status : "unfunded",
        )}
        errorMessage={applyError}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedJobForApplyId(null);
            setApplyError(null);
          }
        }}
        onSubmit={handleApplyFromList}
      />
    </div>
  );
}
