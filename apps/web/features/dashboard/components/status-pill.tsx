const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  selected: "border-orange-200 bg-orange-50 text-orange-800",
  funded: "border-blue-200 bg-blue-50 text-blue-800",
  submitted: "border-indigo-200 bg-indigo-50 text-indigo-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  released: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-gray-300 bg-gray-100 text-gray-700",
  disputed: "border-red-200 bg-red-50 text-red-800",
  open: "border-emerald-200 bg-emerald-50 text-emerald-800",
  created: "border-amber-200 bg-amber-50 text-amber-800",
  not_selected: "border-zinc-300 bg-zinc-100 text-zinc-700",
};

interface IStatusPillProps {
  readonly label: string;
}

function toStatusLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function StatusPill({ label }: IStatusPillProps) {
  const normalized = label.trim().toLowerCase();
  const style = STATUS_STYLES[normalized] ?? "border-zinc-300 bg-zinc-100 text-zinc-700";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] tracking-[0.06em] uppercase ${style}`}
    >
      {toStatusLabel(normalized)}
    </span>
  );
}
