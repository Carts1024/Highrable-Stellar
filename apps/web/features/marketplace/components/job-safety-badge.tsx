import {
  getJobSafetyBadgeClassName,
  getJobSafetyDescription,
  getJobSafetyLabel,
} from "@/features/marketplace/lib/job-safety";
import { badgeVariants } from "@repo/ui/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";

import type { TJobSafetyStatus } from "@/features/marketplace/lib/job-safety";

interface IJobSafetyBadgeProps {
  readonly status: TJobSafetyStatus;
  readonly compact?: boolean;
}

export function JobSafetyBadge({ status, compact = false }: IJobSafetyBadgeProps) {
  const label = getJobSafetyLabel(status);
  const displayLabel = compact ? label.replace("Verified ", "") : label;
  const description = getJobSafetyDescription(status);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            badgeVariants({ variant: "outline" }),
            "font-mono text-[0.65rem] tracking-[0.06em] uppercase",
            getJobSafetyBadgeClassName(status),
          )}
          aria-label={`Safety status: ${label}. Tap for details.`}
        >
          {displayLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={8} className="max-w-xs text-sm leading-relaxed">
        <p className="font-mono text-[0.65rem] tracking-[0.08em] uppercase">{label}</p>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
