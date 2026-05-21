"use client";

import { useWallet } from "@/core/wallet/hooks/use-wallet";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Check, Copy, LogOut } from "lucide-react";
import { useMemo, useState } from "react";

interface ICopyableWalletAddressFieldProps {
  readonly walletAddress: string;
}

interface IExternalWalletDetailsCardProps {
  readonly walletAddress: string;
  readonly walletProviderName: string;
  readonly onDisconnect: () => Promise<unknown>;
}

type TSanitizedWalletAddressResult =
  | {
      readonly isValid: true;
      readonly value: string;
    }
  | {
      readonly isValid: false;
      readonly value: null;
    };

function sanitizeExternalWalletAddress(
  walletAddress: string | null | undefined,
): TSanitizedWalletAddressResult {
  const normalizedAddress = walletAddress?.trim().toUpperCase() ?? "";
  const parseResult = TStellarPublicKeySchema.safeParse(normalizedAddress);

  if (!parseResult.success) {
    return { isValid: false, value: null };
  }

  return { isValid: true, value: parseResult.data };
}

function sanitizeWalletProviderName(walletProviderName: string | null | undefined): string {
  const sanitizedProviderName = walletProviderName?.trim().replace(/\s+/g, " ").slice(0, 64);

  return sanitizedProviderName || "External wallet";
}

function CopyableWalletAddressField({ walletAddress }: ICopyableWalletAddressFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyWalletAddress = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="external-wallet-address" className="text-sm font-medium text-gray-700">
        Wallet address
      </label>
      <div className="flex gap-2">
        <Input
          id="external-wallet-address"
          type="text"
          value={walletAddress}
          readOnly
          spellCheck={false}
          className="h-10 font-mono text-xs tracking-wide text-gray-900"
          aria-label="Connected external wallet address"
        />
        <AppButton
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void handleCopyWalletAddress()}
          aria-label="Copy external wallet address"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </AppButton>
      </div>
    </div>
  );
}

function ExternalWalletDetailsCard({
  walletAddress,
  walletProviderName,
  onDisconnect,
}: IExternalWalletDetailsCardProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">Wallet type</p>
          <p className="text-sm font-semibold text-gray-900">{walletProviderName}</p>
        </div>
        <CopyableWalletAddressField walletAddress={walletAddress} />
        <AppButton type="button" variant="outline" onClick={() => void onDisconnect()}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Disconnect
        </AppButton>
      </div>
    </section>
  );
}

export function ExternalWalletDetailsCardContainer() {
  const { walletState, disconnectWallet } = useWallet();

  const sanitizedAddressResult = useMemo(
    () => sanitizeExternalWalletAddress(walletState.walletAddress),
    [walletState.walletAddress],
  );
  const walletProviderName = useMemo(
    () => sanitizeWalletProviderName(walletState.selectedWallet),
    [walletState.selectedWallet],
  );

  if (!walletState.isConnected) {
    return null;
  }

  if (!sanitizedAddressResult.isValid) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-amber-900">Wallet address unavailable</p>
        <p className="mt-2 text-sm text-amber-800">
          The connected wallet returned an invalid Stellar public key. Disconnect and reconnect your
          wallet.
        </p>
        <AppButton
          type="button"
          variant="outline"
          className="mt-4 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
          onClick={() => void disconnectWallet()}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Disconnect
        </AppButton>
      </section>
    );
  }

  return (
    <ExternalWalletDetailsCard
      walletAddress={sanitizedAddressResult.value}
      walletProviderName={walletProviderName}
      onDisconnect={disconnectWallet}
    />
  );
}
