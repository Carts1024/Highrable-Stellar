"use client";

import { PasskeySmartAccountCard } from "@/core/wallet/components/passkey-smart-account-card";
import { WALLETCONNECT_ENABLED } from "@/core/wallet/config";
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
import React from "react";
import { useState } from "react";

interface IWalletConnectTriggerProps {
  className?: string;
  label?: string;
}

export function WalletConnectTrigger({
  className,
  label = "Connect Wallet",
}: IWalletConnectTriggerProps) {
  const { clearWalletError, connectWallet, walletState } = useWallet();
  const { setActiveWalletMode } = usePasskeySmartAccount();
  const recordWalletIdentity = useMutation(api.users.recordWalletIdentity);
  const [isOpen, setIsOpen] = useState(false);
  const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);
  const [pendingIdentityAddress, setPendingIdentityAddress] = useState<string | null>(null);

  const saveExternalWalletIdentity = async (
    walletAddress: string,
    successNotice: string | null = null,
  ): Promise<void> => {
    try {
      await recordWalletIdentity({
        walletAddress,
        walletType: "external_wallet",
      });
      setPendingIdentityAddress(null);
      setConnectionFeedback(successNotice);
      setIsOpen(Boolean(successNotice));
    } catch {
      setPendingIdentityAddress(walletAddress);
      setConnectionFeedback(
        "Your wallet is connected, but Highrable could not save it to your account. Retry to finish setup.",
      );
      setIsOpen(true);
    }
  };

  const handleExternalWalletConnect = async () => {
    setActiveWalletMode("external_wallet");
    clearWalletError();
    setConnectionFeedback(null);

    if (pendingIdentityAddress) {
      await saveExternalWalletIdentity(pendingIdentityAddress);
      return;
    }

    setIsOpen(false);
    let walletConnectNotice: string | null = null;
    const walletAddress = await connectWallet((notice) => {
      walletConnectNotice = notice;
      setConnectionFeedback(notice);
    });

    if (!walletAddress) {
      if (!walletConnectNotice) {
        setConnectionFeedback(
          "Wallet connection was canceled or could not be completed. Try again.",
        );
      }
      setIsOpen(true);
      return;
    }

    await saveExternalWalletIdentity(walletAddress, walletConnectNotice);
  };

  const errorMessage = walletState.error
    ? /closed the modal|cancel(?:led|ed)?/i.test(walletState.error)
      ? "Connection canceled. Choose a wallet to try again."
      : walletState.error
    : connectionFeedback;

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
      <ResponsiveDialogTrigger asChild>
        <AppButton
          type="button"
          variant="highrableGradient"
          disabled={walletState.isConnecting}
          aria-busy={walletState.isConnecting}
          className={cn("rounded-lg font-mono text-xs tracking-[0.08em] uppercase", className)}
        >
          <span aria-live="polite">
            {walletState.isConnecting ? "Connecting wallet..." : label}
          </span>
        </AppButton>
      </ResponsiveDialogTrigger>

      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader className="shrink-0 space-y-2">
          <ResponsiveDialogTitle>Connect Your Account</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Connect a wallet to continue onboarding. Highrable may ask you to sign a separate
            message for authentication.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {walletState.isConnecting ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              Waiting for wallet approval. Return to Highrable after approving in your wallet.
            </p>
          ) : null}

          {errorMessage ? (
            <p
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

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
                      {WALLETCONNECT_ENABLED
                        ? "Freighter or WalletConnect"
                        : "Freighter or another supported Stellar wallet"}
                    </p>
                  </div>
                </div>

                <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                  Connect your external wallet for transaction signing. This is required for escrow
                  operations and will work alongside your passkey account.
                </p>

                {WALLETCONNECT_ENABLED ? (
                  <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                    On a phone, approve the WalletConnect request in Freighter Mobile. On desktop,
                    scan the QR code with Freighter Mobile, approve, then return here.
                  </p>
                ) : null}

                <AppButton
                  type="button"
                  className="mt-2 bg-highrable-orange-2 font-medium shadow-sm transition-all hover:bg-highrable-orange-3 hover:shadow-md"
                  onClick={() => void handleExternalWalletConnect()}
                  disabled={walletState.isConnecting}
                  aria-busy={walletState.isConnecting}
                >
                  <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
                  {walletState.isConnecting
                    ? "Opening wallet..."
                    : pendingIdentityAddress
                      ? "Retry saving wallet"
                      : connectionFeedback || walletState.error
                        ? "Try wallet picker again"
                        : "Connect External Wallet"}
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
