"use client";

import type { TConvexDoc, TConvexId } from "@repo/convex-client";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useState } from "react";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet } from "@/features/marketplace/lib/wallet";

export function ApplyToJobForm({
  job,
  onApplied,
}: {
  job: TConvexDoc<"jobs">;
  onApplied: () => void;
}) {
  const { isConnected, address } = useWallet();
  const applyToJob = useMutation(api.applications.applyToJob);
  const [proposal, setProposal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isJobOpen = job.status === "open";
  const isClient = isSameWallet(address, job.clientWallet);

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="mb-3 text-sm text-gray-700">Connect wallet to apply.</p>
        <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white" />
      </div>
    );
  }

  if (!isJobOpen) {
    return <p className="text-sm text-gray-600">Applications are closed for this job.</p>;
  }

  if (isClient) {
    return <p className="text-sm text-gray-600">Client cannot apply to their own job.</p>;
  }

  const handleApply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!address) {
      setError("Connect wallet to apply.");
      return;
    }

    const sanitizedProposal = proposal.trim();
    if (!sanitizedProposal) {
      setError("Proposal is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await applyToJob({
        jobId: job._id as TConvexId<"jobs">,
        freelancerWallet: address,
        proposal: sanitizedProposal,
      });

      setProposal("");
      onApplied();
    } catch (caughtError) {
      const readableError = getReadableErrorMessage(
        caughtError,
        "Failed to submit application. Please try again.",
      );

      if (readableError.toLowerCase().includes("already applied")) {
        setError("You already applied to this job.");
      } else {
        setError(readableError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleApply} className="rounded-xl border border-gray-200 bg-white p-4">
      <label htmlFor="apply-proposal" className="mb-2 block text-sm font-medium text-gray-700">
        Write a short proposal
      </label>
      <textarea
        id="apply-proposal"
        rows={4}
        value={proposal}
        onChange={(event) => {
          setProposal(event.target.value);
          setError(null);
        }}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FF7003] focus:outline-hidden"
        placeholder="Highlight your relevant experience and timeline"
      />

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Applying..." : "Apply to Job"}
      </button>
    </form>
  );
}
