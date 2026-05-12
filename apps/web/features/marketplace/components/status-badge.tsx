import { getMarketplaceStatusMeta } from "@/features/marketplace/lib/escrow-status";

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
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase ${meta.badgeClassName}`}
      role="status"
      aria-label={accessibleLabel}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}
