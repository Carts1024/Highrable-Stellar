import { PROOF_STATUS_LABELS, PROOF_TYPE_LABELS, getProofSummary } from "../lib/proof-status";

import type { TEscrowProof } from "../types";

import { Badge } from "@repo/ui/components/ui/badge";

export function EscrowProofHeader({ proof }: { readonly proof: TEscrowProof }) {
  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[#0a0a0a] text-white hover:bg-[#0a0a0a]">
              {PROOF_STATUS_LABELS[proof.proofStatus]}
            </Badge>
            <Badge variant="outline" className="border-[#FF7003]/30 bg-[#FFF7ED] text-[#9A3412]">
              {PROOF_TYPE_LABELS[proof.proofType]}
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0a0a0a]">
              Escrow Proof
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f5f5f]">
              {getProofSummary(proof.proofStatus, proof.proofType)}
            </p>
          </div>
        </div>

        {proof.proofStatus === "paid" && proof.reputationRecord ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            This work was paid through Stellar escrow and created an escrow-backed reputation
            record.
          </div>
        ) : null}
      </div>
    </section>
  );
}
