"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation } from "convex/react";
import { useState } from "react";

import type { TConvexDoc, TConvexId } from "@repo/convex-client";

interface IApplicationsListProps {
  readonly job: TConvexDoc<"jobs">;
  readonly applications: TConvexDoc<"applications">[] | undefined;
  readonly isLoading: boolean;
  readonly onSelected: () => void;
}

export function ApplicationsList({
  job,
  applications,
  isLoading,
  onSelected,
}: IApplicationsListProps) {
  const { address, isConnected } = useWallet();
  const selectFreelancer = useMutation(api.jobs.selectFreelancer);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectingWallet, setSelectingWallet] = useState<string | null>(null);

  const isClient = isSameWallet(address, job.clientWallet);
  const canSelectFreelancer = isConnected && isClient && job.status === "open";
  const applicationCount = applications?.length ?? 0;

  const handleSelectFreelancer = async (freelancerWallet: string) => {
    if (!address) {
      setSelectionError("Connect your wallet to select a freelancer.");
      return;
    }

    setSelectionError(null);
    setSelectingWallet(freelancerWallet);

    try {
      await selectFreelancer({
        jobId: job._id as TConvexId<"jobs">,
        clientWallet: address,
        freelancerWallet,
      });
      onSelected();
    } catch (error) {
      setSelectionError(
        getReadableErrorMessage(error, "Failed to select freelancer. Please try again."),
      );
    } finally {
      setSelectingWallet(null);
    }
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading applications"
        className="text-sm text-[#7f7f7f]"
      >
        Loading applications...
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <p
        className="rounded-xl border border-dashed border-[#e8e8e8] bg-[#f5f5f5] p-4 text-sm text-[#5f5f5f]"
        role="status"
      >
        No applications yet. Freelancers can apply once you post the job.
      </p>
    );
  }

  return (
    <div
      className="space-y-3"
      role="region"
      aria-label={`Freelancer applications (${applicationCount})`}
    >
      {applications.map((application) => (
        <article
          key={application._id}
          className="rounded-xl border border-[#e8e8e8] bg-white p-4 transition-colors focus-within:ring-2 focus-within:ring-[#FF7003]/50 hover:border-[#FF7003]/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0a0a0a]">
                {shortenWalletAddress(application.freelancerWallet)}
              </p>
              <p
                className="font-mono text-[0.65rem] tracking-[0.06em] text-[#7f7f7f] uppercase"
                role="doc-subtitle"
              >
                Applied {new Date(application.createdAt).toLocaleString()}
              </p>
            </div>

            {canSelectFreelancer ? (
              <AppButton
                type="button"
                onClick={() => void handleSelectFreelancer(application.freelancerWallet)}
                disabled={selectingWallet === application.freelancerWallet}
                variant="secondary"
                className="h-8 border-[#FF7003] px-3 py-2 text-xs font-semibold text-[#FF7003] hover:bg-[#FF7003]/5 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Select ${shortenWalletAddress(application.freelancerWallet)} as freelancer for ${job.title}`}
                aria-busy={selectingWallet === application.freelancerWallet}
              >
                {selectingWallet === application.freelancerWallet ? "Selecting..." : "Select"}
              </AppButton>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[#5f5f5f]">{application.proposal}</p>
        </article>
      ))}

      {selectionError ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
          aria-atomic="true"
        >
          {selectionError}
        </div>
      ) : null}
    </div>
  );
}
