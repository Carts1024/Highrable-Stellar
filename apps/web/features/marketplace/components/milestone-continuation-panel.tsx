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

interface IMilestoneContinuationPanelProps {
  job: TConvexDoc<"jobs">;
  milestone: TConvexDoc<"milestones">;
  applicationGate: TMilestoneApplicationGate;
}

type TPendingAction = "retain" | "replace" | "accept" | "reject";

export function MilestoneContinuationPanel({
  job,
  milestone,
  applicationGate,
}: IMilestoneContinuationPanelProps) {
  const { address, isConnected } = useWallet();
  const offerMilestoneContinuation = useMutation(api.milestones.offerMilestoneContinuation);
  const openMilestoneForReplacement = useMutation(api.milestones.openMilestoneForReplacement);
  const respondToMilestoneContinuation = useMutation(api.milestones.respondToMilestoneContinuation);
  const [pendingAction, setPendingAction] = useState<TPendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isClient = isConnected && isSameWallet(address, job.clientWallet);
  const isOfferedFreelancer =
    isConnected && isSameWallet(address, applicationGate.continuationOfferFreelancerWallet);
  const canChooseContinuation =
    isClient && milestone.status === "open" && applicationGate.reason === "waiting_client_decision";
  const canRespondToOffer =
    isOfferedFreelancer &&
    milestone.status === "open" &&
    applicationGate.reason === "continuation_offer_pending";

  const runAction = async (action: TPendingAction, callback: () => Promise<unknown>) => {
    setPendingAction(action);
    setError(null);

    try {
      await callback();
    } catch (caughtError) {
      setError(getReadableErrorMessage(caughtError, "Failed to update milestone continuation."));
    } finally {
      setPendingAction(null);
    }
  };

  if (
    milestone.order <= 1 ||
    (applicationGate.reason !== "waiting_client_decision" &&
      applicationGate.reason !== "continuation_offer_pending" &&
      applicationGate.reason !== "continuation_offer_rejected" &&
      applicationGate.reason !== "replacement_applications_open")
  ) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3">
      <div>
        <h4 className="text-sm font-semibold text-[#0a0a0a]">Milestone continuation</h4>
        <p className="mt-1 text-sm text-[#5f5f5f]">{applicationGate.message}</p>
      </div>

      {applicationGate.reason === "continuation_offer_rejected" ? (
        <p className="text-sm text-amber-800">
          {shortenWalletAddress(applicationGate.continuationOfferFreelancerWallet)} rejected the
          retain offer. Replacement applications are open.
        </p>
      ) : null}

      {applicationGate.reason === "replacement_applications_open" ? (
        <p className="text-sm text-emerald-700">Replacement applications are open.</p>
      ) : null}

      {canChooseContinuation ? (
        <div className="flex flex-wrap gap-2">
          <AppButton
            type="button"
            disabled={pendingAction !== null || !applicationGate.previousFreelancerWallet}
            onClick={() =>
              void runAction("retain", () =>
                offerMilestoneContinuation({
                  milestoneId: milestone._id as TConvexId<"milestones">,
                  clientWallet: address ?? "",
                }),
              )
            }
            className="disabled:opacity-60"
          >
            {pendingAction === "retain" ? "Sending..." : "Retain previous freelancer"}
          </AppButton>
          <AppButton
            type="button"
            variant="secondary"
            disabled={pendingAction !== null}
            onClick={() =>
              void runAction("replace", () =>
                openMilestoneForReplacement({
                  milestoneId: milestone._id as TConvexId<"milestones">,
                  clientWallet: address ?? "",
                }),
              )
            }
          >
            {pendingAction === "replace" ? "Opening..." : "Open applications"}
          </AppButton>
        </div>
      ) : null}

      {canRespondToOffer ? (
        <div className="space-y-2">
          <p className="text-sm text-[#5f5f5f]">
            The client wants to retain you for milestone {milestone.order}.
          </p>
          <div className="flex flex-wrap gap-2">
            <AppButton
              type="button"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("accept", () =>
                  respondToMilestoneContinuation({
                    milestoneId: milestone._id as TConvexId<"milestones">,
                    freelancerWallet: address ?? "",
                    response: "accepted",
                  }),
                )
              }
              className="disabled:opacity-60"
            >
              {pendingAction === "accept" ? "Accepting..." : "Accept offer"}
            </AppButton>
            <AppButton
              type="button"
              variant="secondary"
              disabled={pendingAction !== null}
              onClick={() =>
                void runAction("reject", () =>
                  respondToMilestoneContinuation({
                    milestoneId: milestone._id as TConvexId<"milestones">,
                    freelancerWallet: address ?? "",
                    response: "rejected",
                  }),
                )
              }
            >
              {pendingAction === "reject" ? "Rejecting..." : "Reject offer"}
            </AppButton>
          </div>
        </div>
      ) : null}

      {applicationGate.reason === "continuation_offer_pending" && !canRespondToOffer ? (
        <p className="text-sm text-[#5f5f5f]">
          Waiting for {shortenWalletAddress(applicationGate.continuationOfferFreelancerWallet)} to
          respond.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
