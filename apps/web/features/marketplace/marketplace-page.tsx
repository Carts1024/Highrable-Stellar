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
import { ChevronDown, Filter, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

function formatBudget(value: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function MarketplacePage() {
  const router = useRouter();
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

  const totalBudget = useMemo(() => {
    return visibleRows.reduce((total, row) => total + (row.job.totalBudget ?? row.job.budget), 0);
  }, [visibleRows]);

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
    <div className="space-y-8">
      {/* Hero */}
      <section className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8 lg:pb-10">
        <ProductPageHero
          label="Marketplace Workflow"
          title={
            <>
              Marketplace <span className="text-[#FF7003]">for Escrow-backed Collaboration</span>
            </>
          }
          description="Post work, review applicants, and move selected collaborations into escrow without leaving the workflow."
          actions={
            <AppButton
              type="button"
              className="hr-v2-button-primary gap-2 rounded-lg px-6 font-mono"
              onClick={() => setIsCreateJobOpen((open) => !open)}
            >
              <Plus className="h-4 w-4" />
              {isCreateJobOpen ? "Close Job Form" : "Post a Job"}
            </AppButton>
          }
        />

        {/* Metric panel */}
        <div className="flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
          {[
            { label: "Active jobs", value: marketplaceRows?.length ?? "—" },
            { label: "Matching", value: visibleRows.length },
            {
              label: "Visible budget pool",
              value: formatBudget(totalBudget),
              accent: true,
            },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex flex-col gap-0.5 px-4 py-3 sm:px-5 sm:py-4">
              <span className="mb-2 font-mono text-xs tracking-[0.08em] text-muted-foreground/80 uppercase">
                {label}
              </span>
              <span
                className={`text-xl leading-none font-semibold sm:text-2xl ${
                  accent ? "text-highrable-orange-2" : "hr-text-primary"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Create job workspace */}
      {isCreateJobOpen ? (
        <section className="space-y-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:rounded-2xl sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
                Create Job Workspace
              </p>
              <h2 className="hr-text-primary font-sans text-lg font-semibold">
                Post escrow-ready client work
              </h2>
            </div>
            <AppButton
              type="button"
              variant="outline"
              className="h-9 rounded-lg px-4 text-xs font-semibold"
              onClick={() => setIsCreateJobOpen(false)}
            >
              Close
            </AppButton>
          </div>
          <CreateJobForm
            onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
          />
        </section>
      ) : null}

      {/* Controls */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search + Sort group */}
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search */}
            <label htmlFor={searchInputId} className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <AppInput
                id={searchInputId}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, description, asset, or wallet"
                className="w-full pr-4 pl-10 font-sans"
              />
            </label>

            {/* Sort */}
            <div className="relative w-full lg:w-50">
              <Select
                value={sortBy}
                onValueChange={(value: TMarketplaceSortOption) => setSortBy(value)}
              >
                <SelectTrigger className="w-full pl-10 font-sans">
                  <Filter className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
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
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 hidden h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            </div>
          </div>

          {/* Filter + Reset */}
          <div className="flex items-center justify-between gap-2 lg:justify-end">
            {/* Filter segmented control */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
              {(["all", "verified_funded"] as TMarketplaceFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 font-mono text-xs tracking-widest whitespace-nowrap uppercase transition-all duration-150 ${
                    filter === f
                      ? "border border-highrable-orange-2 bg-highrable-orange-2 text-white shadow-sm"
                      : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All Jobs" : "Verified Only"}
                </button>
              ))}
            </div>

            <AppButton
              type="button"
              variant="outline"
              className="h-9 rounded-lg px-4 text-xs font-semibold"
              onClick={() => {
                setSearchTerm("");
                setFilter("all");
                setSortBy("safest");
              }}
            >
              Reset view
            </AppButton>
          </div>
        </div>
      </section>

      {applyError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {applyError}
        </p>
      ) : null}

      {/* Feed */}
      <section className="space-y-5">
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Marketplace Feed
          </p>
          <h2 className="hr-text-primary font-sans text-lg font-semibold">
            {visibleRows.length} jobs found
          </h2>
        </div>
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
