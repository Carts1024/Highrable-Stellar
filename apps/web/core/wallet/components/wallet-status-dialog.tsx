"use client";

import { WalletIdentityCard } from "@/core/wallet/components/wallet-identity-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";

export function WalletStatusDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Wallet details</DialogTitle>
          <DialogDescription>
            Review your connected Stellar wallet state and available wallet actions.
          </DialogDescription>
        </DialogHeader>
        <WalletIdentityCard />
      </DialogContent>
    </Dialog>
  );
}
