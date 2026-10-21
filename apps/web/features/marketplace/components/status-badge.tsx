import { StatusText } from "@/features/common/components/status-text";
import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import React from "react";

import type { TMarketplaceStatus } from "@/features/marketplace/lib/escrow-status";

interface IStatusBadgeProps {
  readonly label: TMarketplaceStatus;
  readonly ariaLabel?: string;
}

/** Job, payment-hold or milestone status. Tapping it explains what the status means. */
export function StatusBadge({ label, ariaLabel }: IStatusBadgeProps) {
  const meta = getMarketplaceStatusMeta(label);
  const accessibleLabel = ariaLabel ?? `Status: ${meta.label}. Tap for details.`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-sm underline decoration-border decoration-dotted underline-offset-4 hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          aria-label={accessibleLabel}
        >
          <StatusText tone={meta.tone}>{meta.label}</StatusText>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={8} className="max-w-xs text-sm leading-relaxed">
        <p className="font-medium">{meta.label}</p>
        <p className="mt-1 text-muted-foreground">{meta.description}</p>
      </PopoverContent>
    </Popover>
  );
}
