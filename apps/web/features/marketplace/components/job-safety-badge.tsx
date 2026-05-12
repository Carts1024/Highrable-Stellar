import {
  getJobSafetyBadgeClassName,
  getJobSafetyDescription,
  getJobSafetyLabel,
} from "@/features/marketplace/lib/job-safety";
import { Badge } from "@repo/ui/components/ui/badge";

import type { TJobSafetyStatus } from "@/features/marketplace/lib/job-safety";

interface IJobSafetyBadgeProps {
  readonly status: TJobSafetyStatus;
  readonly compact?: boolean;
}

export function JobSafetyBadge({ status, compact = false }: IJobSafetyBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[0.65rem] tracking-[0.06em] uppercase ${getJobSafetyBadgeClassName(status)}`}
      role="status"
      title={getJobSafetyDescription(status)}
      aria-label={`Safety status: ${getJobSafetyLabel(status)}`}
    >
      {compact ? getJobSafetyLabel(status).replace("Verified ", "") : getJobSafetyLabel(status)}
    </Badge>
  );
}
