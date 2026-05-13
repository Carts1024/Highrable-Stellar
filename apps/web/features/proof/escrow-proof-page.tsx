"use client";

import { api } from "@repo/convex-client";
import { useAction, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import { EscrowProofExplanationCard } from "./components/escrow-proof-explanation-card";
import { EscrowProofHeader } from "./components/escrow-proof-header";
import { EscrowProofParticipants } from "./components/escrow-proof-participants";
import { EscrowProofPaymentSection } from "./components/escrow-proof-payment-section";
import { EscrowProofReputationSection } from "./components/escrow-proof-reputation-section";
import { EscrowProofShareActions } from "./components/escrow-proof-share-actions";
import { EscrowProofSyncSection } from "./components/escrow-proof-sync-section";
import { EscrowProofTimeline } from "./components/escrow-proof-timeline";
import { EscrowProofWorkDetails } from "./components/escrow-proof-work-details";
import { sanitizeEscrowIdParam } from "./lib/format";

import type { TEscrowProof } from "./types";

type TSyncResult = {
  readonly ok: boolean;
  readonly changed?: boolean;
  readonly previousStatus?: string;
  readonly newStatus?: string;
  readonly reason?: string;
  readonly errorMessage?: string;
};

function formatSyncMessage(result: TSyncResult): string {
  if (!result.ok) {
    if (result.reason === "convex_escrow_not_found") {
      return "Could not sync proof: escrow record not found.";
    }

    if (result.reason === "onchain_completion_not_found") {
      return "Could not sync proof: reputation completion not found on-chain.";
    }

    if (result.reason === "unsafe_status_downgrade") {
      return "Could not sync proof because the on-chain status would downgrade this escrow.";
    }

    return result.errorMessage ? `Could not sync proof: ${result.errorMessage}` : "Could not sync proof.";
  }

  if (result.reason === "already_up_to_date" || result.reason === "already_exists") {
    return "Already synced.";
  }

  if (result.changed && result.previousStatus && result.newStatus) {
    return `Updated from ${result.previousStatus} to ${result.newStatus}.`;
  }

  return result.changed ? "Sync complete." : "Already synced.";
}

export function EscrowProofPage({ escrowId }: { readonly escrowId: string }) {
  const sanitizedEscrowId = useMemo(() => sanitizeEscrowIdParam(escrowId), [escrowId]);
  const proof = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).proofs.getEscrowProof,
    sanitizedEscrowId ? { escrowId: sanitizedEscrowId } : "skip",
  ) as TEscrowProof | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncEscrowStatusAction = useAction((api as any).sync.syncEscrowStatus);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncReputationRecordAction = useAction((api as any).sync.syncReputationRecord);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const runSync = useCallback(
    async (syncType: "escrow" | "reputation") => {
      if (!sanitizedEscrowId) {
        return;
      }

      setIsSyncing(true);
      setSyncMessage(null);

      try {
        const result = (await (syncType === "escrow"
          ? syncEscrowStatusAction({ escrowId: sanitizedEscrowId })
          : syncReputationRecordAction({ escrowId: sanitizedEscrowId }))) as TSyncResult;
        setSyncMessage(formatSyncMessage(result));
      } catch (error) {
        setSyncMessage(
          error instanceof Error ? `Could not sync proof: ${error.message}` : "Could not sync proof.",
        );
      } finally {
        setIsSyncing(false);
      }
    },
    [sanitizedEscrowId, syncEscrowStatusAction, syncReputationRecordAction],
  );

  if (!sanitizedEscrowId) {
    return <ProofNotFound />;
  }

  if (proof === undefined) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="rounded-2xl border border-[#e8e8e8] bg-white p-6 text-sm text-[#5f5f5f]">
          Loading escrow proof...
        </p>
      </main>
    );
  }

  if (proof === null) {
    return <ProofNotFound />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <EscrowProofHeader proof={proof} />
      <EscrowProofWorkDetails proof={proof} />
      <EscrowProofParticipants
        clientWallet={proof.escrow.clientWallet}
        freelancerWallet={proof.escrow.freelancerWallet}
        clientProfile={proof.clientProfile}
        freelancerProfile={proof.freelancerProfile}
      />
      <EscrowProofTimeline proof={proof} />
      <EscrowProofPaymentSection proof={proof} />
      <EscrowProofReputationSection
        proof={proof}
        isSyncing={isSyncing}
        syncMessage={syncMessage}
        onSyncReputation={() => void runSync("reputation")}
      />
      <EscrowProofSyncSection
        isSyncing={isSyncing}
        syncMessage={syncMessage}
        onSyncEscrow={() => void runSync("escrow")}
      />
      <EscrowProofShareActions proof={proof} />
      <EscrowProofExplanationCard proofStatus={proof.proofStatus} />
    </main>
  );
}

function ProofNotFound() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="rounded-2xl border border-[#e8e8e8] bg-white p-6 text-sm text-[#5f5f5f]">
        Escrow proof not found.
      </p>
    </main>
  );
}
