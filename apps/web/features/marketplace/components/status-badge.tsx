import type { TEscrowStatus, TJobStatus } from "@/features/marketplace/types";

type TStatusValue = TJobStatus | TEscrowStatus;

const STATUS_STYLES: Record<TStatusValue, string> = {
  open: "bg-emerald-100 text-emerald-800",
  selected: "bg-orange-100 text-orange-800",
  funded: "bg-blue-100 text-blue-800",
  submitted: "bg-indigo-100 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-gray-200 text-gray-700",
  disputed: "bg-red-100 text-red-800",
  created: "bg-amber-100 text-amber-800",
  released: "bg-emerald-100 text-emerald-900",
};

export function StatusBadge({ label }: { label: TStatusValue }) {
  const normalizedLabel = label.replace("_", " ");

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[label]}`}
    >
      {normalizedLabel}
    </span>
  );
}
