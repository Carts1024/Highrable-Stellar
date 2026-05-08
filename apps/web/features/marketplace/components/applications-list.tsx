"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useState } from "react";

import type { TConvexDoc, TConvexId } from "@repo/convex-client";

export function ApplicationsList({
  job,
  applications,
  isLoading,
  onSelected,
}: {
  job: TConvexDoc<"jobs">;
  applications: TConvexDoc<"applications">[] | undefined;
  isLoading: boolean;
  onSelected: () => void;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const selectFreelancer = useMutation(api.jobs.selectFreelancer);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectingWallet, setSelectingWallet] = useState<string | null>(null);

  const isClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);
  const canSelectFreelancer = walletIdentity.isConnected && isClient && job.status === "open";

  const handleSelectFreelancer = async (freelancerWallet: string) => {
    if (!walletIdentity.walletAddress) {
      setSelectionError("Connect wallet to select a freelancer.");
      return;
    }

    setSelectionError(null);
    setSelectingWallet(freelancerWallet);

    try {
      await selectFreelancer({
        jobId: job._id as TConvexId<"jobs">,
        clientWallet: walletIdentity.walletAddress,
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
    return <p className="text-sm text-gray-500">Loading applications...</p>;
  }

  if (!applications || applications.length === 0) {
    return <p className="text-sm text-gray-600">No applications yet.</p>;
  }

  return (
    <div className="space-y-3">
      {applications.map((application) => (
        <article key={application._id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                {shortenWalletAddress(application.freelancerWallet)}
              </p>
              <p className="text-xs text-gray-500">
                Applied {new Date(application.createdAt).toLocaleString()}
              </p>
            </div>
            {canSelectFreelancer ? (
              <button
                type="button"
                onClick={() => void handleSelectFreelancer(application.freelancerWallet)}
                disabled={selectingWallet === application.freelancerWallet}
                className="rounded-lg border border-[#FF7003] px-3 py-2 text-xs font-semibold text-[#FF7003] transition-colors hover:bg-[#FF7003]/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectingWallet === application.freelancerWallet
                  ? "Selecting..."
                  : "Select Freelancer"}
              </button>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-gray-700">{application.proposal}</p>
        </article>
      ))}

      {selectionError ? <p className="text-sm text-red-600">{selectionError}</p> : null}
    </div>
  );
}
