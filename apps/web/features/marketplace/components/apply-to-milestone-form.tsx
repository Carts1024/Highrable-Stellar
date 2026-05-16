"use client";

import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { sanitizeMultilineInput } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Textarea as AppTextarea } from "@repo/ui/components/ui/textarea";
import { useMutation } from "convex/react";
import { useState } from "react";
import { z } from "zod";

import type { TMilestoneApplicationGate } from "../types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

const APPLY_PROPOSAL_SCHEMA = z
  .string()
  .transform(sanitizeMultilineInput)
  .pipe(z.string().min(10, "Proposal is required and must be at least 10 characters."))
  .pipe(z.string().max(1000, "Proposal must be under 1000 characters."));

export function ApplyToMilestoneForm({
  job,
  milestone,
  applicationGate,
  applications,
}: {
  job: TConvexDoc<"jobs">;
  milestone: TConvexDoc<"milestones">;
  applicationGate: TMilestoneApplicationGate;
  applications: TConvexDoc<"applications">[];
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const applyToMilestone = useMutation(api.applications.applyToMilestone);
  const [proposal, setProposal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);
  const hasApplied = applications.some((application) =>
    isSameWallet(application.freelancerWallet, walletIdentity.walletAddress),
  );
  const canApply = milestone.status === "open" && applicationGate.canApply;

  if (!canApply) {
    return <p className="text-sm text-gray-600">{applicationGate.message}</p>;
  }

  if (!walletIdentity.isConnected) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="mb-2 text-sm text-gray-700">Connect wallet to apply to this milestone.</p>
        <WalletConnectTrigger className="rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-3 py-2 text-sm font-medium text-white" />
      </div>
    );
  }

  if (isClient) {
    return <p className="text-sm text-gray-600">Client cannot apply to their own milestone.</p>;
  }

  if (hasApplied) {
    return <p className="text-sm text-emerald-700">You already applied to this milestone.</p>;
  }

  const handleApply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletIdentity.walletAddress) {
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
      await applyToMilestone({
        jobId: job._id as TConvexId<"jobs">,
        milestoneId: milestone._id as TConvexId<"milestones">,
        freelancerWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        proposal: parsedProposal.data,
      });
      setProposal("");
    } catch (caughtError) {
      setError(getReadableErrorMessage(caughtError, "Failed to submit milestone application."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleApply}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-3"
    >
      <p className="text-sm text-[#5f5f5f]">
        Apply only for this milestone. Do not start until this milestone is Verified Funded.
      </p>
      <AppTextarea
        rows={3}
        value={proposal}
        maxLength={1200}
        onChange={(event) => {
          setProposal(event.target.value);
          setError(null);
        }}
        placeholder="Proposal for this milestone"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <AppButton type="submit" disabled={isSubmitting} className="disabled:opacity-60">
        {isSubmitting ? "Applying..." : "Apply to Milestone"}
      </AppButton>
    </form>
  );
}
