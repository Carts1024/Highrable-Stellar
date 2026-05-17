"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { KeyRound, Wallet } from "lucide-react";

function getButtonClass(isActive: boolean): string {
  return `flex min-w-56 flex-1 items-start gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
    isActive
      ? "border-[#FF7003] bg-[#FF7003]/10 text-[#0a0a0a]"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
  }`;
}

export function WalletModeSwitcher() {
  const walletIdentity = useHighrableWalletIdentity();
  const { walletState } = useWallet();
  const { isPasskeyConnected, smartAccountAddress } = usePasskeySmartAccount();

  const canShowExternal = walletState.isConnected && walletState.walletAddress;
  const canShowPasskey = isPasskeyConnected && smartAccountAddress;

  if (!canShowExternal && !canShowPasskey) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Active Highrable identity</p>
          <p className="mt-1 text-sm text-gray-600">
            Off-chain and escrow actions use the active identity.
          </p>
        </div>
        <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {walletIdentity.walletType === "passkey_smart_account"
            ? "Passkey Smart Account"
            : walletIdentity.walletType === "external_wallet"
              ? "External Wallet"
              : "No active identity"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canShowExternal ? (
          <button
            type="button"
            onClick={() => walletIdentity.setActiveWalletMode("external_wallet")}
            className={getButtonClass(walletIdentity.activeWalletMode === "external_wallet")}
            aria-pressed={walletIdentity.activeWalletMode === "external_wallet"}
          >
            <Wallet className="mt-0.5 h-4 w-4 text-[#FF7003]" aria-hidden="true" />
            <span>
              <span className="block font-semibold">External Wallet</span>
              <span className="mt-1 block text-xs text-emerald-700">Escrow signing enabled.</span>
            </span>
          </button>
        ) : null}

        {canShowPasskey ? (
          <button
            type="button"
            onClick={() => walletIdentity.setActiveWalletMode("passkey_smart_account")}
            className={getButtonClass(walletIdentity.activeWalletMode === "passkey_smart_account")}
            aria-pressed={walletIdentity.activeWalletMode === "passkey_smart_account"}
          >
            <KeyRound className="mt-0.5 h-4 w-4 text-[#FF7003]" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Passkey Smart Account</span>
              <span className="mt-1 block text-xs text-emerald-700">Escrow signing enabled.</span>
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
