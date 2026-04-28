import { cn } from "../../lib/utils";
import { Badge } from "./badge";

interface StatusBadgeProps {
  status: string;
  activeValue?: string;
  className?: string;
}

export function StatusBadge({ status, activeValue = "ACTIVE", className }: StatusBadgeProps) {
  const isActive = status === activeValue;

  return (
    <Badge
      variant={isActive ? "success" : "gray"}
      className={cn("px-2 py-0.5 text-[10px] font-medium", className)}
    >
      {status}
    </Badge>
  );
}
