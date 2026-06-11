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

      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader className="shrink-0 space-y-2">
          <ResponsiveDialogTitle>Connect Your Account</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose between an external wallet or a device-secured passkey account.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="flex flex-col gap-5">
            <section className="w-full rounded-2xl border border-border p-6 shadow-md transition-shadow hover:shadow-lg">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-xl bg-highrable-orange-2/10 p-3 text-highrable-orange-2">
                    <Wallet className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="font-sans text-lg font-bold text-foreground">External Wallet</p>
                    <p className="font-sans text-xs text-muted-foreground/80">
                      Freighter or WalletConnect
                    </p>
                  </div>
                </div>

                <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                  Connect your external wallet for transaction signing. This is required for escrow
                  operations and will work seamlessly alongside your passkey account.
                </p>

                <AppButton
                  type="button"
                  className="mt-2 bg-highrable-orange-2 font-medium shadow-sm transition-all hover:bg-highrable-orange-3 hover:shadow-md"
                  onClick={() => void handleExternalWalletConnect()}
                  disabled={walletState.isConnecting}
                >
                  <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
                  {walletState.isConnecting ? "Opening wallet..." : "Connect External Wallet"}
                </AppButton>
              </div>
            </section>

            <PasskeySmartAccountCard />
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
