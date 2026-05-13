import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink, Star } from "lucide-react";

import type { TEscrowProof } from "../types";

function RatingStars({ rating }: { readonly rating: number }) {
  const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className="h-4 w-4"
          fill={index < normalizedRating ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-2 text-sm text-[#5f5f5f]">{normalizedRating}/5</span>
    </span>
  );
}

export function EscrowProofReputationSection({
  proof,
  isSyncing,
  syncMessage,
  onSyncReputation,
}: {
  readonly proof: TEscrowProof;
  readonly isSyncing: boolean;
  readonly syncMessage: string | null;
  readonly onSyncReputation: () => void;
}) {
  const reputationRecord = proof.reputationRecord;

  if (proof.escrow.status !== "released") {
    return (
      <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-[#0a0a0a]">Reputation proof</h2>
        <p className="mt-2 text-sm text-[#5f5f5f]">
          Reputation proof is created only after payment release.
        </p>
      </section>
    );
  }

  if (!reputationRecord) {
    return (
      <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-amber-950">Reputation proof</h2>
          <p className="mt-2 text-sm text-amber-900">
            Payment was released, but the reputation record is not synced yet.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={isSyncing}
          onClick={onSyncReputation}
          className="h-9 rounded-lg border-amber-300 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSyncing ? "Syncing..." : "Sync reputation record"}
        </Button>
        {syncMessage ? <p className="text-sm text-amber-900">{syncMessage}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-emerald-950">Verified reputation record</h2>
      <p className="mt-2 text-sm text-emerald-900">
        This record was created after escrow payment was released.
      </p>

      <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-[#5f5f5f]">Rating</span>
          <RatingStars rating={reputationRecord.rating} />
        </div>
        {reputationRecord.reviewText ? (
          <p className="text-sm text-[#0a0a0a] italic">"{reputationRecord.reviewText}"</p>
        ) : null}
        {reputationRecord.reviewHash ? (
          <p className="break-all text-xs text-[#5f5f5f]">
            Review hash: {reputationRecord.reviewHash}
          </p>
        ) : null}
        {reputationRecord.txHash ? (
          <a
            href={getTxExplorerUrl(reputationRecord.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#FF7003] hover:text-[#E85D00]"
          >
            Reputation transaction
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="text-xs text-[#7f7f7f]">Reputation transaction hash not stored.</p>
        )}
      </div>
    </section>
  );
}
