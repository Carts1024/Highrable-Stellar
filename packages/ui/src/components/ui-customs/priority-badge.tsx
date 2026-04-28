import { cn } from "../../lib/utils";
import { Badge } from "./badge";

const PRIORITY_BADGE_VARIANTS: Record<
  IssuePriorityValue,
  "success" | "warning" | "orange" | "error" | "gray"
> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "orange",
  URGENT: "error",
  NO_PRIORITY: "gray",
};

export type IssuePriorityValue = "NO_PRIORITY" | "URGENT" | "HIGH" | "MEDIUM" | "LOW";

interface PriorityBadgeProps {
  priority: IssuePriorityValue;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      variant={PRIORITY_BADGE_VARIANTS[priority]}
      className={cn("inline-flex items-center px-2 py-0.5 text-[10px] font-medium", className)}
    >
      {priority.replace("_", " ")}
    </Badge>
  );
}
