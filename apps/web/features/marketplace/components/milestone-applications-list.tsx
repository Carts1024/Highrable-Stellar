"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/features/common";
import { getReadableErrorMessage } from "@/features/marketplace/lib/errors";
import { isSameWallet, shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation } from "convex/react";
import Link from "next/link";
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
  const walletIdentity = useHighrableWalletIdentity();
  const assignFreelancerToMilestone = useMutation(api.milestones.assignFreelancerToMilestone);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectingWallet, setSelectingWallet] = useState<string | null>(null);

  const isClient = isSameWallet(walletIdentity.walletAddress, job.clientWallet);
  const canAssign =
    walletIdentity.isConnected &&
    isClient &&
    milestone.status === "open" &&
    applicationGate.canApply;

  const handleAssign = async (freelancerWallet: string) => {
    if (!walletIdentity.walletAddress) {
      showWarningToast("Connect your wallet to assign a freelancer.");
      return;
    }

    setSelectionError(null);
    setSelectingWallet(freelancerWallet);

    try {
      await assignFreelancerToMilestone({
        milestoneId: milestone._id as TConvexId<"milestones">,
        clientWallet: walletIdentity.walletAddress,
        freelancerWallet,
      });
      showSuccessToast(`Freelancer ${shortenWalletAddress(freelancerWallet)} assigned.`);
    } catch (error) {
      const nextError = getReadableErrorMessage(error, "Failed to assign freelancer.");
      setSelectionError(nextError);
      showErrorToast(nextError);
    } finally {
      setSelectingWallet(null);
    }
  };

  if (isLoading) {
    return (
      <p className="font-sans text-sm text-muted-foreground">Loading milestone applications...</p>
    );
  }

  if (!applications || applications.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 p-4 font-sans text-sm text-muted-foreground">
        No applications for this milestone yet.
      </p>
    );
  }

  return (
    <div className="divide-y rounded-md border">
      {applications.map((application) => {
        const isAssigned = isSameWallet(
          milestone.assignedFreelancerWallet,
          application.freelancerWallet,
        );

        return (
          <article key={application._id} className="px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <Link
                  href={`/freelancers/${encodeURIComponent(application.freelancerWallet)}`}
                  className="hr-text-primary font-mono text-sm hover:underline"
                >
                  {shortenWalletAddress(application.freelancerWallet)}
                </Link>
                <p className="hr-text-muted text-xs">
                  Applied {new Date(application.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {application.showcasedWorkEscrowId ? (
                  <AppButton asChild variant="ghost" className="h-8 px-3 text-sm">
                    <Link href={`/proof/${encodeURIComponent(application.showcasedWorkEscrowId)}`}>
                      View showcased work
                    </Link>
                  </AppButton>
                ) : null}
                {canAssign ? (
                  <AppButton
                    type="button"
                    disabled={selectingWallet === application.freelancerWallet || isAssigned}
                    onClick={() => void handleAssign(application.freelancerWallet)}
                    className="hr-v2-button-primary h-8 rounded-md px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAssigned
                      ? "Assigned"
                      : selectingWallet === application.freelancerWallet
                        ? "Assigning..."
                        : "Assign"}
                  </AppButton>
                ) : null}
              </div>
            </div>
            <p className="hr-text-secondary mt-2 font-sans text-sm">{application.proposal}</p>
          </article>
        );
      })}

      {selectionError ? (
        <p role="alert" className="px-3 py-2 text-sm text-red-700">
          {selectionError}
        </p>
      ) : null}
    </div>
  );
}
