"use client";

import { PasskeySmartAccountCard } from "@/core/wallet/components/passkey-smart-account-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import { api } from "@repo/convex-client";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@repo/ui/components/ui-customs/responsive-dialog";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useMutation } from "convex/react";
import { Wallet } from "lucide-react";
import { useState } from "react";

interface IWalletConnectTriggerProps {
  className?: string;
  label?: string;
}

export function WalletConnectTrigger({
  className,
  label = "Connect Wallet",
}: IWalletConnectTriggerProps) {
  const { connectWallet, walletState } = useWallet();
  const { setActiveWalletMode } = usePasskeySmartAccount();
  const recordWalletIdentity = useMutation(api.users.recordWalletIdentity);
  const [isOpen, setIsOpen] = useState(false);

  const handleExternalWalletConnect = async () => {
    setActiveWalletMode("external_wallet");
    setIsOpen(false);
    const walletAddress = await connectWallet();
    if (walletAddress) {
      await recordWalletIdentity({
        walletAddress,
        walletType: "external_wallet",
      });
    }
  };

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
      <ResponsiveDialogTrigger asChild>
        <AppButton
          type="button"
          variant="highrableGradient"
          disabled={walletState.isConnecting}
          className={cn("rounded-lg font-mono text-xs tracking-[0.08em] uppercase", className)}
        >
          {walletState.isConnecting ? "Connecting wallet..." : label}
        </AppButton>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-3xl border-[#e8e8e8] bg-white p-0 sm:max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Choose account method</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Connect an external wallet or use a device passkey account.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#FF7003]/10 p-2 text-[#FF7003]">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">External Wallet</p>
                  <p className="mt-3 text-sm text-gray-600">
                    Connect Freighter or WalletConnect. This is still required for escrow
                    transaction signing.
                  </p>
                  <AppButton
                    type="button"
                    variant="highrableGradient"
                    onClick={() => void handleExternalWalletConnect()}
                    disabled={walletState.isConnecting}
                    className="mt-4"
                  >
                    {walletState.isConnecting ? "Opening wallet..." : "Connect External Wallet"}
                  </AppButton>
                </div>
              </div>
            </section>

            <PasskeySmartAccountCard />
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
