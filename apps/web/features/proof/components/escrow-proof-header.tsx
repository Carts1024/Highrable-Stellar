import { formatAssetLabel } from "@/core/stellar/assets";
import { StatusText } from "@/features/common";
import { formatAmount } from "@/features/dashboard/lib/format";
import React from "react";

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
    <header className="grid gap-6 border-b pb-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
      <div className="min-w-0 space-y-2">
        <p className="hr-text-muted text-xs">Work receipt · {PROOF_TYPE_LABELS[proof.proofType]}</p>
        <h1 className="hr-text-primary text-2xl leading-tight font-semibold tracking-tight">
          {proof.job.title}
        </h1>
        <StatusText tone={proof.proofStatus === "paid" ? "success" : "neutral"}>
          {PROOF_STATUS_LABELS[proof.proofStatus]}
        </StatusText>
        <p className="hr-text-secondary max-w-2xl text-sm leading-relaxed">
          {getProofSummary(proof.proofStatus, proof.proofType)}
          {proof.proofStatus === "paid" && proof.reputationRecord
            ? " The payment also created a reputation record for the freelancer."
            : null}
        </p>
      </div>

      <dl className="space-y-2 text-sm lg:border-l lg:pl-6">
        <div>
          <dt className="hr-text-secondary text-xs">Amount</dt>
          <dd className="hr-text-primary hr-num text-xl font-semibold">
            {formatAmount(amount)} {formatAssetLabel(asset)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="hr-text-secondary">Payment</dt>
          <dd className="hr-text-primary">{getPaymentStatusLabel(proof.escrow.status)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="hr-text-secondary">Created</dt>
          <dd className="hr-text-primary">{formatProofDate(proof.escrow.createdAt)}</dd>
        </div>
      </dl>
    </header>
  );
}
