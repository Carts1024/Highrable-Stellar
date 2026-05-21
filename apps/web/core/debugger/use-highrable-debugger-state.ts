"use client";

import { evaluateSmartAccountMainnetReadiness } from "@/core/stellar/mainnet-readiness";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import { useMemo } from "react";

import type {
  IHighrableDebuggerEscrowOverview,
  IHighrableDebuggerEscrowSyncStatus,
  IHighrableDebuggerState,
  IHighrableDebuggerWalletState,
  TManagedEscrow,
} from "./debugger.types";

function getManagedEscrows(
  escrows: readonly TManagedEscrow[] | undefined,
): readonly TManagedEscrow[] {
  return escrows ?? [];
}

function buildEscrowStatusSummary(
  escrows: readonly TManagedEscrow[],
): Readonly<Record<string, number>> {
  return escrows.reduce<Record<string, number>>((statusCounts, escrow) => {
    statusCounts[escrow.status] = (statusCounts[escrow.status] ?? 0) + 1;
    return statusCounts;
  }, {});
}

function getEscrowSyncErrorCount(escrows: readonly TManagedEscrow[]): number {
  return escrows.filter((escrow) => Boolean(escrow.lastSyncErrorMessage)).length;
}

function buildEscrowManagement(
  escrows: readonly TManagedEscrow[],
): IHighrableDebuggerEscrowOverview {
  return {
    total: escrows.length,
    byStatus: buildEscrowStatusSummary(escrows),
    syncErrorCount: getEscrowSyncErrorCount(escrows),
  };
}

function buildEscrowSyncStatus(
  escrows: readonly TManagedEscrow[],
): IHighrableDebuggerEscrowSyncStatus {
  const latestEscrow = escrows[0] ?? null;

  if (!latestEscrow) {
    return {
      latestEscrowId: null,
      convexStatus: null,
      lastSyncedOnChainStatus: null,
      lastSyncOutcome: null,
      lastSyncAt: null,
      lastSyncErrorMessage: null,
    };
  }

  return {
    latestEscrowId: latestEscrow.escrowId,
    convexStatus: latestEscrow.status,
    lastSyncedOnChainStatus: latestEscrow.lastSyncedOnChainStatus ?? null,
    lastSyncOutcome: latestEscrow.lastSyncOutcome ?? null,
    lastSyncAt: latestEscrow.lastSyncAt ?? null,
    lastSyncErrorMessage: latestEscrow.lastSyncErrorMessage ?? null,
  };
}

function buildProductionWarnings(
  readiness: ReturnType<typeof evaluateSmartAccountMainnetReadiness>,
) {
  return [...new Set([...readiness.blockingIssues, ...readiness.warnings])];
}

function buildWalletState(
  walletState: ReturnType<typeof useWallet>["walletState"],
): IHighrableDebuggerWalletState {
  return {
    isConnected: walletState.isConnected,
    selectedWallet: walletState.selectedWallet,
    walletAddress: walletState.walletAddress,
    network: walletState.network,
    isTestnet: walletState.isTestnet,
    isFunded: walletState.isFunded,
    isCheckingFunding: walletState.isCheckingFunding,
    isFundingWithFriendbot: walletState.isFundingWithFriendbot,
    friendbotError: walletState.friendbotError,
    friendbotSuccess: walletState.friendbotSuccess,
    error: walletState.error,
    lastTxStatus: walletState.lastTxStatus,
    canWriteContracts: walletState.canWriteContracts ?? true,
    writeRestrictionReason: walletState.writeRestrictionReason ?? null,
  };
}

/** Aggregates the app's current operational state into a small debugger-friendly model. */
export function useHighrableDebuggerState(): IHighrableDebuggerState {
  const { walletState } = useWallet();
  const passkeySmartAccount = usePasskeySmartAccount();
  const activeHighrableIdentity = useHighrableWalletIdentity();
  const escrowsByWallet = useQuery(
    api.escrows.listEscrowsByWallet,
    activeHighrableIdentity.walletAddress
      ? { walletAddress: activeHighrableIdentity.walletAddress }
      : "skip",
  ) as readonly TManagedEscrow[] | undefined;

  const mainnetSmartAccountReadiness = useMemo(
    () =>
      evaluateSmartAccountMainnetReadiness({
        connectedAccountAddress: passkeySmartAccount.smartAccountAddress,
      }),
    [passkeySmartAccount.smartAccountAddress],
  );

  const managedEscrows = useMemo(() => getManagedEscrows(escrowsByWallet), [escrowsByWallet]);
  const productionHardeningWarnings = useMemo(
    () => buildProductionWarnings(mainnetSmartAccountReadiness),
    [mainnetSmartAccountReadiness],
  );
  const escrowManagement = useMemo(() => buildEscrowManagement(managedEscrows), [managedEscrows]);
  const escrowSyncStatus = useMemo(() => buildEscrowSyncStatus(managedEscrows), [managedEscrows]);

  return {
    walletState: buildWalletState(walletState),
    passkeySmartAccountReadiness: {
      ...passkeySmartAccount,
      hasConfig: passkeySmartAccount.hasConfig,
      isSupported: passkeySmartAccount.isSupported,
    },
    mainnetSmartAccountReadiness,
    productionHardeningWarnings,
    activeHighrableIdentity,
    usePasskeySmartAccount: activeHighrableIdentity.activeWalletMode === "passkey_smart_account",
    escrowManagement,
    escrowSyncStatus,
  };
}
