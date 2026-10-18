import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";
import { ShieldCheck } from "lucide-react";

export interface IVerifiedBadgeProps {
  readonly label?: string;
  readonly description?: string;
  readonly className?: string;
}

export function VerifiedBadge({
  label = "Verified Review",
  description = "This reputation signal is backed by a paid Highrable payment hold completion.",
  className,
}: IVerifiedBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm text-xs font-medium text-emerald-700 underline decoration-emerald-200 decoration-dotted underline-offset-4 hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
            className,
          )}
          aria-label={`${label}. Tap for verification details.`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={8} className="max-w-xs p-4 text-sm leading-relaxed">
        <p className="hr-text-accent text-xs font-medium">{label}</p>
        <p className="hr-text-secondary mt-2 text-xs">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
