"use client";

import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Check, Copy, KeyRound, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

export function PasskeySmartAccountCard() {
  const {
    smartAccountAddress,
    isPasskeyConnected,
    isCreating,
    isReconnecting,
    isRestoring,
    discoveredContracts,
    error,
    isSupported,
    hasConfig,
    isContractPickerOpen,
    createPasskeyAccount,
    reconnectPasskeyAccount,
    selectDiscoveredPasskeyContract,
    dismissContractPicker,
    disconnectPasskeyAccount,
    clearLocalPasskeySession,
    clearPasskeyError,
  } = usePasskeySmartAccount();
  const [copied, setCopied] = useState(false);

  const runPasskeyUiAction = async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
    } catch {
      // The provider stores the user-facing error. Swallow here so cancelled
      // WebAuthn prompts do not become unhandled Next.js runtime errors.
    }
  };

  const handleCopy = async () => {
    if (!smartAccountAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(smartAccountAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  if (!isSupported) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-900">Passkey account</p>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Passkeys are not supported on this browser or device.
        </p>
      </section>
    );
  }

  if (!hasConfig) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-900">Passkey account</p>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Passkey account setup is missing.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#FF7003]/10 p-2 text-[#FF7003]">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Passkey account</p>

          {isPasskeyConnected && smartAccountAddress ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm font-medium text-emerald-700">Passkey account connected</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Account address</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 font-mono text-sm break-all text-gray-900">
                    {shortenWalletAddress(smartAccountAddress)}
                  </p>
                  <AppButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopy()}
                    aria-label="Copy passkey account address"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </AppButton>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => void runPasskeyUiAction(reconnectPasskeyAccount)}
                  disabled={isCreating || isReconnecting || isRestoring}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Switch account
                </AppButton>
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => void disconnectPasskeyAccount()}
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Disconnect
                </AppButton>
                <AppButton
                  type="button"
                  variant="ghost"
                  onClick={() => void clearLocalPasskeySession()}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Clear local session
                </AppButton>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-600">
                Create a device-secured account for faster approvals without a seed phrase.
              </p>
              {isCreating ? (
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Creating passkey account... Follow your device prompt.
                </p>
              ) : null}
              {isReconnecting ? (
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Reconnecting passkey account... Follow your device prompt.
                </p>
              ) : null}
              {isRestoring ? (
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Restoring passkey session...
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  onClick={() => void runPasskeyUiAction(createPasskeyAccount)}
                  disabled={isCreating || isReconnecting || isRestoring}
                >
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create passkey account
                </AppButton>
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => void runPasskeyUiAction(reconnectPasskeyAccount)}
                  disabled={isCreating || isReconnecting || isRestoring}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reconnect
                </AppButton>
                {error ? (
                  <AppButton
                    type="button"
                    variant="ghost"
                    onClick={() => void clearLocalPasskeySession()}
                    disabled={isCreating || isReconnecting || isRestoring}
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Clear local session
                  </AppButton>
                ) : null}
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>{error}</p>
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPasskeyError}
                className="mt-2"
              >
                Clear warning
              </AppButton>
            </div>
          ) : null}
        </div>
      </div>
      <Dialog open={isContractPickerOpen} onOpenChange={(open) => !open && dismissContractPicker()}>
        <DialogContent className="max-w-2xl border-[#e8e8e8] bg-white">
          <DialogHeader>
            <DialogTitle>Select passkey account</DialogTitle>
            <DialogDescription>
              This passkey can connect to multiple accounts. Choose the one you want to use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {discoveredContracts.map((contract) => (
              <button
                key={contract.contract_id}
                type="button"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-[#FF7003]/40 hover:bg-[#FF7003]/5"
                onClick={() =>
                  void runPasskeyUiAction(() =>
                    selectDiscoveredPasskeyContract(contract.contract_id),
                  )
                }
              >
                <p className="font-mono text-sm text-gray-900">{contract.contract_id}</p>
                <p className="mt-2 text-xs text-gray-600">
                  {contract.context_rule_count} rule{contract.context_rule_count === 1 ? "" : "s"} ·{" "}
                  {contract.external_signer_count + contract.delegated_signer_count} signer
                  {contract.external_signer_count + contract.delegated_signer_count === 1
                    ? ""
                    : "s"}{" "}
                  · last seen ledger {contract.last_seen_ledger}
                </p>
              </button>
            ))}
          </div>
          <DialogFooter showCloseButton>
            <span className="mr-auto text-xs text-gray-500">
              Current connected account:{" "}
              {smartAccountAddress ? shortenWalletAddress(smartAccountAddress) : "none"}
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
