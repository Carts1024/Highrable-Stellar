"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { AgreementReferenceCard } from "@/features/work-agreements/components";
import { api } from "@repo/convex-client";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Check, X } from "lucide-react";
import { useState } from "react";

import type { TConvexDoc } from "@repo/convex-client";

import { CancellationStatusBadge } from "./cancellation-status-badge";

interface ICancellationNoticeProps {
  readonly eligibility:
    | {
        blocked: boolean;
        reason: string | null;
        warnings: string[];
        suggestedAction: string;
        latestProof?: { proofHash?: string; submittedAt?: number };
      }
    | null
    | undefined;
}

interface ICancellationTimelineProps {
  readonly cancellationRequestId: TConvexDoc<"cancellationRequests">["_id"];
}

interface IFreelancerCancellationResponsePanelProps {
  readonly request: TConvexDoc<"cancellationRequests">;
}

export function CancellationEligibilityNotice({ eligibility }: ICancellationNoticeProps) {
  if (!eligibility) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">
        {eligibility.blocked ? "Cancellation blocked" : "Cancellation eligibility checked"}
      </p>
      {eligibility.reason ? <p className="mt-1">{eligibility.reason}</p> : null}
      {eligibility.latestProof?.proofHash ? (
        <p className="mt-2 font-mono text-xs break-all">
          Proof hash: {eligibility.latestProof.proofHash}
        </p>
      ) : null}
      {eligibility.latestProof?.submittedAt ? (
        <p className="mt-1 text-xs">
          Proof submitted: {new Date(eligibility.latestProof.submittedAt).toLocaleString()}
        </p>
      ) : null}
      {eligibility.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {eligibility.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CancellationActionGuardNotice({ eligibility }: ICancellationNoticeProps) {
  if (!eligibility?.blocked) return null;
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {eligibility.reason ?? "Cancellation is not available right now."}
    </p>
  );
}

export function CancellationTimeline({ cancellationRequestId }: ICancellationTimelineProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const timeline = useQuery(
    api.cancellations.getCancellationTimeline,
    walletIdentity.walletAddress
      ? { cancellationRequestId, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );

  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#e8e8e8] bg-white p-3">
      <p className="font-mono text-xs text-[#6f6f6f] uppercase">Cancellation Timeline</p>
      <ol className="mt-3 space-y-3">
        {timeline.map((event) => (
          <li key={event._id} className="border-l border-[#d8d8d8] pl-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-[#0a0a0a]">{event.message}</span>
              <span className="font-mono text-[11px] text-[#7f7f7f]">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
            {event.transactionHash ? (
              <p className="mt-1 font-mono text-xs break-all text-[#5f5f5f]">
                tx {event.transactionHash}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CancellationAgreementContext({
  cancellationRequestId,
}: ICancellationTimelineProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const context = useQuery(
    api.work_agreements.getAgreementContextForCancellation,
    walletIdentity.walletAddress
      ? { cancellationRequestId, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );

  return (
    <AgreementReferenceCard
      context={context}
      emptyMessage="No accepted agreement was attached to this cancellation request."
    />
  );
}

export function FreelancerCancellationResponsePanel({
  request,
}: IFreelancerCancellationResponsePanelProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const respond = useMutation(api.cancellations.respondToCancellationRequest);
  const [message, setMessage] = useState("");
  const [pendingResponse, setPendingResponse] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canRespond =
    walletIdentity.walletAddress === request.freelancerWallet &&
    request.status === "pending_freelancer_response" &&
    request.freelancerResponseStatus === "pending";

  if (!canRespond) return null;

  const submitResponse = async (responseStatus: "accepted" | "rejected") => {
    setPendingResponse(responseStatus);
    setError(null);
    try {
      await respond({
        cancellationRequestId: request._id,
        freelancerWallet: walletIdentity.walletAddress!,
        freelancerWalletType: walletIdentity.walletType ?? "external_wallet",
        responseStatus,
        responseMessage:
          message.trim() || (responseStatus === "accepted" ? "Accepted." : "Rejected."),
      });
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not respond to cancellation.");
    } finally {
      setPendingResponse(null);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-[#e8e8e8] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-[#0a0a0a]">Cancellation response required</p>
        <CancellationStatusBadge status={request.status} />
      </div>
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Add a short response for the client."
        className="min-h-24"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pendingResponse !== null}
          onClick={() => void submitResponse("accepted")}
        >
          <Check className="h-4 w-4" />
          {pendingResponse === "accepted" ? "Accepting..." : "Accept cancellation"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pendingResponse !== null}
          onClick={() => void submitResponse("rejected")}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          <X className="h-4 w-4" />
          {pendingResponse === "rejected" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </div>
  );
}
