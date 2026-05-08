"use client";

import { usePasskeySmartAccount } from "@/core/wallet/hooks/use-passkey-smart-account";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import { useMutation } from "convex/react";
import { KeyRound, RefreshCw, Unplug } from "lucide-react";
import { useCallback, useState } from "react";

import type { TPasskeySmartAccountSession } from "@/core/stellar/smart-account-kit";

type TWalletRole = "client" | "freelancer";

function getProfileSyncErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "Smart account connected, but profile sync failed.";
}

export function PasskeySmartAccountCard() {
  const {
    smartAccountAddress,
    credentialId,
    isPasskeyConnected,
    isCreating,
    isReconnecting,
    error,
    createPasskeyAccount,
    reconnectPasskeyAccount,
    disconnectPasskeyAccount,
    clearPasskeyError,
  } = usePasskeySmartAccount();
  const upsertUser = useMutation(api.users.upsertUser);
  const [role, setRole] = useState<TWalletRole>("freelancer");
  const [profileSyncMessage, setProfileSyncMessage] = useState<string | null>(null);
  const [profileSyncError, setProfileSyncError] = useState<string | null>(null);

  const syncUserProfile = useCallback(
    async (session: TPasskeySmartAccountSession | null) => {
      if (!session?.smartAccountAddress) {
        return;
      }

      try {
        await upsertUser({
          walletAddress: session.smartAccountAddress,
          role,
          walletType: "passkey_smart_account",
          smartAccountAddress: session.smartAccountAddress,
          createdWithPasskey: true,
        });
        setProfileSyncMessage("Passkey smart account connected.");
        setProfileSyncError(null);
      } catch (syncError) {
        setProfileSyncMessage(null);
        setProfileSyncError(getProfileSyncErrorMessage(syncError));
      }
    },
    [role, upsertUser],
  );

  const handleCreate = async () => {
    setProfileSyncMessage(null);
    setProfileSyncError(null);
    const session = await createPasskeyAccount();
    await syncUserProfile(session);
  };

  const handleReconnect = async () => {
    setProfileSyncMessage(null);
    setProfileSyncError(null);
    const session = await reconnectPasskeyAccount();
    await syncUserProfile(session);
  };

  const isBusy = isCreating || isReconnecting;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Use Passkey Smart Account</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Create a Stellar smart account secured by your device passkey. No seed phrase
              required.
            </p>
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This is a testnet smart account. Do not use real funds.
          </p>

          <label className="grid max-w-xs gap-1 text-sm font-medium text-gray-700">
            Highrable role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as TWalletRole)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="freelancer">Freelancer</option>
              <option value="client">Client</option>
            </select>
          </label>

          {isPasskeyConnected && smartAccountAddress ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Smart account address</p>
                <p className="font-mono text-sm break-all text-gray-900">{smartAccountAddress}</p>
              </div>
              {credentialId ? (
                <p className="text-xs text-gray-500">
                  Credential {shortenWalletAddress(credentialId)}
                </p>
              ) : null}
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Passkey account created. Funding/transaction support will be handled in the next
                phase.
              </p>
            </div>
          ) : null}

          {profileSyncMessage ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {profileSyncMessage}
            </p>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={clearPasskeyError}
                className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
              >
                Clear error
              </button>
            </div>
          ) : null}

          {profileSyncError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {profileSyncError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:min-w-64 lg:justify-end">
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {isCreating ? "Creating..." : "Create Passkey Account"}
          </button>
          <button
            type="button"
            onClick={() => void handleReconnect()}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {isReconnecting ? "Reconnecting..." : "Reconnect Passkey Account"}
          </button>
          {isPasskeyConnected ? (
            <button
              type="button"
              onClick={() => void disconnectPasskeyAccount()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Unplug className="h-4 w-4" />
              Disconnect Passkey Account
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
