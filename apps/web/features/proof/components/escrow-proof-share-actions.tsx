"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { TEscrowProof } from "../types";

type TCopyTarget = "proof_link" | "escrow_id" | "release_tx";

const COPY_SUCCESS_MESSAGE: Record<TCopyTarget, string> = {
  proof_link: "Copied proof link.",
  escrow_id: "Copied escrow ID.",
  release_tx: "Copied release transaction hash.",
};

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function EscrowProofShareActions({ proof }: { readonly proof: TEscrowProof }) {
  const [copiedTarget, setCopiedTarget] = useState<TCopyTarget | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const proofLink = useMemo(() => {
    if (typeof window === "undefined") {
      return `/proof/${encodeURIComponent(proof.escrow.escrowId)}`;
    }

    return window.location.href;
  }, [proof.escrow.escrowId]);

  const handleCopy = useCallback(async (target: TCopyTarget, value: string | undefined) => {
    if (!value) {
      setCopyError("Nothing to copy.");
      return;
    }

    try {
      await copyText(value);
      setCopiedTarget(target);
      setCopyError(null);
      window.setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      setCopyError("Could not copy proof.");
    }
  }, []);

  const actions: Array<{ target: TCopyTarget; label: string; value?: string }> = [
    { target: "proof_link", label: "Copy proof link", value: proofLink },
    { target: "escrow_id", label: "Copy escrow ID", value: proof.escrow.escrowId },
    {
      target: "release_tx",
      label: "Copy release transaction",
      value: proof.escrow.releaseTxHash,
    },
  ];

  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[#0a0a0a]">Share proof</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.target}
            type="button"
            variant="outline"
            disabled={!action.value}
            onClick={() => void handleCopy(action.target, action.value)}
            className="h-9 rounded-lg"
          >
            {copiedTarget === action.target ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {action.label}
          </Button>
        ))}
      </div>
      {copiedTarget ? (
        <p className="mt-3 text-sm text-emerald-700">{COPY_SUCCESS_MESSAGE[copiedTarget]}</p>
      ) : null}
      {copyError ? <p className="mt-3 text-sm text-red-700">{copyError}</p> : null}
    </section>
  );
}
