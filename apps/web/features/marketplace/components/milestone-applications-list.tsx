"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation } from "convex/react";
import { useState } from "react";

import type { TMilestoneApplicationGate } from "../types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";

export function MilestoneApplicationsList({
  job,
  milestone,
  applicationGate,
  applications,
  isLoading,
}: {
  job: TConvexDoc<"jobs">;
  milestone: TConvexDoc<"milestones">;
  applicationGate: TMilestoneApplicationGate;
  applications: TConvexDoc<"applications">[] | undefined;
  isLoading: boolean;
}) {
  const { address, isConnected } = useWallet();
  const assignFreelancerToMilestone = useMutation(api.milestones.assignFreelancerToMilestone);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectingWallet, setSelectingWallet] = useState<string | null>(null);

  const isClient = isSameWallet(address, job.clientWallet);
  const canAssign =
    isConnected && isClient && milestone.status === "open" && applicationGate.canApply;

  const handleAssign = async (freelancerWallet: string) => {
    if (!address) {
      setSelectionError("Connect your wallet to assign a freelancer.");
      return;
    }

    setSelectionError(null);
    setSelectingWallet(freelancerWallet);

    try {
      await assignFreelancerToMilestone({
        milestoneId: milestone._id as TConvexId<"milestones">,
        clientWallet: address,
        freelancerWallet,
      });
    } catch (error) {
      setSelectionError(getReadableErrorMessage(error, "Failed to assign freelancer."));
    } finally {
      setSelectingWallet(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-[#7f7f7f]">Loading milestone applications...</p>;
  }

  if (!applications || applications.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#e8e8e8] bg-[#f5f5f5] p-3 text-sm text-[#5f5f5f]">
        No applications for this milestone yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((application) => {
        const isAssigned = isSameWallet(
          milestone.assignedFreelancerWallet,
          application.freelancerWallet,
        );

        return (
          <article
            key={application._id}
            className="rounded-lg border border-[#e8e8e8] bg-white p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0a0a0a]">
                  {shortenWalletAddress(application.freelancerWallet)}
                </p>
                <p className="text-xs text-[#7f7f7f]">
                  Applied {new Date(application.createdAt).toLocaleString()}
                </p>
              </div>
              {canAssign ? (
                <AppButton
                  type="button"
                  variant="secondary"
                  disabled={selectingWallet === application.freelancerWallet || isAssigned}
                  onClick={() => void handleAssign(application.freelancerWallet)}
                  className="h-8 px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {isAssigned
                    ? "Assigned"
                    : selectingWallet === application.freelancerWallet
                      ? "Assigning..."
                      : "Assign"}
                </AppButton>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[#5f5f5f]">{application.proposal}</p>
          </article>
        );
      })}

      {selectionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {selectionError}
        </p>
      ) : null}
    </div>
  );
}
