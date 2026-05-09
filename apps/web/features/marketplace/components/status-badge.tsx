import type { TEscrowStatus, TJobStatus } from "@/features/marketplace/types";

type TStatusValue = TJobStatus | TEscrowStatus;

interface IStatusBadgeProps {
  readonly label: TStatusValue;
  readonly ariaLabel?: string;
}

const STATUS_STYLES: Record<TStatusValue, string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  selected: "border-orange-200 bg-orange-50 text-orange-700",
  funded: "border-blue-200 bg-blue-50 text-blue-700",
  submitted: "border-indigo-200 bg-indigo-50 text-indigo-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-gray-300 bg-gray-100 text-gray-700",
  disputed: "border-red-200 bg-red-50 text-red-700",
  created: "border-amber-200 bg-amber-50 text-amber-700",
  released: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const STATUS_DESCRIPTIONS: Record<TStatusValue, string> = {
  open: "Job is open and accepting freelancer applications",
  selected: "Freelancer has been selected, escrow setup in progress",
  funded: "Payment is locked in escrow, freelancer can begin work",
  submitted: "Work has been submitted, awaiting client review",
  completed: "Project completed successfully",
  cancelled: "Project was cancelled",
  disputed: "Project is under dispute review",
  created: "Escrow record created",
  released: "Payment has been released to freelancer",
};

/**
 * Semantic status indicator with accessible labeling and description.
 * Implements: Semantic HTML, accessibility (aria-label, title), consistency.
 */
export function StatusBadge({ label, ariaLabel }: IStatusBadgeProps) {
  const normalizedLabel = label.replace("_", " ");
  const description = STATUS_DESCRIPTIONS[label];
  const accessibleLabel = ariaLabel ?? `Status: ${normalizedLabel}`;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase ${STATUS_STYLES[label]}`}
      role="status"
      aria-label={accessibleLabel}
      title={description}
    >
      {normalizedLabel}
    </span>
  );
}
