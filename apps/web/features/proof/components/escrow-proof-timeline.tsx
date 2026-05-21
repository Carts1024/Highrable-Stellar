import { formatAssetLabel } from "@/core/stellar/assets";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount } from "@/features/dashboard/lib/format";
import { HighrableV2Bullet, SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

import type { TEscrowProof } from "../types";

import { formatProofDate } from "../lib/format";
import {
  PROOF_STATUS_LABELS,
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
      label: "Payment started",
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
        label: "Payment cancelled",
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
        label: "Payment under review",
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
      label: "Funds protected",
      description: `${formatAmount(proof.escrow.amount)} ${formatAssetLabel(
        proof.escrow.asset,
      )} was set aside for this work.`,
      timestamp: proof.escrow.fundTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.fundTxHash,
      state: getTimelineEventState("funded", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Work sent for review",
      description: "The freelancer sent the work for client approval.",
      timestamp: proof.escrow.submitTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.submitTxHash,
      state: getTimelineEventState("submitted", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Payment released",
      description: "The client approved the work and payment was released to the freelancer.",
      timestamp: proof.escrow.releaseTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.releaseTxHash,
      state: getTimelineEventState("released", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Review can be trusted",
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
    <section className="border-y border-[#e8e8e8] bg-white py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Payment Timeline</SectionLabel>
          <h2 className="mt-2 text-xl font-semibold text-[#0a0a0a]">What happened</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5f5f5f]">
            {getPaymentProofCopy(proof.proofStatus)}
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-none border-[#e8e8e8] bg-[#fafafa] font-mono text-[0.65rem] tracking-[0.08em] uppercase"
        >
          {PROOF_STATUS_LABELS[proof.proofStatus]}
        </Badge>
      </div>

      <dl className="mt-5 grid gap-4 border-y border-[#e8e8e8] py-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            <HighrableV2Bullet tone="muted" />
            Amount
          </dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatAmount(proof.escrow.amount)} {formatAssetLabel(proof.escrow.asset)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            <HighrableV2Bullet tone="muted" />
            Payment status
          </dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {getPaymentStatusLabel(proof.escrow.status)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            <HighrableV2Bullet tone="muted" />
            Currency
          </dt>
          <dd className="font-semibold text-[#0a0a0a]">{formatAssetLabel(proof.escrow.asset)}</dd>
        </div>
      </dl>

      <ol className="mt-5 space-y-4">
        {timeline.map((item) => (
          <li key={item.label} className="flex gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                item.state === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                item.state === "current" && "border-[#FF7003]/30 bg-[#FFF7ED] text-[#FF7003]",
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
                <p className="font-semibold text-[#0a0a0a]">{item.label}</p>
                <p className="text-xs text-[#7f7f7f]">{formatProofDate(item.timestamp)}</p>
              </div>
              <p className="mt-1 text-sm text-[#5f5f5f]">{item.description}</p>
              {item.txHash ? (
                <a
                  href={getTxExplorerUrl(item.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
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
