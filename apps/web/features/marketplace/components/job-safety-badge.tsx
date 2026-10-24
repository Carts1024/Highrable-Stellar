import { StatusText } from "@/features/common/components/status-text";
import {
  getJobSafetyDescription,
  getJobSafetyLabel,
  getJobSafetyTone,
} from "@/features/marketplace/lib/job-safety";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";
import React from "react";

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
          className="rounded-sm underline decoration-border decoration-dotted underline-offset-4 hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          aria-label={`Safety status: ${label}. Tap for details.`}
        >
          <StatusText tone={getJobSafetyTone(status)}>{displayLabel}</StatusText>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={8} className="max-w-xs text-sm leading-relaxed">
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
