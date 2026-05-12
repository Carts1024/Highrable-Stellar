import {
  getJobSafetyBadgeClassName,
  getJobSafetyDescription,
  getJobSafetyLabel,
} from "@/features/marketplace/lib/job-safety";

import type { TJobSafetyStatus } from "@/features/marketplace/lib/job-safety";

interface IJobSafetyBadgeProps {
  readonly status: TJobSafetyStatus;
  readonly compact?: boolean;
}

export function JobSafetyBadge({ status, compact = false }: IJobSafetyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase ${getJobSafetyBadgeClassName(status)}`}
      role="status"
      title={getJobSafetyDescription(status)}
      aria-label={`Safety status: ${getJobSafetyLabel(status)}`}
    >
      {compact ? getJobSafetyLabel(status).replace("Verified ", "") : getJobSafetyLabel(status)}
    </span>
  );
}
