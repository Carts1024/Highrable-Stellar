import type { ReactNode } from "react";

interface IEscrowSectionProps {
  /** Accessibility label for the section */
  readonly ariaLabel: string;
  /** Role to conditionally render content */
  readonly role: string | null;
  /** Allowed roles for this section content */
  readonly allowedRoles: string[];
  /** Main action buttons and content */
  readonly children: ReactNode;
  /** Contextual helper text */
  readonly helperText?: string | null;
  /** Warning text (e.g., USDC requirements) */
  readonly warningText?: string | null;
  /** Info/neutral text */
  readonly infoText?: string | null;
}

/**
 * Reusable wrapper for escrow lifecycle sections.
 * Handles role-based visibility, accessibility, and consistent spacing.
 *
 * Implements: SRP (single responsibility: layout), OCP (open for extension),
 * DRY (shared pattern), ACID consistency (immutable props).
 */
export function EscrowSection({
  ariaLabel,
  role,
  allowedRoles,
  children,
  helperText,
  warningText,
  infoText,
}: IEscrowSectionProps) {
  const isRoleAllowed = role !== null && allowedRoles.includes(role);

  if (!isRoleAllowed) {
    return null;
  }

  return (
    <div className="space-y-3" role="region" aria-label={ariaLabel}>
      {children}
      {helperText ? (
        <p className="text-sm text-[#5f5f5f]" role="status">
          {helperText}
        </p>
      ) : null}
      {infoText ? (
        <p className="text-sm text-gray-700" role="status">
          {infoText}
        </p>
      ) : null}
      {warningText ? (
        <p aria-live="polite" className="text-sm text-amber-800" role="alert">
          {warningText}
        </p>
      ) : null}
    </div>
  );
}
