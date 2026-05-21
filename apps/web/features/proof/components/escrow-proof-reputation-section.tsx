import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { ExternalLink, ShieldCheck, Star } from "lucide-react";

import type { TEscrowProof } from "../types";
import type { ReactNode } from "react";

export interface IRatingStarsProps {
  readonly rating: number;
}

export interface IEscrowProofReputationSectionProps {
  readonly proof: TEscrowProof;
  readonly isSyncing: boolean;
  readonly syncMessage: string | null;
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
}: IEscrowProofReputationSectionProps) {
  const reputationRecord = proof.reputationRecord;

  if (proof.escrow.status !== "released") {
    return (
      <TrustInfoRow
        title="Trust badge not ready yet"
        tone="muted"
        content={
          <p>
            A verified trust badge appears after the client approves the work and payment is
            released.
          </p>
        }
      />
    );
  }

  if (!reputationRecord) {
    return (
      <TrustInfoRow
        title={isSyncing ? "Preparing trust badge" : "Trust badge pending"}
        tone="warning"
        content={
          <div className="space-y-2">
            <p>
              Payment is complete. Highrable is checking the record and will show the trust badge
              here when it is ready.
            </p>
            {syncMessage ? <p className="text-xs text-amber-800">{syncMessage}</p> : null}
          </div>
        }
      />
    );
  }

  return (
    <TrustInfoRow
      title="Verified paid work"
      tone="success"
      content={
        <div className="space-y-5">
          <p>
            This review is tied to paid work on Highrable, so it is harder to fake than a normal
            marketplace rating.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Rating
              </p>
              <div className="mt-2 text-sm font-medium">
                <RatingStars rating={reputationRecord.rating} />
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Review
              </p>
              <p className="hr-text-primary mt-2 text-sm font-semibold">
                {reputationRecord.reviewText ? "Written feedback included" : "Paid work confirmed"}
              </p>
            </div>
          </div>

          {reputationRecord.reviewText ? (
            <div className="border-t border-gray-100 pt-5">
              <p className="font-mono text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Client feedback
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
                View payment receipt
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                Receipt link not available
              </p>
            )}
          </div>
        </div>
      }
    />
  );
}

function TrustInfoRow({
  title,
  content,
  tone,
}: {
  readonly title: string;
  readonly content: ReactNode;
  readonly tone: "muted" | "warning" | "success";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-[#e8e8e8] bg-white text-[#7f7f7f]";

  return (
    <section className="flex items-center justify-between gap-4 border-y border-[#e8e8e8] bg-white py-4">
      <div>
        <SectionLabel>Trust Badge</SectionLabel>
        <h2 className="mt-2 text-base font-semibold text-[#0a0a0a]">{title}</h2>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open trust badge details"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center border transition-colors hover:bg-[#fff7ed] ${toneClass}`}
          >
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="left" sideOffset={10} className="max-w-md text-sm leading-relaxed">
          {content}
        </PopoverContent>
      </Popover>
    </section>
  );
}
