"use client";

import { WalletStatusCard } from "@/core/wallet/components/wallet-status-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";

interface IWalletStatusDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function WalletStatusDialog({ isOpen, onOpenChange }: IWalletStatusDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,48rem)] max-w-3xl overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Wallet details</DialogTitle>
          <DialogDescription>
            Review your connected Stellar wallet state and available wallet actions.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(90vh,48rem)] overflow-y-auto overscroll-contain px-1 pr-3 pb-1">
          <WalletStatusCard />
        </div>
      </DialogContent>
    </Dialog>
  );
}
