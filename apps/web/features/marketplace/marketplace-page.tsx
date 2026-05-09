"use client";

import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { ProductPageHero } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CreateJobForm } from "./components/create-job-form";
import { JobApplicationDialog } from "./components/job-application-dialog";
import { JobList } from "./components/job-list";

export function MarketplacePage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const jobs = useQuery(api.jobs.listOpenJobs, {});
  const applyToJob = useMutation(api.applications.applyToJob);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [selectedJobForApplyId, setSelectedJobForApplyId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const selectedJobForApply = jobs?.find((job) => job._id === selectedJobForApplyId) ?? null;

  const openApplyDialogFromList = (jobId: string) => {
    if (!address || !jobs) {
      return;
    }

    const selectedJob = jobs.find((job) => job._id === jobId);
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
        <h2 className="text-xl font-semibold text-gray-900">Open Jobs</h2>
        <JobList
          jobs={jobs}
          connectedWallet={address}
          onApply={openApplyDialogFromList}
          applyingJobId={applyingJobId}
        />
      </section>

      <JobApplicationDialog
        isOpen={!!selectedJobForApply}
        isSubmitting={!!applyingJobId}
        jobTitle={selectedJobForApply?.title ?? "this job"}
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
