import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { badgeVariants } from "@repo/ui/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";

import type { TMarketplaceStatus } from "@/features/marketplace/lib/escrow-status";

interface IStatusBadgeProps {
  readonly label: TMarketplaceStatus;
  readonly ariaLabel?: string;
}

/**
 * Semantic status indicator with accessible labeling and description.
 * Implements: Semantic HTML, accessibility (aria-label, title), consistency.
 */
export function StatusBadge({ label, ariaLabel }: IStatusBadgeProps) {
  const meta = getMarketplaceStatusMeta(label);
  const accessibleLabel = ariaLabel ?? `Status: ${meta.label}. Tap for details.`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            badgeVariants({ variant: "outline" }),
            "font-mono text-[0.65rem] tracking-[0.06em] uppercase",
            meta.badgeClassName,
          )}
          aria-label={accessibleLabel}
        >
          {meta.label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={8} className="max-w-xs text-sm leading-relaxed">
        <p className="font-mono text-[0.65rem] tracking-[0.08em] uppercase">{meta.label}</p>
        <p className="mt-2 text-muted-foreground">{meta.description}</p>
      </PopoverContent>
    </Popover>
  );
}
