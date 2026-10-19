import { formatAssetLabel } from "@/core/stellar/assets";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount } from "@/features/dashboard/lib/format";
import { cn } from "@repo/ui/lib/utils";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

import type { TEscrowProof } from "../types";

import { formatProofDate } from "../lib/format";
import {
  getPaymentProofCopy,
  getPaymentStatusLabel,
  getTimelineEventState,
} from "../lib/proof-status";

type TTimelineItem = {
  readonly label: string;
  readonly description: string;
  readonly timestamp?: number;
  readonly txHash?: string;
  readonly state: "complete" | "current" | "pending";
};

function buildTimeline(proof: TEscrowProof): TTimelineItem[] {
  const items: TTimelineItem[] = [
    {
      label: "Payment Started",
      description: "Highrable opened a protected payment record for this work.",
      timestamp: proof.escrow.createdAt,
      txHash: proof.escrow.createTxHash,
      state: getTimelineEventState("created", proof.escrow, Boolean(proof.reputationRecord)),
    },
  ];

  if (proof.escrow.status === "cancelled") {
    return [
      ...items,
      {
        label: "Payment Cancelled",
        description: "This protected payment was cancelled.",
        timestamp: proof.escrow.updatedAt,
        txHash: proof.escrow.cancelTxHash,
        state: "complete",
      },
    ];
  }

  if (proof.escrow.status === "disputed") {
    return [
      ...items,
      {
        label: "Payment Under Review",
        description: "A review is needed before the payment can move forward.",
        timestamp: proof.escrow.updatedAt,
        txHash: proof.escrow.disputeTxHash,
        state: "complete",
      },
    ];
  }

  return [
    ...items,
    {
      label: "Funds Protected",
      description: `${formatAmount(proof.escrow.amount)} ${formatAssetLabel(
        proof.escrow.asset,
      )} was set aside for this work.`,
      timestamp: proof.escrow.fundTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.fundTxHash,
      state: getTimelineEventState("funded", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Work Sent for Review",
      description: "The freelancer sent the work for client approval.",
      timestamp: proof.escrow.submitTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.submitTxHash,
      state: getTimelineEventState("submitted", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Payment Released",
      description: "The client approved the work and payment was released to the freelancer.",
      timestamp: proof.escrow.releaseTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.releaseTxHash,
      state: getTimelineEventState("released", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Review Can Be Trusted",
      description: "Highrable can show this as a paid work record after payment release.",
      timestamp: proof.reputationRecord?.createdAt,
      txHash: proof.reputationRecord?.txHash ?? proof.escrow.releaseTxHash,
      state: getTimelineEventState("reputation", proof.escrow, Boolean(proof.reputationRecord)),
    },
  ];
}

export function EscrowProofTimeline({ proof }: { readonly proof: TEscrowProof }) {
  const timeline = buildTimeline(proof);

  return (
    <section aria-labelledby="proof-timeline-title" className="space-y-1">
      <h2 id="proof-timeline-title" className="hr-text-primary text-base font-semibold">
        Timeline
      </h2>
      <p className="hr-text-secondary max-w-2xl text-sm leading-relaxed">
        {getPaymentProofCopy(proof.proofStatus)}
      </p>

      <dl className="mt-4 grid gap-4 border-y py-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-2 text-xs text-[#7f7f7f]">Amount</dt>
          <dd className="hr-text-primary font-medium">
            {formatAmount(proof.escrow.amount)} {formatAssetLabel(proof.escrow.asset)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-xs text-[#7f7f7f]">Payment status</dt>
          <dd className="hr-text-primary font-medium">
            {getPaymentStatusLabel(proof.escrow.status)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-xs text-[#7f7f7f]">Currency</dt>
          <dd className="hr-text-primary font-medium">{formatAssetLabel(proof.escrow.asset)}</dd>
        </div>
      </dl>

      <ol className="mt-5 space-y-4">
        {timeline.map((item) => (
          <li key={item.label} className="flex gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                item.state === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                item.state === "current" && "hr-mode-text border-highrable-orange-2/30 bg-accent",
                item.state === "pending" && "border-[#e8e8e8] bg-[#fafafa] text-[#9f9f9f]",
              )}
            >
              {item.state === "complete" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="hr-text-primary text-sm font-medium">{item.label}</p>
                <p className="text-xs text-[#7f7f7f]">{formatProofDate(item.timestamp)}</p>
              </div>
              <p className="mt-1 text-sm text-[#5f5f5f]">{item.description}</p>
              {item.txHash ? (
                <a
                  href={getTxExplorerUrl(item.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hr-mode-text mt-2 inline-flex items-center gap-1 text-sm font-medium hover:text-highrable-orange-4"
                >
                  View payment receipt
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="mt-2 text-xs text-[#9f9f9f]">Receipt link not available yet.</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
