import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount } from "@/features/dashboard/lib/format";
import { formatAssetLabel } from "@/core/stellar/assets";
import { cn } from "@repo/ui/lib/utils";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";

import { formatProofDate } from "../lib/format";
import { getTimelineEventState } from "../lib/proof-status";

import type { TEscrowProof } from "../types";

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
      label: "Escrow created",
      description: "Escrow record created for this work.",
      timestamp: proof.escrow.createdAt,
      txHash: proof.escrow.createTxHash,
      state: getTimelineEventState("created", proof.escrow, Boolean(proof.reputationRecord)),
    },
  ];

  if (proof.escrow.status === "cancelled") {
    return [
      ...items,
      {
        label: "Escrow cancelled",
        description: "This escrow was cancelled.",
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
        label: "Escrow disputed",
        description: "Manual review is required.",
        timestamp: proof.escrow.updatedAt,
        txHash: proof.escrow.disputeTxHash,
        state: "complete",
      },
    ];
  }

  return [
    ...items,
    {
      label: "Escrow funded",
      description: `${formatAmount(proof.escrow.amount)} ${formatAssetLabel(
        proof.escrow.asset,
      )} locked in Stellar escrow.`,
      timestamp: proof.escrow.fundTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.fundTxHash,
      state: getTimelineEventState("funded", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Work submitted",
      description: "Freelancer submitted the work for client approval.",
      timestamp: proof.escrow.submitTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.submitTxHash,
      state: getTimelineEventState("submitted", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Payment released",
      description: "Payment released to the freelancer through Stellar escrow.",
      timestamp: proof.escrow.releaseTxHash ? proof.escrow.updatedAt : undefined,
      txHash: proof.escrow.releaseTxHash,
      state: getTimelineEventState("released", proof.escrow, Boolean(proof.reputationRecord)),
    },
    {
      label: "Verified reputation recorded",
      description: "Escrow-backed reputation record created after payment release.",
      timestamp: proof.reputationRecord?.createdAt,
      txHash: proof.reputationRecord?.txHash ?? proof.escrow.releaseTxHash,
      state: getTimelineEventState("reputation", proof.escrow, Boolean(proof.reputationRecord)),
    },
  ];
}

export function EscrowProofTimeline({ proof }: { readonly proof: TEscrowProof }) {
  const timeline = buildTimeline(proof);

  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Escrow timeline</h2>
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
                  View transaction
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="mt-2 text-xs text-[#9f9f9f]">Transaction hash not stored.</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
