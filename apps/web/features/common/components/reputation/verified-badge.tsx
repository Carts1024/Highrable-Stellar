import { CheckCircle2 } from "lucide-react";

type IVerifiedBadgeProps = {
  label?: string;
};

export function VerifiedBadge({ label = "Verified Review" }: IVerifiedBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}