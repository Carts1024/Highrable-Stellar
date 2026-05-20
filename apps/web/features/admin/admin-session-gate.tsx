"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { Button as AppButton } from "@repo/ui/components/ui/button";

export function AdminSessionGate({ children }: { readonly children: React.ReactNode }) {
  const { authSession, authenticateWallet, walletState } = useWallet();

  if (!authSession) {
    return (
      <section className="rounded-xl border border-[#e8e8e8] bg-white p-5">
        <p className="font-mono text-xs text-[#5f5f5f] uppercase">Admin Session</p>
        <h1 className="mt-1 text-xl font-semibold text-[#0a0a0a]">Authenticate Admin Wallet</h1>
        <p className="mt-2 text-sm text-[#5f5f5f]">
          The connected wallet has the admin role. Sign the Highrable session message to access
          admin API routes.
        </p>
        {walletState.error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {walletState.error}
          </p>
        ) : null}
        <AppButton type="button" className="mt-4" onClick={() => void authenticateWallet()}>
          Authenticate Wallet
        </AppButton>
      </section>
    );
  }

  return <>{children}</>;
}
