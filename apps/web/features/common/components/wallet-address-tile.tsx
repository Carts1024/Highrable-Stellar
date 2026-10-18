"use client";

import { cn } from "@repo/ui/lib/utils";
import { Check, Copy } from "lucide-react";
import React from "react";
import { useState } from "react";

interface IWalletAddressTileProps {
  readonly address: string;
  readonly label?: string;
  /** Extra line under the address, e.g. the wallet type. */
  readonly note?: string;
  readonly className?: string;
}

/** Full wallet address (selectable, never cut off) with a label and a copy button. */
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
    <div className={cn("flex items-start gap-3", className)}>
      <div className="min-w-0 flex-1">
        <p className="hr-text-secondary font-sans text-xs">
          {label}
          {note ? <span className="hr-text-muted"> · {note}</span> : null}
        </p>
        <p className="hr-text-primary mt-0.5 font-mono text-xs break-all select-all sm:text-sm">
          {address}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={copied ? "Address copied" : "Copy wallet address"}
        className="hr-text-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
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
