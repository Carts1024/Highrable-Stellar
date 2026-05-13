import { formatAssetLabel } from "@/core/stellar/assets";
import { formatAmount } from "@/features/dashboard/lib/format";

import type { TEscrowProof } from "../types";

import { formatProofDate } from "../lib/format";

function getJobTypeLabel(jobType: string): string {
  return jobType === "milestone_project" ? "Milestone Project" : "Micro Gig";
}

export function EscrowProofWorkDetails({ proof }: { readonly proof: TEscrowProof }) {
  const amount = proof.milestone?.amount ?? proof.escrow.amount;
  const asset = proof.milestone?.asset ?? proof.escrow.asset;

  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Work details</h2>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">
            {proof.proofType === "milestone" ? "Project" : "Micro Gig"}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#0a0a0a]">{proof.job.title}</h3>
        </div>

        {proof.milestone ? (
          <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">
              Milestone {proof.milestone.order}
            </p>
            <p className="mt-1 font-semibold text-[#0a0a0a]">{proof.milestone.title}</p>
            {proof.milestone.description ? (
              <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">{proof.milestone.description}</p>
            ) : null}
          </div>
        ) : null}

        {proof.job.description ? (
          <p className="text-sm leading-6 text-[#5f5f5f]">{proof.job.description}</p>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[#7f7f7f]">Job type</dt>
          <dd className="font-semibold text-[#0a0a0a]">{getJobTypeLabel(proof.job.jobType)}</dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Amount</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatAmount(amount)} {formatAssetLabel(asset)}
          </dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Asset</dt>
          <dd className="font-semibold text-[#0a0a0a]">{formatAssetLabel(asset)}</dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Created</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatProofDate(proof.escrow.createdAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
