"use client";

import { AppButton } from "@/core/ui/button";
import { AppTextarea } from "@/core/ui/textarea";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { sanitizeMultilineInput } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { useState } from "react";
import { z } from "zod";

import type { TConvexDoc, TConvexId } from "@repo/convex-client";

const APPLY_PROPOSAL_SCHEMA = z
  .string()
  .transform(sanitizeMultilineInput)
  .pipe(z.string().min(10, "Proposal is required and must be at least 10 characters."))
  .pipe(z.string().max(1000, "Proposal must be under 1000 characters."));

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

    const parsedProposal = APPLY_PROPOSAL_SCHEMA.safeParse(proposal);
    if (!parsedProposal.success) {
      setError(parsedProposal.error.issues[0]?.message ?? "Proposal is invalid.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await applyToJob({
        jobId: job._id as TConvexId<"jobs">,
        freelancerWallet: address,
        proposal: parsedProposal.data,
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
      <AppTextarea
        id="apply-proposal"
        rows={4}
        value={proposal}
        maxLength={1200}
        onChange={(event) => {
          setProposal(event.target.value);
          setError(null);
        }}
        placeholder="Highlight your relevant experience and timeline"
      />

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <AppButton
        type="submit"
        disabled={isSubmitting}
        className="mt-3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Applying..." : "Apply to Job"}
      </AppButton>
    </form>
  );
}
