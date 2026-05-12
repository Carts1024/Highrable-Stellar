import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";
import { Badge } from "@repo/ui/components/ui/badge";

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
  const accessibleLabel = ariaLabel ?? `Status: ${meta.label}`;

  return (
    <Badge
      variant="outline"
      className={`font-mono text-[0.65rem] tracking-[0.06em] uppercase ${meta.badgeClassName}`}
      role="status"
      aria-label={accessibleLabel}
      title={meta.description}
    >
      {meta.label}
    </Badge>
  );
}
