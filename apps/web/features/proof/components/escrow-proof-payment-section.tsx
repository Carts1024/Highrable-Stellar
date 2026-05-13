import { formatAssetLabel } from "@/core/stellar/assets";
import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { formatAmount } from "@/features/dashboard/lib/format";
import { Badge } from "@repo/ui/components/ui/badge";
import { ExternalLink } from "lucide-react";

import { getPaymentProofCopy, PROOF_STATUS_LABELS } from "../lib/proof-status";

import type { TEscrowProof } from "../types";

function TransactionHashRow({
  label,
  txHash,
}: {
  readonly label: string;
  readonly txHash: string | undefined;
}) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-3">
      <p className="text-xs font-semibold tracking-[0.08em] text-[#7f7f7f] uppercase">{label}</p>
      {txHash ? (
        <a
          href={getTxExplorerUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
        >
          {txHash}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <p className="mt-1 text-sm text-[#7f7f7f]">Transaction hash not stored.</p>
      )}
    </div>
  );
}

export function EscrowProofPaymentSection({ proof }: { readonly proof: TEscrowProof }) {
  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0a0a0a]">Payment proof</h2>
          <p className="mt-2 text-sm text-[#5f5f5f]">{getPaymentProofCopy(proof.proofStatus)}</p>
        </div>
        <Badge variant="outline" className="border-[#e8e8e8] bg-[#fafafa]">
          {PROOF_STATUS_LABELS[proof.proofStatus]}
        </Badge>
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[#7f7f7f]">Amount</dt>
          <dd className="font-semibold text-[#0a0a0a]">
            {formatAmount(proof.escrow.amount)} {formatAssetLabel(proof.escrow.asset)}
          </dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Asset</dt>
          <dd className="font-semibold text-[#0a0a0a]">{formatAssetLabel(proof.escrow.asset)}</dd>
        </div>
        <div>
          <dt className="text-[#7f7f7f]">Escrow status</dt>
          <dd className="font-semibold text-[#0a0a0a]">{proof.escrow.status}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <TransactionHashRow label="Fund transaction" txHash={proof.escrow.fundTxHash} />
        <TransactionHashRow label="Release transaction" txHash={proof.escrow.releaseTxHash} />
      </div>
    </section>
  );
}
