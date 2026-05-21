"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ProductPageHero } from "@/features/common";
import { JobApplicationDialog } from "@/features/marketplace/components/job-application-dialog";
import { JobSafetyBadge } from "@/features/marketplace/components/job-safety-badge";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  compareJobsBySafetyThenNewest,
  getApplicationTrustSafetyNoticeType,
  getJobSafetyLabel,
  getJobSafetySortRank,
  getJobSafetyStatus,
} from "@/features/marketplace/lib/job-safety";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import {
  HighrableV2Bullet,
  HighrableV2IconNotice,
  HighrableV2Metric,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, Briefcase, Clock3, Filter, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { TMarketplaceJobRow } from "@/features/marketplace/types";

type TJobSortOption = "safest" | "budget_high" | "budget_low";
type TMarketplaceFilter = "all" | "verified_funded";

const JOB_SORTERS: Record<
  TJobSortOption,
  (left: TMarketplaceJobRow, right: TMarketplaceJobRow) => number
> = {
  safest: compareJobsBySafetyThenNewest,
  budget_high: (left, right) =>
    compareSafetyRankOnly(left, right) || right.job.budget - left.job.budget,
  budget_low: (left, right) =>
    compareSafetyRankOnly(left, right) || left.job.budget - right.job.budget,
};

function compareSafetyRankOnly(left: TMarketplaceJobRow, right: TMarketplaceJobRow): number {
  return (
    getJobSafetySortRank(getJobSafetyStatus(left).status) -
    getJobSafetySortRank(getJobSafetyStatus(right).status)
  );
}

function formatPostedAt(createdAt: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(createdAt));
}

function formatBudget(budget: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(budget);
}

/** Renders the dedicated public job browsing experience backed by Convex jobs. */
export function JobsPage() {
  const walletIdentity = useHighrableWalletIdentity();
  const marketplaceRows = useQuery(api.jobs.listMarketplaceJobs, {});
  const applyToJob = useMutation(api.applications.applyToJob);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<TJobSortOption>("safest");
  const [filter, setFilter] = useState<TMarketplaceFilter>("all");
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [selectedJobForApply, setSelectedJobForApply] = useState<TMarketplaceJobRow | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const searchInputId = "jobs-search-input";
  const sortSelectId = "jobs-sort-select";

  const visibleJobs = useMemo(() => {
    if (!marketplaceRows) {
      return [];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return marketplaceRows
      .filter((row) => {
        const job = row.job;
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
      .sort(JOB_SORTERS[sortBy]);
  }, [marketplaceRows, searchTerm, sortBy, filter]);

  const totalBudget = useMemo(() => {
    return visibleJobs.reduce((total, row) => total + row.job.budget, 0);
  }, [visibleJobs]);

  const openApplyDialog = (row: TMarketplaceJobRow) => {
    const { job } = row;
    if (!walletIdentity.walletAddress || !walletIdentity.isConnected) {
      setApplyError("Connect your wallet to apply for jobs.");
      setApplySuccess(null);
      return;
    }

    if (isSameWallet(job.clientWallet, walletIdentity.walletAddress)) {
      setApplyError("Client cannot apply to their own job.");
      setApplySuccess(null);
      return;
    }

    setApplyError(null);
    setSelectedJobForApply(row);
  };

  const handleApply = async (proposal: string, showcasedWorkEscrowId: string | null) => {
    if (!selectedJobForApply || !walletIdentity.walletAddress || !walletIdentity.isConnected) {
      return;
    }

    setApplyingJobId(selectedJobForApply.job._id);
    setApplyError(null);
    setApplySuccess(null);

    try {
      await applyToJob({
        jobId: selectedJobForApply.job._id,
        freelancerWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        ...(showcasedWorkEscrowId ? { showcasedWorkEscrowId } : {}),
        proposal,
      });
      setApplySuccess(`Application submitted for "${selectedJobForApply.job.title}".`);
      setSelectedJobForApply(null);
    } catch (error) {
      const readableError = getReadableErrorMessage(
        error,
        "Failed to apply to this job. Please try again.",
      );
      setApplyError(
        readableError.toLowerCase().includes("already applied")
          ? "You already applied to this job."
          : readableError,
      );
    } finally {
      setApplyingJobId(null);
    }
  };

  return (
    <div className="space-y-10">
      <section className="grid gap-8 border-b border-[#e8e8e8] pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <ProductPageHero
          label="Open Opportunities"
          title={
            <>
              Browse Jobs <span className="text-[#FF7003]">with Escrow-Ready Terms</span>
            </>
          }
          description="Find open client work, apply with your wallet, and move accepted work into contract-backed escrow once selected."
          actions={
            <>
              <AppButton asChild className="hr-v2-button-primary rounded-none">
                <Link href="/post-job">Post a Job</Link>
              </AppButton>
            </>
          }
        />

        <div className="grid gap-5 border-l border-[#e8e8e8] py-2">
          <HighrableV2Metric label="Active jobs" value={marketplaceRows?.length ?? "-"} />
          <HighrableV2Metric label="Matching" value={visibleJobs.length} />
          <HighrableV2Metric
            label="Visible budget pool"
            value={formatBudget(totalBudget)}
            className="text-[#B94A00]"
          />
        </div>
      </section>

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
              onChange={(event) => setSortBy(event.target.value as TJobSortOption)}
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
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {applyError}
        </p>
      ) : null}
      {applySuccess ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {applySuccess}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <SectionLabel>Marketplace Feed</SectionLabel>
            <h2 className="text-lg font-semibold text-[#0a0a0a]">
              {visibleJobs.length} jobs found
            </h2>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1 font-mono text-xs tracking-[0.06em] text-[#B94A00] uppercase hover:underline"
          >
            Manage marketplace flow
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {marketplaceRows === undefined ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-36 animate-pulse border border-gray-100 bg-gray-50" />
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="border border-dashed border-gray-300 bg-white p-10 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No matching jobs</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              Try a broader search or check back after new clients post opportunities.
            </p>
          </div>
        ) : (
          <div className="border-y border-[#e8e8e8]">
            {visibleJobs.map((row) => {
              const { job, escrow } = row;
              const isMilestoneProject = (job.jobType ?? "micro_gig") === "milestone_project";
              const canApply =
                !isMilestoneProject &&
                !!walletIdentity.walletAddress &&
                !isSameWallet(walletIdentity.walletAddress, job.clientWallet) &&
                (job.status === "open" ||
                  (job.status === "funded" && !job.selectedFreelancerWallet));
              const safetyStatus = getJobSafetyStatus(row);

              return (
                <article
                  key={job._id}
                  className="group border-b border-[#e8e8e8] bg-white px-1 py-5 transition-colors last:border-b-0 hover:bg-[#fff7ed]/40 sm:px-4"
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <JobSafetyBadge status={safetyStatus.status} />
                        {getJobSafetyLabel(safetyStatus.status) !==
                        getMarketplaceStatusMeta(escrow?.status ?? job.status).label ? (
                          <StatusBadge label={escrow?.status ?? job.status} />
                        ) : null}
                        {safetyStatus.status === "unfunded" ? (
                          <HighrableV2IconNotice
                            label="Unfunded job warning"
                            tone="warning"
                            message="This job has not been funded yet. Confirm escrow before starting work."
                          />
                        ) : null}
                        {safetyStatus.status === "verified_funded" ? (
                          <HighrableV2IconNotice
                            label="Verified funded job"
                            tone="success"
                            message="Escrow funding is verified for this job."
                          />
                        ) : null}
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          Posted {formatPostedAt(job.createdAt)}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-950">{job.title}</h3>
                        <p className="mt-2 line-clamp-3 max-w-3xl text-sm leading-6 text-gray-600">
                          {job.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-gray-600">
                        <span className="inline-flex items-center gap-2">
                          <HighrableV2Bullet tone="muted" />
                          {isMilestoneProject ? "Milestone Project" : "Micro Gig"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <HighrableV2Bullet tone="muted" />
                          Client{" "}
                          <Link
                            href={`/clients/${encodeURIComponent(job.clientWallet)}`}
                            className="hover:text-[#FF7003]"
                          >
                            {shortenWalletAddress(job.clientWallet)}
                          </Link>
                        </span>
                        <span className="inline-flex items-center gap-2 break-all">
                          <HighrableV2Bullet tone="muted" />
                          Asset {shortenWalletAddress(job.asset)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {isMilestoneProject ? "Milestone escrow-ready" : "Escrow-ready"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:items-end">
                      <div className="lg:text-right">
                        <div className="text-2xl font-bold text-[#B94A00]">
                          {formatBudget(job.totalBudget ?? job.budget)}
                        </div>
                        <div className="text-xs font-medium text-gray-500">
                          {isMilestoneProject ? "Total budget" : "Budget"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/marketplace/jobs/${job._id}`}
                          className="border border-[#e8e8e8] px-4 py-2 text-sm font-semibold text-[#5f5f5f] transition-colors hover:bg-white"
                        >
                          Details
                        </Link>
                        {canApply ? (
                          <AppButton
                            type="button"
                            disabled={applyingJobId === job._id}
                            onClick={() => openApplyDialog(row)}
                            className="hr-v2-button-primary rounded-none px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {applyingJobId === job._id ? "Applying..." : "Apply"}
                          </AppButton>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <JobApplicationDialog
        isOpen={!!selectedJobForApply}
        isSubmitting={!!applyingJobId}
        jobTitle={selectedJobForApply?.job.title ?? "this job"}
        trustSafetyNoticeType={getApplicationTrustSafetyNoticeType(
          selectedJobForApply ? getJobSafetyStatus(selectedJobForApply).status : "unfunded",
        )}
        errorMessage={applyError}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedJobForApply(null);
            setApplyError(null);
          }
        }}
        onSubmit={handleApply}
      />
    </div>
  );
}
