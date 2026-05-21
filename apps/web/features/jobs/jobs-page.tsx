"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { ProductPageHero } from "@/features/common";
import { JobApplicationDialog } from "@/features/marketplace/components/job-application-dialog";
import { JobSafetyBadge } from "@/features/marketplace/components/job-safety-badge";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { TrustSafetyNotice } from "@/features/marketplace/components/trust-safety-notice";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  compareJobsBySafetyThenNewest,
  getApplicationTrustSafetyNoticeType,
  getJobSafetySortRank,
  getJobSafetyStatus,
} from "@/features/marketplace/lib/job-safety";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { Briefcase, Clock3, Filter, Search, ShieldCheck } from "lucide-react";
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
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
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
              <AppButton asChild>
                <Link href="/post-job">Post a Job</Link>
              </AppButton>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
          <div className="rounded-xl bg-[#f5f5f5] p-4">
            <div className="text-2xl font-bold text-[#0a0a0a]">
              {marketplaceRows?.length ?? "-"}
            </div>
            <div className="mt-1 font-mono text-[0.65rem] tracking-[0.06em] text-[#7f7f7f] uppercase">
              Active jobs
            </div>
          </div>
          <div className="rounded-xl bg-[#f5f5f5] p-4">
            <div className="text-2xl font-bold text-[#0a0a0a]">{visibleJobs.length}</div>
            <div className="mt-1 font-mono text-[0.65rem] tracking-[0.06em] text-[#7f7f7f] uppercase">
              Matching
            </div>
          </div>
          <div className="col-span-2 rounded-xl bg-[#fff7ed] p-4">
            <div className="text-2xl font-bold text-[#B94A00]">{formatBudget(totalBudget)}</div>
            <div className="mt-1 font-mono text-[0.65rem] tracking-[0.06em] text-[#B94A00]/80 uppercase">
              Visible budget pool
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e8e8e8] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label htmlFor={searchInputId} className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <AppInput
              id={searchInputId}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, description, asset, or wallet"
              className="pr-3 pl-10"
            />
          </label>

          <label htmlFor={sortSelectId} className="relative block">
            <Filter className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              id={sortSelectId}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as TJobSortOption)}
              className="h-11 w-full appearance-none rounded-lg border border-[#e8e8e8] bg-white pr-3 pl-9 text-sm font-medium text-[#5f5f5f] outline-hidden transition-colors focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]/20"
            >
              <option value="safest">Safest first</option>
              <option value="budget_high">Highest budget</option>
              <option value="budget_low">Lowest budget</option>
            </select>
          </label>
        </div>
        <div className="mt-3 inline-flex rounded-lg border border-[#e8e8e8] bg-white p-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              filter === "all" ? "bg-[#0a0a0a] text-white" : "text-[#5f5f5f]"
            }`}
          >
            All active jobs
          </button>
          <button
            type="button"
            onClick={() => setFilter("verified_funded")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
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
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#FF7003]" />
            <h2 className="text-lg font-semibold text-[#0a0a0a]">
              {visibleJobs.length} jobs found
            </h2>
          </div>
          <Link
            href="/marketplace"
            className="font-mono text-xs tracking-[0.06em] text-[#B94A00] uppercase hover:underline"
          >
            Manage marketplace flow
          </Link>
        </div>

        {marketplaceRows === undefined ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-2xl border border-gray-100 bg-gray-50"
              />
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <Briefcase className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No matching jobs</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              Try a broader search or check back after new clients post opportunities.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
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
                  className="rounded-2xl border border-[#e8e8e8] bg-white p-5 transition-colors hover:border-[#FF7003]/40 hover:shadow-[5.67px_5.67px_0px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <JobSafetyBadge status={safetyStatus.status} />
                        <StatusBadge label={escrow?.status ?? job.status} />
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
                      {safetyStatus.status === "unfunded" ? (
                        <TrustSafetyNotice type="unfunded" compact />
                      ) : null}
                      {safetyStatus.status === "verified_funded" ? (
                        <TrustSafetyNotice type="verified_funded" compact />
                      ) : null}
                      <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
                        <span className="rounded-full bg-gray-100 px-3 py-1">
                          {isMilestoneProject ? "Milestone Project" : "Micro Gig"}
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1">
                          Client{" "}
                          <Link
                            href={`/clients/${encodeURIComponent(job.clientWallet)}`}
                            className="hover:text-[#FF7003]"
                          >
                            {shortenWalletAddress(job.clientWallet)}
                          </Link>
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 break-all">
                          Asset {shortenWalletAddress(job.asset)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {isMilestoneProject ? "Milestone escrow-ready" : "Escrow-ready"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:w-48 lg:items-end">
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
                          className="rounded-lg border border-[#e8e8e8] px-4 py-2 text-sm font-semibold text-[#5f5f5f] transition-colors hover:bg-[#f5f5f5]"
                        >
                          Details
                        </Link>
                        {canApply ? (
                          <AppButton
                            type="button"
                            disabled={applyingJobId === job._id}
                            onClick={() => openApplyDialog(row)}
                            className="px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
