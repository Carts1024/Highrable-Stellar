"use client";

import { cn } from "@repo/ui/lib/utils";
import { Check, Copy, Wallet } from "lucide-react";
import React from "react";
import { useState } from "react";

interface IWalletAddressTileProps {
  readonly address: string;
  readonly label?: string;
  /** Extra line under the address, e.g. the wallet type. */
  readonly note?: string;
  readonly className?: string;
}

/**
 * Wallet addresses always look the same: a sky-blue tile with a wallet icon, the full address
 * (selectable, never cut off) and a copy button. Blue is only used for addresses, so they stand
 * out from the orange/yellow of actions.
 */
export function WalletAddressTile({
  address,
  label = "Wallet address",
  note,
  className,
}: IWalletAddressTileProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={cn(
        "hr-tone-sky hr-tone-card flex items-center gap-3 rounded-xl px-3 py-2.5",
        className,
      )}
    >
      <span className="hr-tone-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
        <Wallet className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-xs font-semibold" style={{ color: "var(--tone-fg)" }}>
          {label}
          {note ? <span className="font-normal opacity-80"> · {note}</span> : null}
        </p>
        <p className="mt-0.5 font-mono text-xs break-all text-[#0c4a6e] select-all sm:text-sm">
          {address}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={copied ? "Address copied" : "Copy wallet address"}
        className="hr-tone-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-sky-50"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
