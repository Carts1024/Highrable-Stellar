import { V2_BADGE_ACCENT_CLASS } from "@repo/ui/components/highrable/v2-theme";
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
  description = "This reputation signal is backed by a paid Highrable escrow completion.",
  className,
}: IVerifiedBadgeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all hover:opacity-80 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-hidden",
            V2_BADGE_ACCENT_CLASS,
            className,
          )}
          aria-label={`${label}. Tap for verification details.`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={8}
        className="hr-panel hr-hard-shadow max-w-xs p-4 text-sm leading-relaxed"
      >
        <p className="hr-text-accent font-mono text-[0.65rem] font-medium tracking-[0.08em] uppercase">
          {label}
        </p>
        <p className="hr-text-secondary mt-2 text-xs">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
