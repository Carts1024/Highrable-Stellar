"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { RouteCallout, RoutePanel, RoutePanelHeader } from "@/features/common";
import { Button as AppButton } from "@repo/ui/components/ui/button";

export function AdminSessionGate({ children }: { readonly children: React.ReactNode }) {
  const { authSession, authenticateWallet, walletState } = useWallet();

  if (!authSession) {
    return (
      <RoutePanel className="max-w-2xl">
        <RoutePanelHeader
          eyebrow="Admin Session"
          title="Authenticate Admin Wallet"
          description="The connected wallet has the admin role. Sign the Highrable session message to access admin API routes."
        />
        <div className="space-y-4 px-6 pb-6">
          {walletState.error ? (
            <RouteCallout tone="danger">{walletState.error}</RouteCallout>
          ) : null}
          <AppButton type="button" onClick={() => void authenticateWallet()}>
            Authenticate Wallet
          </AppButton>
        </div>
      </RoutePanel>
    );
  }

  return <>{children}</>;
}
