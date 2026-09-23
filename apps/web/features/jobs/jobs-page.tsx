"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  ProductPageHero,
  RouteEmptyState,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "@/features/common";
import { JobApplicationDialog } from "@/features/marketplace/components/job-application-dialog";
import { JobSafetyBadge } from "@/features/marketplace/components/job-safety-badge";
import { StatusBadge } from "@/features/marketplace/components/status-badge";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import {
  compareJobsBySafetyThenNewest,
  getApplicationTrustSafetyNoticeType,
  getJobSafetyLabel,
  getJobSafetySortRank,
  getJobSafetyStatus,
} from "@/features/marketplace/lib/job-safety";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Briefcase,
  Clock,
  Coins,
  Filter,
  Search,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { TMarketplaceJobRow } from "@/features/marketplace/types";

type TJobSortOption = "safest" | "budget_high" | "budget_low";
type TMarketplaceFilter = "all" | "verified_funded";

const SORT_OPTIONS = [
  { value: "safest", label: "Safest first" },
  { value: "budget_high", label: "Highest budget" },
  { value: "budget_low", label: "Lowest budget" },
] as const;

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
  const appliedJobIds = useQuery(
    api.applications.listAppliedJobIdsByFreelancer,
    walletIdentity.walletAddress ? { freelancerWallet: walletIdentity.walletAddress } : "skip",
  );
  const applyToJob = useMutation(api.applications.applyToJob);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<TJobSortOption>("safest");
  const [filter, setFilter] = useState<TMarketplaceFilter>("all");
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [selectedJobForApply, setSelectedJobForApply] = useState<TMarketplaceJobRow | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const visibleJobs = useMemo(() => {
    if (!marketplaceRows) return [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return marketplaceRows
      .filter((row) => {
        const job = row.job;
        const safetyStatus = getJobSafetyStatus(row);
        if (filter === "verified_funded" && safetyStatus.status !== "verified_funded") return false;
        if (!normalizedSearch) return true;
        return (
          job.title.toLowerCase().includes(normalizedSearch) ||
          job.description.toLowerCase().includes(normalizedSearch) ||
          job.asset.toLowerCase().includes(normalizedSearch) ||
          job.clientWallet.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort(JOB_SORTERS[sortBy]);
  }, [marketplaceRows, searchTerm, sortBy, filter]);

  const totalBudget = useMemo(
    () => visibleJobs.reduce((total, row) => total + row.job.budget, 0),
    [visibleJobs],
  );

  const appliedJobIdSet = useMemo(() => {
    if (!walletIdentity.walletAddress) return new Set<string>();
    return appliedJobIds ? new Set<string>(appliedJobIds) : undefined;
  }, [appliedJobIds, walletIdentity.walletAddress]);

  const openApplyDialog = (row: TMarketplaceJobRow) => {
    const { job } = row;
    if (!walletIdentity.walletAddress || !walletIdentity.isConnected) {
      showWarningToast("Connect your wallet to apply for jobs.");
      return;
    }

    if (isSameWallet(job.clientWallet, walletIdentity.walletAddress)) {
      showWarningToast("Client cannot apply to their own job.");
      return;
    }

    if (appliedJobIdSet?.has(job._id)) {
      showWarningToast("You already applied to this job.");
      return;
    }
    setApplyError(null);
    setSelectedJobForApply(row);
  };

  const handleApply = async (proposal: string, showcasedWorkEscrowId: string | null) => {
    if (!selectedJobForApply || !walletIdentity.walletAddress || !walletIdentity.isConnected)
      return;
    setApplyingJobId(selectedJobForApply.job._id);
    setApplyError(null);

    try {
      await applyToJob({
        jobId: selectedJobForApply.job._id,
        freelancerWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        ...(showcasedWorkEscrowId ? { showcasedWorkEscrowId } : {}),
        proposal,
      });
      showSuccessToast(`Application submitted for "${selectedJobForApply.job.title}".`);
      setSelectedJobForApply(null);
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
          label="Open Opportunities"
          title={
            <>
              Browse Jobs <span className="text-[#FF7003]">with Escrow-Ready Terms</span>
            </>
          }
          description="Find open client work, apply with your wallet, and move accepted work into contract-backed escrow once selected."
          actions={
            <>
              <AppButton asChild className="hr-v2-button-primary rounded-lg px-6 font-mono">
                <Link href="/post-job">Post a Job</Link>
              </AppButton>
            </>
          }
        />

        {/* Metric panel */}
        <div className="flex flex-col gap-0 divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
          {[
            { label: "Active jobs", value: marketplaceRows?.length ?? "—" },
            { label: "Matching", value: visibleJobs.length },
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

      {/* Controls */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search + Sort group */}
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search */}
            <label htmlFor="job-search" className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <AppInput
                id="job-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search jobs, assets, wallets…"
                className="w-full pr-4 pl-10 font-sans"
              />
            </label>

            {/* Sort */}
            <div className="relative w-full lg:w-50">
              <Select value={sortBy} onValueChange={(value: TJobSortOption) => setSortBy(value)}>
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
            </div>
          </div>

          {/* Filter + Quick actions */}
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
          </div>
        </div>
      </section>

      {/* Feed */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
              Marketplace Feed
            </p>
            <h2 className="hr-text-primary font-sans text-lg font-semibold">
              {visibleJobs.length} jobs found
            </h2>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.06em] text-highrable-orange-3 uppercase hover:underline"
          >
            Manage marketplace flow
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Loading skeletons */}
        {marketplaceRows === undefined ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl border border-border/60 bg-muted/30"
              />
            ))}
          </div>
        ) : visibleJobs.length === 0 ? (
          <RouteEmptyState
            icon={<Briefcase className="h-10 w-10" />}
            title="No matching jobs"
            description="Try a broader search or check back after new clients post opportunities."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {visibleJobs.map((row) => {
              const { job, escrow } = row;
              const isMilestoneProject = (job.jobType ?? "micro_gig") === "milestone_project";
              const isCheckingApplicationStatus =
                !!walletIdentity.walletAddress && appliedJobIdSet === undefined;
              const hasApplied = appliedJobIdSet?.has(job._id) ?? false;
              const canApply =
                !isMilestoneProject &&
                !!walletIdentity.walletAddress &&
                !hasApplied &&
                !isCheckingApplicationStatus &&
                !isSameWallet(walletIdentity.walletAddress, job.clientWallet) &&
                (job.status === "open" ||
                  (job.status === "funded" && !job.selectedFreelancerWallet));
              const safetyStatus = getJobSafetyStatus(row);
              const isUnfunded = safetyStatus.status === "unfunded";
              const isVerifiedFunded = safetyStatus.status === "verified_funded";

              return (
                <article
                  key={job._id}
                  className="group border-borderbg-card flex flex-col overflow-hidden rounded-xl border shadow-none transition-all duration-200 hover:border-highrable-orange-3/30 hover:shadow-sm"
                >
                  {/* Card header */}
                  <div className="flex flex-col gap-3 p-6 pb-4">
                    {/* Badge row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isUnfunded ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-default">
                                <JobSafetyBadge status={safetyStatus.status} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              tone="neutral"
                              className="max-w-xs text-sm leading-relaxed"
                            >
                              This job has not been funded yet. Confirm escrow before starting work.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <JobSafetyBadge status={safetyStatus.status} />
                      )}

                      {getJobSafetyLabel(safetyStatus.status) !==
                        getMarketplaceStatusMeta(escrow?.status ?? job.status).label && (
                        <StatusBadge label={escrow?.status ?? job.status} />
                      )}

                      {isMilestoneProject && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          Milestone Project
                        </span>
                      )}

                      {isVerifiedFunded && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Escrow Verified
                        </span>
                      )}

                      <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/60">
                        <Clock className="h-3 w-3" />
                        {formatPostedAt(job.createdAt)}
                      </span>
                    </div>

                    {/* Title + budget */}
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <h3 className="hr-text-primary text-xl leading-snug font-bold transition-colors group-hover:text-highrable-orange-3">
                        {job.title}
                      </h3>
                      <div className="shrink-0 text-right">
                        <p className="font-sans text-2xl leading-none font-bold tracking-tight text-highrable-orange-3">
                          {formatBudget(job.totalBudget ?? job.budget)}
                        </p>
                        <p className="mt-1 font-mono text-[11px] tracking-[0.08em] text-muted-foreground/60 uppercase">
                          {isMilestoneProject ? "Total Budget" : "Budget"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="px-6 pb-5">
                    <p className="hr-text-secondary max-w-3xl text-sm leading-relaxed whitespace-pre-line">
                      {job.description}
                    </p>
                  </div>

                  {/* Meta strip */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border/80 bg-muted/50 px-6 py-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                        Type
                      </span>
                      <span className="font-semibold text-foreground">
                        {isMilestoneProject ? "Milestone Project" : "Micro Gig"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                        Client
                      </span>
                      <Link
                        href={`/clients/${encodeURIComponent(job.clientWallet)}`}
                        className="font-semibold text-foreground transition-colors hover:text-highrable-orange-3 hover:underline"
                      >
                        {shortenWalletAddress(job.clientWallet)}
                      </Link>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="font-mono text-[11px] tracking-wide text-muted-foreground/50 uppercase">
                        Asset
                      </span>
                      <span className="max-w-30 truncate font-semibold text-foreground sm:max-w-none">
                        {shortenWalletAddress(job.asset)}
                      </span>
                    </div>

                    <div className="ml-auto flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      {isMilestoneProject ? "Milestone escrow-ready" : "Escrow-ready"}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex justify-end gap-2.5 border-t border-border/40 px-6 py-4">
                    <AppButton
                      asChild
                      variant="outline"
                      className="h-9 rounded-lg px-4 text-xs font-semibold hover:bg-muted/60"
                    >
                      <Link href={`/marketplace/jobs/${job._id}`}>Details</Link>
                    </AppButton>

                    {canApply && (
                      <AppButton
                        type="button"
                        disabled={applyingJobId === job._id}
                        onClick={() => openApplyDialog(row)}
                        className="hr-v2-button-primary h-9 gap-2 rounded-lg px-5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {applyingJobId === job._id ? "Applying…" : "Apply Now"}
                      </AppButton>
                    )}
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
