"use client";

import { WalletIdentityCard } from "@/core/wallet/components/wallet-identity-card";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CreateJobForm } from "./components/create-job-form";
import { JobList } from "./components/job-list";

export function MarketplacePage() {
  const router = useRouter();
  const { walletAddress } = useHighrableWalletIdentity();
  const jobs = useQuery(api.jobs.listOpenJobs, {});
  const applyToJob = useMutation(api.applications.applyToJob);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleApplyFromList = async (jobId: string) => {
    if (!walletAddress || !jobs) {
      return;
    }

    const selectedJob = jobs.find((job) => job._id === jobId);
    if (!selectedJob) {
      return;
    }

    if (isSameWallet(selectedJob.clientWallet, walletAddress)) {
      setApplyError("Client cannot apply to their own job.");
      return;
    }

    const proposal = window.prompt("Write a short proposal");
    if (!proposal?.trim()) {
      return;
    }

    setApplyingJobId(jobId);
    setApplyError(null);

    try {
      await applyToJob({
        jobId: selectedJob._id,
        freelancerWallet: walletAddress,
        proposal: proposal.trim(),
      });
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
      <section className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Wallet connect → Client creates a job → Freelancer applies → Client selects freelancer →
          Escrow action panel guides the next on-chain step.
        </p>
      </section>

      <WalletIdentityCard />

      <CreateJobForm
        onCreated={(createdJobId) => router.push(`/marketplace/jobs/${createdJobId}`)}
      />

      {applyError ? <p className="text-sm text-red-600">{applyError}</p> : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Open Jobs</h2>
        <JobList
          jobs={jobs}
          connectedWallet={walletAddress}
          onApply={(jobId) => void handleApplyFromList(jobId)}
          applyingJobId={applyingJobId}
        />
      </section>
    </div>
  );
}
