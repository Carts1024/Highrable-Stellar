"use client";

import { PasskeySmartAccountCard } from "@/core/wallet/components/passkey-smart-account-card";
import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { usePasskeySmartAccount } from "@/core/wallet/passkey-smart-account-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Wallet } from "lucide-react";
import { useState } from "react";

export function WalletConnectTrigger({
  className,
  label = "Connect Wallet",
}: {
  className?: string;
  label?: string;
}) {
  const { connectWallet, walletState } = useWallet();
  const { setActiveWalletMode } = usePasskeySmartAccount();
  const [isOpen, setIsOpen] = useState(false);

  const handleExternalWalletConnect = () => {
    setActiveWalletMode("external_wallet");
    setIsOpen(false);
    void connectWallet();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={walletState.isConnecting}
        className={className}
      >
        {walletState.isConnecting ? "Connecting wallet..." : label}
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl border-[#e8e8e8] bg-white p-0 sm:max-w-3xl">
          <div className="p-5">
            <DialogHeader>
              <DialogTitle>Choose Wallet Identity</DialogTitle>
              <DialogDescription>
                Use an external Stellar wallet for escrow transactions, or a passkey smart account
                for Highrable off-chain identity.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                    <button
                      type="button"
                      onClick={handleExternalWalletConnect}
                      disabled={walletState.isConnecting}
                      className="mt-4 rounded-lg bg-linear-to-r from-[#FF7003] to-[#FF8801] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {walletState.isConnecting ? "Opening wallet..." : "Connect External Wallet"}
                    </button>
                  </div>
                </div>
              </section>

              <PasskeySmartAccountCard />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
