"use client";

import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Check, Copy, KeyRound, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";

export function PasskeySmartAccountCard() {
  const {
    smartAccountAddress,
    isPasskeyConnected,
    isCreating,
    isReconnecting,
    isRestoring,
    error,
    isSupported,
    hasConfig,
    createPasskeyAccount,
    reconnectPasskeyAccount,
    disconnectPasskeyAccount,
    clearPasskeyError,
  } = usePasskeySmartAccount();
  const [copied, setCopied] = useState(false);

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
        <p className="text-sm font-semibold text-gray-900">Use Passkey Smart Account</p>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Passkeys are not supported on this browser or device.
        </p>
      </section>
    );
  }

  if (!hasConfig) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-900">Use Passkey Smart Account</p>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Passkey smart account configuration is missing.
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
          <p className="text-sm font-semibold text-gray-900">Use Passkey Smart Account</p>

          {isPasskeyConnected && smartAccountAddress ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm font-medium text-emerald-700">
                Passkey smart account connected
              </p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Smart account address</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 font-mono text-sm break-all text-gray-900">
                    {shortenWalletAddress(smartAccountAddress)}
                  </p>
                  <AppButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopy()}
                    aria-label="Copy smart account address"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </AppButton>
                </div>
              </div>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Escrow transaction signing with passkeys is not enabled yet. Use Freighter or
                WalletConnect for escrow actions.
              </p>
              <AppButton
                type="button"
                variant="outline"
                onClick={() => void disconnectPasskeyAccount()}
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Disconnect Passkey
              </AppButton>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-600">
                Create a Stellar smart account secured by your device passkey. No seed phrase
                required.
              </p>
              {isCreating ? (
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Creating passkey smart account... Follow your device prompt.
                </p>
              ) : null}
              {isReconnecting || isRestoring ? (
                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Looking for your passkey... Follow your device prompt.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  onClick={() => void createPasskeyAccount()}
                  disabled={isCreating || isReconnecting || isRestoring}
                >
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create Passkey Account
                </AppButton>
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => void reconnectPasskeyAccount()}
                  disabled={isCreating || isReconnecting || isRestoring}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Reconnect Passkey Account
                </AppButton>
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{error}</p>
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPasskeyError}
                className="mt-2"
              >
                Clear error
              </AppButton>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
