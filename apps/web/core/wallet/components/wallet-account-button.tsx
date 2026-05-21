"use client";

import { WalletStatusDialog } from "@/core/wallet/components/wallet-status-dialog";
import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

interface IWalletAccountButtonProps {
  readonly className?: string;
}

export function WalletAccountButton({ className }: IWalletAccountButtonProps) {
  const walletIdentity = useHighrableWalletIdentity();

  if (!walletIdentity.isConnected || !walletIdentity.displayAddress) {
    return null;
  }

  const accountToneClassName =
    walletIdentity.walletType === "passkey_smart_account"
      ? "border-[color:rgba(255,112,3,0.32)] bg-[color:rgba(255,247,237,0.98)] text-[var(--highrable-orange-4)]"
      : "border-border bg-background text-foreground";

  return (
    <WalletStatusDialog
      trigger={
        <AppButton
          type="button"
          variant="outline"
          className={cn(
            "rounded-lg px-4 py-2 font-mono text-xs tracking-[0.06em] uppercase shadow-none transition-colors hover:border-[var(--highrable-orange-2)] hover:bg-[var(--highrable-surface-accent)] hover:text-[var(--highrable-orange-4)]",
            accountToneClassName,
            className,
          )}
          aria-label={`Open ${walletIdentity.walletType === "passkey_smart_account" ? "passkey account" : "wallet"} details`}
        >
          <span>{walletIdentity.displayAddress}</span>
        </AppButton>
      }
    />
  );
}
