"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { AttachmentList } from "@/features/attachments/components";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useQuery } from "convex/react";
import Link from "next/link";

import type { TDisputeReasonCategory } from "../types";
import type { TConvexId } from "@repo/convex-client";

import { formatDisputeDate, getDisputeReasonLabel } from "../lib";
import { DisputeResponseComposer } from "./dispute-response-composer";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "./dispute-status-badge";
import { DisputeTimeline } from "./dispute-timeline";

export function DisputeDetailPanel({ disputeId }: { readonly disputeId: string }) {
  const walletIdentity = useHighrableWalletIdentity();
  const dispute = useQuery(
    api.disputes.getDispute,
    walletIdentity.walletAddress
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );
  const timeline = useQuery(
    api.disputes.getDisputeTimeline,
    walletIdentity.walletAddress
      ? {
          disputeId: disputeId as TConvexId<"disputes">,
          viewerWallet: walletIdentity.walletAddress,
        }
      : "skip",
  );

  if (!walletIdentity.walletAddress) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm text-[#5f5f5f]">
        Connect your wallet to view this dispute.
      </p>
    );
  }

  if (dispute === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm">Loading dispute...</p>
    );
  }

  if (dispute === null) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Dispute not found or you do not have access.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#e8e8e8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-[#5f5f5f] uppercase">{dispute.disputeNumber}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0a0a0a]">{dispute.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <DisputeStatusBadge status={dispute.status} />
            <DisputeOnChainStatusBadge status={dispute.onChainStatus} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Reason</span>
            <br />
            {getDisputeReasonLabel(dispute.reasonCategory as TDisputeReasonCategory)}
          </p>
          <p>
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Opened</span>
            <br />
            {formatDisputeDate(dispute.openedAt)}
          </p>
          <p className="break-all">
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Client</span>
            <br />
            {dispute.clientWallet}
          </p>
          <p className="break-all">
            <span className="font-mono text-xs text-[#5f5f5f] uppercase">Freelancer</span>
            <br />
            {dispute.freelancerWallet}
          </p>
        </div>
        <p className="mt-4 text-sm whitespace-pre-wrap text-[#3f3f3f]">{dispute.description}</p>
        {dispute.transactionHash ? (
          <div className="mt-4">
            <AppButton asChild variant="secondary" size="sm">
              <a href={dispute.stellarExpertUrl ?? "#"} target="_blank" rel="noreferrer">
                View Stellar Transaction
              </a>
            </AppButton>
          </div>
        ) : dispute.onChainStatus === "mark_failed" ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Dispute evidence was saved, but on-chain escrow dispute marking failed. Retry required.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-5">
        <h2 className="text-lg font-semibold text-[#0a0a0a]">Evidence</h2>
        <div className="mt-3">
          <AttachmentList attachments={dispute.attachments ?? []} readOnly />
        </div>
      </section>

      <DisputeResponseComposer dispute={dispute} />

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#0a0a0a]">Dispute Evidence Timeline</h2>
          <AppButton asChild variant="secondary" size="sm">
            <Link href="/disputes">All Disputes</Link>
          </AppButton>
        </div>
        <DisputeTimeline events={timeline} isLoading={timeline === undefined} />
      </section>
    </div>
  );
}
