import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { CheckCircle2 } from "lucide-react";

interface IVerifiedBadgeProps {
  readonly label?: string;
  readonly description?: string;
}

export function VerifiedBadge({
  label = "Verified Review",
  description = "This reputation signal is backed by a paid Highrable escrow completion.",
}: IVerifiedBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
          aria-label={`${label}. Tap for verification details.`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={8} className="max-w-xs text-sm leading-relaxed">
        <p className="font-mono text-[0.65rem] tracking-[0.08em] text-emerald-700 uppercase">
          {label}
        </p>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
