"use client";

import { Button } from "@repo/ui/components/ui/button";
import { RefreshCw } from "lucide-react";

export function EscrowProofSyncSection({
  isSyncing,
  syncMessage,
  onSyncEscrow,
}: {
  readonly isSyncing: boolean;
  readonly syncMessage: string | null;
  readonly onSyncEscrow: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0a0a0a]">Stellar sync</h2>
          <p className="mt-2 text-sm text-[#5f5f5f]">
            Convex mirrors public escrow state for this receipt. Sync reads the known Stellar escrow
            and updates this proof when needed.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={isSyncing}
          onClick={onSyncEscrow}
          className="h-9 rounded-lg disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw className="h-4 w-4" />
          {isSyncing ? "Syncing..." : "Sync escrow status from Stellar"}
        </Button>
      </div>
      {syncMessage ? <p className="mt-3 text-sm text-[#5f5f5f]">{syncMessage}</p> : null}
    </section>
  );
}
