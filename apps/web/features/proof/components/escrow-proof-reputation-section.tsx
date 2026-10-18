import { getTxExplorerUrl } from "@/core/stellar/explorer";
import { StatusText } from "@/features/common";
import { ExternalLink, Star } from "lucide-react";

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
        title="Trust Badge Not Ready Yet"
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
      title="Verified Paid Work"
      tone="success"
      content={
        <div className="space-y-4">
          <p>
            This review is tied to paid work on Highrable, so it is harder to fake than a normal
            marketplace rating.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="hr-text-secondary text-xs">Rating</p>
              <div className="mt-2 text-sm font-medium">
                <RatingStars rating={reputationRecord.rating} />
              </div>
            </div>

            <div>
              <p className="hr-text-secondary text-xs">Review</p>
              <p className="hr-text-primary mt-2 text-sm font-semibold">
                {reputationRecord.reviewText ? "Written feedback included" : "Paid work confirmed"}
              </p>
            </div>
          </div>

          {reputationRecord.reviewText ? (
            <div className="border-t pt-4">
              <p className="hr-text-secondary text-xs">Client feedback</p>
              <p className="hr-text-primary mt-1 text-sm leading-relaxed">
                "{reputationRecord.reviewText}"
              </p>
            </div>
          ) : null}

          <div className="border-t pt-4">
            {reputationRecord.txHash ? (
              <a
                href={getTxExplorerUrl(reputationRecord.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="hr-mode-text inline-flex items-center gap-1 text-sm hover:underline"
              >
                Payment transaction on Stellar
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : (
              <p className="hr-text-muted text-xs">Transaction link not available</p>
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
  return (
    <section aria-labelledby="proof-reputation-title" className="space-y-2">
      <h2 id="proof-reputation-title" className="hr-text-primary text-base font-semibold">
        Reputation record
      </h2>
      <StatusText tone={tone === "muted" ? "neutral" : tone}>{title}</StatusText>
      <div className="hr-text-secondary max-w-3xl text-sm leading-relaxed">{content}</div>
    </section>
  );
}
