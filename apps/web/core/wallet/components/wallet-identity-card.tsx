"use client";

import { PasskeySmartAccountCard } from "@/core/wallet/components/passkey-smart-account-card";
import { WalletConnectTrigger } from "@/core/wallet/components/wallet-connect-trigger";
import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { Wallet } from "lucide-react";

export function WalletIdentityCard() {
  const { isConnected } = useWallet();

  return (
    <section className="space-y-4">
      {isConnected ? (
        <WalletStatusCard />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connect Wallet</h2>
              <p className="mt-1 text-sm text-gray-600">
                Use Freighter or WalletConnect with the existing Stellar Wallets Kit flow.
              </p>
            </div>
            <WalletConnectTrigger
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white"
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>
        </div>
      )}

      <PasskeySmartAccountCard />
    </section>
  );
}
