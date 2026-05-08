"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api, type TConvexDoc } from "@repo/convex-client";
import { useMutation, useQuery } from "convex/react";
import { Briefcase, Clock3, Filter, Search, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type JobSortOption = "newest" | "budget_high" | "budget_low";
type JobDocument = TConvexDoc<"jobs">;

const JOB_SORTERS: Record<JobSortOption, (left: JobDocument, right: JobDocument) => number> = {
  newest: (left, right) => right.createdAt - left.createdAt,
  budget_high: (left, right) => right.budget - left.budget,
  budget_low: (left, right) => left.budget - right.budget,
};

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
  const jobs = useQuery(api.jobs.listOpenJobs, {});
  const applyToJob = useMutation(api.applications.applyToJob);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<JobSortOption>("newest");
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  const visibleJobs = useMemo(() => {
    if (!jobs) {
      return [];
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return jobs
      .filter((job) => {
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
  }, [jobs, searchTerm, sortBy]);

  const totalBudget = useMemo(() => {
    return visibleJobs.reduce((total, job) => total + job.budget, 0);
  }, [visibleJobs]);

  const handleApply = async (job: JobDocument) => {
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

    const proposal = window.prompt("Write a short proposal");
    if (!proposal?.trim()) {
      return;
    }

    setApplyingJobId(job._id);
    setApplyError(null);
    setApplySuccess(null);

    try {
      await applyToJob({
        jobId: job._id,
        freelancerWallet: walletIdentity.walletAddress,
        proposal: proposal.trim(),
      });
      setApplySuccess(`Application submitted for "${job.title}".`);
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
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-[#B94A00]">
            <Sparkles className="h-4 w-4" />
            Stellar-native freelance work
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-bold tracking-normal text-gray-950 sm:text-5xl">
              Browse Jobs
            </h1>
            <p className="text-base leading-7 text-gray-600 sm:text-lg">
              Find open client work, apply with your wallet, and move accepted work into
              contract-backed escrow when the client selects you.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/post-job"
              className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:from-[#E85D00] hover:to-[#E87A00]"
            >
              Post a Job
            </Link>
            {!walletIdentity.isConnected ? (
              <WalletConnectTrigger className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50" />
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-2xl font-bold text-gray-950">{jobs?.length ?? "-"}</div>
            <div className="mt-1 text-xs font-medium text-gray-500">Open jobs</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-2xl font-bold text-gray-950">{visibleJobs.length}</div>
            <div className="mt-1 text-xs font-medium text-gray-500">Matching</div>
          </div>
          <div className="col-span-2 rounded-xl bg-orange-50 p-4">
            <div className="text-2xl font-bold text-[#B94A00]">{formatBudget(totalBudget)}</div>
            <div className="mt-1 text-xs font-medium text-[#B94A00]/80">Visible budget pool</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by title, description, asset, or wallet"
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pr-3 pl-10 text-sm text-gray-900 outline-hidden transition-colors focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]/20"
            />
          </label>

          <label className="relative block">
            <Filter className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as JobSortOption)}
              className="h-11 w-full appearance-none rounded-lg border border-gray-200 bg-white pr-3 pl-9 text-sm font-medium text-gray-700 outline-hidden transition-colors focus:border-[#FF7003] focus:ring-2 focus:ring-[#FF7003]/20"
            >
              <option value="newest">Newest first</option>
              <option value="budget_high">Highest budget</option>
              <option value="budget_low">Lowest budget</option>
            </select>
          </label>
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
            <h2 className="text-lg font-semibold text-gray-950">{visibleJobs.length} jobs found</h2>
          </div>
          <Link href="/marketplace" className="text-sm font-medium text-[#B94A00] hover:underline">
            Manage marketplace flow
          </Link>
        </div>

        {jobs === undefined ? (
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
            {visibleJobs.map((job) => {
              const canApply =
                !!walletIdentity.walletAddress &&
                !isSameWallet(walletIdentity.walletAddress, job.clientWallet) &&
                job.status === "open";

              return (
                <article
                  key={job._id}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-colors hover:border-orange-200"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={job.status} />
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
                      <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
                        <span className="rounded-full bg-gray-100 px-3 py-1">
                          Client {shortenWalletAddress(job.clientWallet)}
                        </span>
                        <span className="rounded-full bg-gray-100 px-3 py-1 break-all">
                          Asset {shortenWalletAddress(job.asset)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Escrow-ready
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-3 lg:w-48 lg:items-end">
                      <div className="lg:text-right">
                        <div className="text-2xl font-bold text-[#B94A00]">
                          {formatBudget(job.budget)}
                        </div>
                        <div className="text-xs font-medium text-gray-500">Budget</div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Link
                          href={`/marketplace/jobs/${job._id}`}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          Details
                        </Link>
                        {canApply ? (
                          <button
                            type="button"
                            disabled={applyingJobId === job._id}
                            onClick={() => void handleApply(job)}
                            className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {applyingJobId === job._id ? "Applying..." : "Apply"}
                          </button>
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
    </div>
  );
}
