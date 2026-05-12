"use client";

import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { ProductPageHero } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import {
  compareJobsBySafetyThenNewest,
  getApplicationTrustSafetyNoticeType,
  getJobSafetyStatus,
} from "@/features/marketplace/lib/job-safety";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CreateJobForm } from "./components/create-job-form";
import { JobApplicationDialog } from "./components/job-application-dialog";
import { JobList } from "./components/job-list";

type TMarketplaceFilter = "all" | "verified_funded";

export function MarketplacePage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const marketplaceRows = useQuery(api.jobs.listMarketplaceJobs, {});
  const applyToJob = useMutation(api.applications.applyToJob);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [selectedJobForApplyId, setSelectedJobForApplyId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TMarketplaceFilter>("all");

  const visibleRows = useMemo(() => {
    if (!marketplaceRows) {
      return marketplaceRows;
    }

    return marketplaceRows
      .filter((row) => {
        const safetyStatus = getJobSafetyStatus(row);
        return filter === "all" || safetyStatus.status === "verified_funded";
      })
      .sort(compareJobsBySafetyThenNewest);
  }, [marketplaceRows, filter]);

  const selectedRowForApply =
    marketplaceRows?.find((row) => row.job._id === selectedJobForApplyId) ?? null;
  const selectedJobForApply = selectedRowForApply?.job ?? null;

  const openApplyDialogFromList = (jobId: string) => {
    if (!address || !marketplaceRows) {
      return;
    }

    const selectedJob = marketplaceRows.find((row) => row.job._id === jobId)?.job;
    if (!selectedJob) {
      return;
    }

    if (isSameWallet(selectedJob.clientWallet, address)) {
      setApplyError("Client cannot apply to their own job.");
      return;
    }

    setApplyError(null);
    setSelectedJobForApplyId(jobId);
  };

  const handleApplyFromList = async (proposal: string) => {
    if (!address || !selectedJobForApply) {
      return;
    }

    setApplyingJobId(selectedJobForApply._id);
    setApplyError(null);

    try {
      await applyToJob({
        jobId: selectedJobForApply._id,
        freelancerWallet: address,
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
    <div className="space-y-6">
      <ProductPageHero
        label="Marketplace Workflow"
        title={
          <>
            Marketplace <span className="text-[#FF7003]">for Escrow-backed Collaboration</span>
          </>
        }
        description="Wallet connect, client posting, freelancer applications, and selection all flow into escrow actions that drive on-chain execution."
      />

      {isConnected ? <WalletStatusCard /> : null}

      <CreateJobForm
        onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
      />

      {applyError ? <p className="text-sm text-red-600">{applyError}</p> : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Active Marketplace Jobs</h2>
          <div className="inline-flex rounded-lg border border-[#e8e8e8] bg-white p-1">
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
        </div>
        <JobList
          jobs={visibleRows}
          connectedWallet={address}
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
