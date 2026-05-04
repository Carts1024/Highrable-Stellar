"use client";

import { api } from "@repo/convex-client";
import { useAction } from "convex/react";
import { useCallback, useState } from "react";

import type { TConvexDoc } from "@repo/convex-client";

export type TSyncResult = {
  ok: boolean;
  changed?: boolean;
  escrowId?: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  errorMessage?: string;
};

type TSyncState = {
  isSyncing: boolean;
  syncResult: TSyncResult | null;
};

const INITIAL_SYNC_STATE: TSyncState = {
  isSyncing: false,
  syncResult: null,
};

function formatSyncMessage(result: TSyncResult): string {
  if (!result.ok) {
    switch (result.reason) {
      case "convex_escrow_not_found":
        return "Sync failed: escrow record not found.";
      case "onchain_escrow_not_found":
        return "Sync failed: escrow not found on-chain.";
      case "onchain_completion_not_found":
        return "Sync failed: reputation completion not found on-chain.";
      case "unsafe_status_downgrade":
        return `Sync skipped: on-chain status (${result.newStatus ?? "unknown"}) would downgrade current status (${result.previousStatus ?? "unknown"}).`;
      case "missing_env_config":
        return `Sync failed: backend is not configured. ${result.errorMessage ?? ""}`.trim();
      case "unknown_onchain_status":
        return "Sync failed: unrecognized on-chain escrow status.";
      case "already_exists":
        return "Reputation record already synced.";
      default:
        return result.errorMessage
          ? `Sync failed: ${result.errorMessage}`
          : "Sync failed. Please try again.";
    }
  }

  if (!result.changed) {
    return "Already synced — Convex matches the on-chain state.";
  }

  if (result.previousStatus && result.newStatus) {
    return `Synced: updated from "${result.previousStatus}" to "${result.newStatus}".`;
  }

  return "Sync complete.";
}

export function useSyncActions({ escrow }: { escrow: TConvexDoc<"escrows"> | null | undefined }) {
  const [state, setState] = useState<TSyncState>(INITIAL_SYNC_STATE);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncEscrowStatusAction = useAction((api as any).sync.syncEscrowStatus);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncReputationRecordAction = useAction((api as any).sync.syncReputationRecord);

  const syncEscrowStatus = useCallback(async (): Promise<TSyncResult | null> => {
    if (!escrow?.escrowId) {
      return null;
    }

    setState({ isSyncing: true, syncResult: null });

    try {
      const result = (await syncEscrowStatusAction({
        escrowId: escrow.escrowId,
      })) as TSyncResult;

      setState({ isSyncing: false, syncResult: result });
      return result;
    } catch (error) {
      const errorResult: TSyncResult = {
        ok: false,
        reason: "action_error",
        errorMessage: error instanceof Error ? error.message : "Unexpected error during sync.",
      };
      setState({ isSyncing: false, syncResult: errorResult });
      return errorResult;
    }
  }, [escrow?.escrowId, syncEscrowStatusAction]);

  const syncReputationRecord = useCallback(async (): Promise<TSyncResult | null> => {
    if (!escrow?.escrowId) {
      return null;
    }

    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = (await syncReputationRecordAction({
        escrowId: escrow.escrowId,
      })) as TSyncResult;

      setState({ isSyncing: false, syncResult: result });
      return result;
    } catch (error) {
      const errorResult: TSyncResult = {
        ok: false,
        reason: "action_error",
        errorMessage: error instanceof Error ? error.message : "Unexpected error during sync.",
      };
      setState({ isSyncing: false, syncResult: errorResult });
      return errorResult;
    }
  }, [escrow?.escrowId, syncReputationRecordAction]);

  const syncEscrowAndReputation = useCallback(async (): Promise<void> => {
    const escrowResult = await syncEscrowStatus();
    if (escrowResult?.ok && escrowResult.newStatus === "released") {
      await syncReputationRecord();
    }
  }, [syncEscrowStatus, syncReputationRecord]);

  const clearSyncResult = useCallback(() => {
    setState(INITIAL_SYNC_STATE);
  }, []);

  return {
    isSyncing: state.isSyncing,
    syncResult: state.syncResult,
    syncMessage: state.syncResult ? formatSyncMessage(state.syncResult) : null,
    syncEscrowStatus,
    syncReputationRecord,
    syncEscrowAndReputation,
    clearSyncResult,
  };
}
