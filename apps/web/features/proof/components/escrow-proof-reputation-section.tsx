import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { V2_PANEL_CLASS, V2_BADGE_ACCENT_CLASS } from "@repo/ui/components/highrable/v2-theme";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ExternalLink, Star, ShieldCheck } from "lucide-react";

import type { TEscrowProof } from "../types";

export interface IRatingStarsProps {
  readonly rating: number;
}

export interface IEscrowProofReputationSectionProps {
  readonly proof: TEscrowProof;
  readonly isSyncing: boolean;
  readonly syncMessage: string | null;
  readonly onSyncReputation: () => void;
}

function RatingStars({ rating }: IRatingStarsProps) {
  const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className="h-4 w-4"
          fill={index < normalizedRating ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <span className="hr-text-secondary ml-2 font-mono text-xs font-medium">
        {normalizedRating}/5
      </span>
    </span>
  );
}

export function EscrowProofReputationSection({
  proof,
  isSyncing,
  syncMessage,
  onSyncReputation,
}: IEscrowProofReputationSectionProps) {
  const reputationRecord = proof.reputationRecord;

  if (proof.escrow.status !== "released") {
    return (
      <section className={cn("p-6", V2_PANEL_CLASS, "bg-white")}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="hr-text-muted h-5 w-5" />
          <h2 className="hr-text-primary text-xl font-bold tracking-tight">Trust Verification</h2>
        </div>
        <p className="hr-text-secondary mt-3 text-sm leading-relaxed">
          The trust verification record and on-chain review will be generated automatically once the
          escrow payment is released.
        </p>
      </section>
    );
  }

  if (!reputationRecord) {
    return (
      <section className={cn("space-y-4 p-6", V2_PANEL_CLASS, "border-amber-200 bg-amber-50/30")}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
          <h2 className="text-xl font-bold tracking-tight text-amber-950">Pending Verification</h2>
        </div>
        <p className="text-sm leading-relaxed text-amber-900/80">
          Payment has been released successfully, but the on-chain trust record is not yet
          synchronized with this view.
        </p>
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSyncing}
            onClick={onSyncReputation}
            className="h-9 rounded-lg border-amber-300 bg-white px-4 text-xs font-bold tracking-wide text-amber-700 uppercase transition-all hover:bg-amber-100 disabled:opacity-50"
          >
            {isSyncing ? "Syncing Record..." : "Sync Verification Record"}
          </Button>
        </div>
        {syncMessage ? (
          <p className="font-mono text-[10px] font-medium text-amber-800 uppercase">
            {syncMessage}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className={cn("p-6", V2_PANEL_CLASS, "bg-white")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="hr-text-accent h-5 w-5" />
          <h2 className="hr-text-primary text-xl font-bold tracking-tight">
            Verified Trust Record
          </h2>
        </div>
        <div
          className={cn(
            "px-3 py-1 text-[10px] font-bold tracking-widest uppercase",
            V2_BADGE_ACCENT_CLASS,
          )}
        >
          On-Chain Verified
        </div>
      </div>

      <p className="hr-text-secondary mt-3 text-sm leading-relaxed">
        This record serves as cryptographic proof of a successful collaboration and payment through
        the Highrable escrow system.
      </p>

      <div className="mt-6 space-y-5 rounded-xl border border-gray-100 bg-gray-50/50 p-5">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Performance Rating
            </p>
            <div className="mt-2 text-sm font-medium">
              <RatingStars rating={reputationRecord.rating} />
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Review Status
            </p>
            <p className="hr-text-primary mt-2 text-sm font-semibold">
              {reputationRecord.reviewText ? "Written Review Included" : "Verified Completion Only"}
            </p>
          </div>
        </div>

        {reputationRecord.reviewText ? (
          <div className="border-t border-gray-100 pt-5">
            <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Client Feedback
            </p>
            <p className="hr-text-primary mt-2 text-sm leading-relaxed italic">
              "{reputationRecord.reviewText}"
            </p>
          </div>
        ) : null}

        <div className="border-t border-gray-100 pt-5">
          {reputationRecord.txHash ? (
            <a
              href={getTxExplorerUrl(reputationRecord.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="hr-text-accent inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase transition-colors hover:opacity-80"
            >
              View On-Chain Transaction
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
              Transaction hash not recorded
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
