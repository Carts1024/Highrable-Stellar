import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";
import {
  HighrableV2Badge,
  HighrableV2Metric,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";

import type { TEscrowProof } from "../types";

import { formatProofDate } from "../lib/format";
import {
  PROOF_STATUS_LABELS,
  PROOF_TYPE_LABELS,
  getPaymentStatusLabel,
  getProofSummary,
} from "../lib/proof-status";

export function EscrowProofHeader({ proof }: { readonly proof: TEscrowProof }) {
  const amount = proof.milestone?.amount ?? proof.escrow.amount;
  const asset = proof.milestone?.asset ?? proof.escrow.asset;

  return (
    <section className="grid gap-8 border-b border-[#e8e8e8] pb-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
      <div className="space-y-5">
        <div className="space-y-3">
          <SectionLabel>Proof Receipt</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-none bg-[#0a0a0a] px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-white uppercase hover:bg-[#0a0a0a]">
              {PROOF_STATUS_LABELS[proof.proofStatus]}
            </Badge>
            <HighrableV2Badge>{PROOF_TYPE_LABELS[proof.proofType]}</HighrableV2Badge>
          </div>
          <div>
            <h1 className="max-w-3xl text-4xl leading-tight font-medium text-[#0a0a0a] sm:text-5xl">
              Work receipt for <span className="hr-v2-gradient-text">{proof.job.title}</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5f5f]">
              {getProofSummary(proof.proofStatus, proof.proofType)}
            </p>
          </div>
        </div>

        {proof.proofStatus === "paid" && proof.reputationRecord ? (
          <div className="w-fit border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            This work was paid through Stellar escrow and created an escrow-backed reputation
            record.
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 border-l border-[#e8e8e8] py-2">
        <HighrableV2Metric
          label="Payment amount"
          value={`${formatAmount(amount)} ${formatAssetLabel(asset)}`}
          className="text-[#B94A00]"
        />
        <HighrableV2Metric
          label="Payment status"
          value={getPaymentStatusLabel(proof.escrow.status)}
        />
        <HighrableV2Metric label="Created" value={formatProofDate(proof.escrow.createdAt)} />
      </div>
    </section>
  );
}
