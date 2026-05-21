"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ProductPageHero } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  compareJobsBySafetyThenNewest,
  getApplicationTrustSafetyNoticeType,
  getJobSafetySortRank,
  getJobSafetyStatus,
} from "@/features/marketplace/lib/job-safety";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { HighrableV2Metric, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { Filter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { TMarketplaceJobRow } from "@/features/marketplace/types";

import { CreateJobForm } from "./components/create-job-form";
import { JobApplicationDialog } from "./components/job-application-dialog";
import { JobList } from "./components/job-list";

type TMarketplaceFilter = "all" | "verified_funded";
type TMarketplaceSortOption = "safest" | "budget_high" | "budget_low";

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

function formatBudget(value: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function MarketplacePage() {
  const router = useRouter();
  const walletIdentity = useHighrableWalletIdentity();
  const marketplaceRows = useQuery(api.jobs.listMarketplaceJobs, {});
  const applyToJob = useMutation(api.applications.applyToJob);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [selectedJobForApplyId, setSelectedJobForApplyId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TMarketplaceFilter>("all");
  const [sortBy, setSortBy] = useState<TMarketplaceSortOption>("safest");
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputId = "marketplace-search-input";
  const sortSelectId = "marketplace-sort-select";

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

  const totalBudget = useMemo(() => {
    return visibleRows.reduce((total, row) => total + (row.job.totalBudget ?? row.job.budget), 0);
  }, [visibleRows]);

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
      setApplyError("Client cannot apply to their own job.");
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
      setSelectedJobForApplyId(null);
    } catch (error) {
      const readableError = getReadableErrorMessage(
        error,
        "Failed to apply to this job. Please try again.",
      );
      if (readableError.toLowerCase().includes("already applied")) {
        setApplyError("You already applied to this job.");
      } else {
        setApplyError(readableError);
      }
    } finally {
      setApplyingJobId(null);
    }
  };

  return (
    <div className="space-y-10">
      <section className="grid gap-8 border-b border-[#e8e8e8] pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <ProductPageHero
          label="Marketplace Workflow"
          title={
            <>
              Marketplace <span className="text-[#FF7003]">for Escrow-backed Collaboration</span>
            </>
          }
          description="Post work, review applicants, and move selected collaborations into escrow without leaving the workflow."
        />

        <div className="grid gap-5 border-l border-[#e8e8e8] py-2">
          <HighrableV2Metric label="Active jobs" value={marketplaceRows?.length ?? "-"} />
          <HighrableV2Metric label="Matching" value={visibleRows.length} />
          <HighrableV2Metric
            label="Visible budget pool"
            value={formatBudget(totalBudget)}
            className="text-[#B94A00]"
          />
        </div>
      </section>

      <details className="group border border-[#e8e8e8] bg-[#fafafa] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <SectionLabel>Create Job Workspace</SectionLabel>
            <span className="mt-2 block text-sm leading-relaxed text-[#5f5f5f]">
              Open the posting form when you need to create escrow-ready client work.
            </span>
          </span>
          <span className="font-mono text-xs text-[#B94A00] uppercase group-open:hidden">Open</span>
          <span className="hidden font-mono text-xs text-[#B94A00] uppercase group-open:block">
            Hide
          </span>
        </summary>
        <div className="mt-4">
          <CreateJobForm
            onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
          />
        </div>
      </details>

      <section className="border border-[#e8e8e8] bg-white p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label htmlFor={searchInputId} className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <AppInput
              id={searchInputId}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, description, asset, or wallet"
              className="h-11 rounded-none border-[#e8e8e8] pr-3 pl-10 focus-visible:ring-[#FF7003]/30"
            />
          </label>

          <label htmlFor={sortSelectId} className="relative block">
            <Filter className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              id={sortSelectId}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as TMarketplaceSortOption)}
              className="h-11 w-full appearance-none rounded-none border border-[#e8e8e8] bg-white pr-3 pl-9 text-sm font-medium text-[#5f5f5f] outline-hidden transition-colors focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]/20"
            >
              <option value="safest">Safest first</option>
              <option value="budget_high">Highest budget</option>
              <option value="budget_low">Lowest budget</option>
            </select>
          </label>
        </div>
        <div className="mt-3 inline-flex border border-[#e8e8e8] bg-white p-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 font-mono text-xs tracking-[0.04em] uppercase ${
              filter === "all" ? "bg-[#0a0a0a] text-white" : "text-[#5f5f5f]"
            }`}
          >
            All active jobs
          </button>
          <button
            type="button"
            onClick={() => setFilter("verified_funded")}
            className={`px-3 py-1.5 font-mono text-xs tracking-[0.04em] uppercase ${
              filter === "verified_funded" ? "bg-[#0a0a0a] text-white" : "text-[#5f5f5f]"
            }`}
          >
            Verified Funded
          </button>
        </div>
      </section>

      {applyError ? (
        <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {applyError}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <SectionLabel>Marketplace Feed</SectionLabel>
            <h2 className="text-lg font-semibold text-[#0a0a0a]">
              {visibleRows.length} jobs found
            </h2>
          </div>
          <AppButton
            type="button"
            variant="outline"
            className="rounded-none border-[#e8e8e8] bg-white text-sm font-semibold text-[#5f5f5f] hover:bg-[#fafafa]"
            onClick={() => {
              setSearchTerm("");
              setFilter("all");
              setSortBy("safest");
            }}
          >
            Reset view
          </AppButton>
        </div>
        <JobList
          jobs={marketplaceRows === undefined ? undefined : visibleRows}
          connectedWallet={walletIdentity.walletAddress}
          onApply={openApplyDialogFromList}
          applyingJobId={applyingJobId}
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
