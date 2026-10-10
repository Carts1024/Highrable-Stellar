"use client";

import { getRequiredAdminContractConfig } from "@/core/config/stellar-contracts";
import { addDisputeAdminOnChain, removeDisputeAdminOnChain } from "@/core/stellar/escrow-contract";
import { normalizeStellarError } from "@/core/stellar/transaction";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import {
  AdminSessionGate,
  ADMIN_QUERY_KEY,
  useAdminSessionAccess,
} from "@/features/admin/admin-session-gate";
import { AdminSection } from "@/features/admin/components/admin-operations-ui";
import {
  failAdminMembershipOperationBeforeSubmission,
  fetchAdminMembershipManagement,
  isAdminAccessError,
  recoverAdminMembershipOperation,
  recordAdminMembershipSignedTransaction,
  startAdminMembershipOperation,
} from "@/features/admin/lib/admin-api";
import { ProductPageHero, RouteCallout, showWarningToast } from "@/features/common";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IAdminMembershipOperation } from "@/features/admin/types";

function createOperationId(wallet: string, action: string): string {
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `dispute-admin:${action}:${wallet.toUpperCase()}:${unique}`;
}

function AdminAdminsContent() {
  const { verifiedWallet, handleProtectedApiError } = useAdminSessionAccess();
  const walletIdentity = useHighrableWalletIdentity();
  const { address, signTransaction, walletState } = useWallet();
  const queryClient = useQueryClient();
  const [targetWallet, setTargetWallet] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busyOperationId, setBusyOperationId] = useState<string | null>(null);

  const managementQuery = useQuery({
    queryKey: [...ADMIN_QUERY_KEY, "admins", verifiedWallet],
    queryFn: ({ signal }) => fetchAdminMembershipManagement({ signal }),
    retry: (failureCount, error) => !isAdminAccessError(error) && failureCount < 2,
  });

  useEffect(() => {
    if (managementQuery.error) {
      handleProtectedApiError(managementQuery.error);
    }
  }, [handleProtectedApiError, managementQuery.error]);

  const activeWalletAddress = walletIdentity.walletAddress;
  const membershipByWallet = useMemo(
    () => new Map(managementQuery.data?.admins.map((admin) => [admin.wallet, admin]) ?? []),
    [managementQuery.data?.admins],
  );

  const refresh = useCallback(async () => {
    await managementQuery.refetch();
    await queryClient.invalidateQueries({ queryKey: [...ADMIN_QUERY_KEY, "session"] });
  }, [managementQuery.refetch, queryClient]);

  const executeOperation = useCallback(
    async (operation: IAdminMembershipOperation) => {
      if (!activeWalletAddress || activeWalletAddress.toUpperCase() !== verifiedWallet) {
        const message = "Reconnect the verified external owner wallet before signing.";
        setActionError(message);
        showWarningToast(message);
        return;
      }
      if (!walletState.isConnected || !address) {
        const message = "Connect the external owner wallet before signing.";
        setActionError(message);
        showWarningToast(message);
        return;
      }

      setIsWorking(true);
      setBusyOperationId(operation.operationId);
      setActionError(null);
      setActionSuccess(null);
      let persistedSignedIdentity = Boolean(operation.transactionHash);
      try {
        const config = getRequiredAdminContractConfig();
        if ((config.network === "testnet") !== walletState.isTestnet) {
          throw new Error(
            `Switch the connected wallet to the configured ${config.network} network.`,
          );
        }

        if (operation.transactionHash) {
          const recovered = await recoverAdminMembershipOperation(operation.operationId);
          if (recovered.status === "pending") {
            setActionSuccess(
              "The signed transaction is still pending. You can reconcile it again later.",
            );
          } else {
            setActionSuccess(`Membership operation ${recovered.operation.status}.`);
          }
          await refresh();
          return;
        }

        const submit =
          operation.action === "grant" ? addDisputeAdminOnChain : removeDisputeAdminOnChain;
        await submit({
          rpcUrl: config.rpcUrl,
          networkPassphrase: config.networkPassphrase,
          escrowContractId: config.escrowContractId,
          sourceAddress: activeWalletAddress,
          signTransaction,
          walletType: "external_wallet",
          operationId: operation.operationId,
          platformAdmin: verifiedWallet,
          disputeAdmin: operation.wallet,
          onSigned: async ({ transactionHash, transactionValidUntil }) => {
            await recordAdminMembershipSignedTransaction(
              operation.operationId,
              transactionHash,
              transactionValidUntil,
            );
            persistedSignedIdentity = true;
          },
        });

        const recovered = await recoverAdminMembershipOperation(operation.operationId);
        if (recovered.status === "pending") {
          setActionSuccess(
            "The chain operation is pending confirmation. Use Reconcile to check its saved transaction.",
          );
        } else {
          setActionSuccess(
            `Dispute admin ${operation.action === "grant" ? "granted" : "revoked"}.`,
          );
        }
        await refresh();
      } catch (error) {
        handleProtectedApiError(error);
        const message = normalizeStellarError(error);
        setActionError(message);
        if (!persistedSignedIdentity) {
          await failAdminMembershipOperationBeforeSubmission(operation.operationId, message).catch(
            () => undefined,
          );
        } else {
          await recoverAdminMembershipOperation(operation.operationId).catch(() => undefined);
        }
        await refresh();
      } finally {
        setIsWorking(false);
        setBusyOperationId(null);
      }
    },
    [
      activeWalletAddress,
      address,
      handleProtectedApiError,
      refresh,
      signTransaction,
      verifiedWallet,
      walletState.isConnected,
      walletState.isTestnet,
    ],
  );

  const handleStartOperation = useCallback(
    async (action: "grant" | "revoke") => {
      const wallet = targetWallet.trim().toUpperCase();
      if (!wallet) {
        const message = "Enter a Stellar wallet address.";
        setActionError(message);
        showWarningToast(message);
        return;
      }

      setIsWorking(true);
      setActionError(null);
      setActionSuccess(null);
      try {
        const { operation } = await startAdminMembershipOperation({
          wallet,
          action,
          operationId: createOperationId(wallet, action),
        });
        setTargetWallet("");
        await refresh();
        if (!operation) {
          throw new Error("Membership operation was not saved.");
        }
        await executeOperation(operation);
      } catch (error) {
        handleProtectedApiError(error);
        setActionError(
          error instanceof Error ? error.message : "Could not start membership change.",
        );
      } finally {
        setIsWorking(false);
      }
    },
    [executeOperation, handleProtectedApiError, refresh, targetWallet],
  );

  const handleRecover = useCallback(
    async (operation: IAdminMembershipOperation) => {
      setBusyOperationId(operation.operationId);
      setActionError(null);
      setActionSuccess(null);
      try {
        const result = await recoverAdminMembershipOperation(operation.operationId);
        setActionSuccess(
          result.status === "pending"
            ? "The saved transaction is still pending. Recovery will not submit it again."
            : `Membership operation ${result.operation.status}.`,
        );
        await refresh();
      } catch (error) {
        handleProtectedApiError(error);
        setActionError(
          error instanceof Error ? error.message : "Could not recover membership operation.",
        );
      } finally {
        setBusyOperationId(null);
      }
    },
    [handleProtectedApiError, refresh],
  );

  return (
    <div className="space-y-6">
      <ProductPageHero
        label="Owner Access"
        title={
          <>
            Dispute <span className="hr-v2-gradient-text">Admin Team</span>
          </>
        }
        description="Manage dispute-only wallet access. Grants take effect after the contract transaction is verified; revocations disable app access as soon as the request starts."
      />

      <div className="flex justify-end">
        <AppButton asChild variant="secondary" size="sm">
          <Link href="/admin/disputes">Open Dispute Queue</Link>
        </AppButton>
      </div>

      {actionError ? <RouteCallout tone="danger">{actionError}</RouteCallout> : null}
      {actionSuccess ? <RouteCallout>{actionSuccess}</RouteCallout> : null}

      <AdminSection label="Membership" title="Grant or revoke dispute access">
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor="dispute-admin-wallet" className="grid min-w-72 gap-1.5 text-sm">
            <span className="text-xs tracking-wide text-[#7f7f7f] uppercase">Stellar wallet</span>
            <AppInput
              id="dispute-admin-wallet"
              value={targetWallet}
              onChange={(event) => setTargetWallet(event.target.value.toUpperCase())}
              placeholder="G..."
              maxLength={56}
              autoComplete="off"
              disabled={isWorking}
            />
          </label>
          <AppButton
            type="button"
            onClick={() => void handleStartOperation("grant")}
            disabled={isWorking}
          >
            Grant Access
          </AppButton>
          <AppButton
            type="button"
            variant="secondary"
            onClick={() => void handleStartOperation("revoke")}
            disabled={isWorking}
          >
            Revoke Access
          </AppButton>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#777]">
          Use the owner wallet to sign contract membership changes. The owner remains implicitly
          authorized and cannot be revoked.
        </p>
      </AdminSection>

      <AdminSection label="Current Scope" title="Dispute admins">
        {managementQuery.isPending ? (
          <p className="text-sm text-[#777]">Loading dispute admin membership…</p>
        ) : managementQuery.isError ? (
          <RouteCallout tone="danger">{managementQuery.error.message}</RouteCallout>
        ) : (
          <div className="divide-y divide-[#e8e8e8] border border-[#e8e8e8]">
            <div className="grid gap-3 p-4 md:grid-cols-[1fr_160px_180px]">
              <span className="font-mono text-xs break-all">{verifiedWallet} (platform owner)</span>
              <span className="text-sm">Active</span>
              <span className="text-xs text-[#777]">Implicit, non-removable</span>
            </div>
            {managementQuery.data?.admins.map((admin) => (
              <div key={admin.wallet} className="grid gap-3 p-4 md:grid-cols-[1fr_160px_180px]">
                <span className="font-mono text-xs break-all">{admin.wallet}</span>
                <span className="text-sm capitalize">{admin.accessState}</span>
                <span className="text-xs text-[#777]">
                  {admin.accessState === "active"
                    ? "Can access disputes"
                    : "Cannot access disputes"}
                </span>
              </div>
            ))}
            {managementQuery.data?.admins.length === 0 ? (
              <p className="p-4 text-sm text-[#777]">No additional dispute admins yet.</p>
            ) : null}
          </div>
        )}
      </AdminSection>

      <AdminSection label="Recovery" title="Membership operations">
        {managementQuery.data?.operations.length ? (
          <div className="divide-y divide-[#e8e8e8] border border-[#e8e8e8]">
            {managementQuery.data.operations.map((operation) => {
              const membership = membershipByWallet.get(operation.wallet);
              const isBusy = busyOperationId === operation.operationId;
              return (
                <div
                  key={operation._id}
                  className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_130px_160px_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs break-all">{operation.wallet}</p>
                    <p className="mt-1 text-xs text-[#777]">
                      {operation.action} · app access {membership?.accessState ?? "inactive"}
                    </p>
                    {operation.transactionHash ? (
                      <a
                        className="mt-1 inline-flex items-center gap-1 text-xs text-[#b64f00] underline"
                        href={`https://stellar.expert/explorer/${operation.network}/tx/${operation.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Transaction <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                  <span className="text-sm capitalize">
                    {operation.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-xs text-[#777]">
                    {operation.errorMessage ?? operation.operationId}
                  </span>
                  <div className="flex gap-2">
                    {operation.status === "awaiting_signature" ? (
                      <AppButton
                        size="sm"
                        disabled={isWorking}
                        onClick={() => void executeOperation(operation)}
                      >
                        {isBusy ? "Signing…" : "Sign"}
                      </AppButton>
                    ) : operation.transactionHash &&
                      !["succeeded", "failed"].includes(operation.status) ? (
                      <AppButton
                        size="sm"
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => void handleRecover(operation)}
                      >
                        {isBusy ? <RotateCcw className="size-4 animate-spin" /> : "Reconcile"}
                      </AppButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[#777]">No membership operations recorded.</p>
        )}
      </AdminSection>
    </div>
  );
}

export function AdminAdminsPage() {
  return (
    <AdminSessionGate requiredCapability="owner">
      <AdminAdminsContent />
    </AdminSessionGate>
  );
}
