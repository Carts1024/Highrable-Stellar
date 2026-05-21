"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { AgreementReferenceCard } from "@/features/work-agreements/components";
import { api } from "@repo/convex-client";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { useAction, useQuery } from "convex/react";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TEscrowProof } from "./types";
import type { ReactNode } from "react";

import { EscrowProofExplanationCard } from "./components/escrow-proof-explanation-card";
import { EscrowProofHeader } from "./components/escrow-proof-header";
import { EscrowProofReputationSection } from "./components/escrow-proof-reputation-section";
import { EscrowProofShareActions } from "./components/escrow-proof-share-actions";
import { EscrowProofTimeline } from "./components/escrow-proof-timeline";
import { EscrowProofWorkDetails } from "./components/escrow-proof-work-details";
import { sanitizeEscrowIdParam } from "./lib/format";

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
      return "Could not refresh this receipt because the payment record was not found.";
    }

    if (result.reason === "onchain_completion_not_found") {
      return "The paid-work badge is not ready yet.";
    }

    if (result.reason === "unsafe_status_downgrade") {
      return "Highrable kept the current receipt because the latest check was older than this view.";
    }

    return result.errorMessage
      ? `Could not refresh this receipt: ${result.errorMessage}`
      : "Could not refresh this receipt.";
  }

  if (result.reason === "already_up_to_date" || result.reason === "already_exists") {
    return "Receipt is up to date.";
  }

  if (result.changed && result.previousStatus && result.newStatus) {
    return `Updated from ${result.previousStatus} to ${result.newStatus}.`;
  }

  return result.changed ? "Receipt updated." : "Receipt is up to date.";
}

export function EscrowProofPage({ escrowId }: { readonly escrowId: string }) {
  const walletIdentity = useHighrableWalletIdentity();
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
  const autoSyncedEscrowIdsRef = useRef(new Set<string>());
  const autoSyncedReputationIdsRef = useRef(new Set<string>());
  const agreementContext = useQuery(
    api.work_agreements.getAgreementContextForProof,
    proof?.job?._id && walletIdentity.walletAddress
      ? { jobId: proof.job._id, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );

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
          error instanceof Error
            ? `Could not refresh this receipt: ${error.message}`
            : "Could not refresh this receipt.",
        );
      } finally {
        setIsSyncing(false);
      }
    },
    [sanitizedEscrowId, syncEscrowStatusAction, syncReputationRecordAction],
  );

  useEffect(() => {
    if (!sanitizedEscrowId || proof === undefined || proof === null) {
      return;
    }

    if (autoSyncedEscrowIdsRef.current.has(sanitizedEscrowId)) {
      return;
    }

    autoSyncedEscrowIdsRef.current.add(sanitizedEscrowId);
    void runSync("escrow");
  }, [proof, runSync, sanitizedEscrowId]);

  useEffect(() => {
    if (
      !sanitizedEscrowId ||
      proof === undefined ||
      proof === null ||
      proof.escrow.status !== "released" ||
      proof.reputationRecord
    ) {
      return;
    }

    if (autoSyncedReputationIdsRef.current.has(sanitizedEscrowId)) {
      return;
    }

    autoSyncedReputationIdsRef.current.add(sanitizedEscrowId);
    void runSync("reputation");
  }, [proof, runSync, sanitizedEscrowId]);

  if (!sanitizedEscrowId) {
    return <ProofNotFound />;
  }

  if (proof === undefined) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="border border-[#e8e8e8] bg-white p-6 text-sm text-[#5f5f5f]">
          Loading proof receipt...
        </p>
      </main>
    );
  }

  if (proof === null) {
    return <ProofNotFound />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <EscrowProofHeader proof={proof} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <EscrowProofWorkDetails proof={proof} />
        <AgreementReferenceCard
          context={agreementContext}
          emptyMessage="No agreement version was attached to this proof submission."
        />
      </div>

      <EscrowProofTimeline proof={proof} />
      <EscrowProofReputationSection proof={proof} isSyncing={isSyncing} syncMessage={syncMessage} />
      <ProofAdvancedDetails>
        <EscrowProofShareActions proof={proof} />
        <EscrowProofExplanationCard proofStatus={proof.proofStatus} />
      </ProofAdvancedDetails>
    </main>
  );
}

function ProofAdvancedDetails({ children }: { readonly children: ReactNode }) {
  return (
    <Collapsible className="border border-[#e8e8e8] bg-white">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
        <div className="space-y-2">
          <SectionLabel>More Options</SectionLabel>
          <div>
            <h2 className="text-lg font-semibold text-[#0a0a0a]">Share and explain</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#5f5f5f]">
              Share controls and a plain-English explanation are available when someone needs more
              context.
            </p>
          </div>
        </div>
        <ChevronDown
          className="h-5 w-5 shrink-0 text-[#7f7f7f] transition-transform group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-[#e8e8e8] p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProofNotFound() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="border border-[#e8e8e8] bg-white p-6 text-sm text-[#5f5f5f]">
        Proof receipt not found.
      </p>
    </main>
  );
}
