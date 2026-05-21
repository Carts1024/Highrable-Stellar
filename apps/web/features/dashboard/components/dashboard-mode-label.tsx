import { Badge } from "@repo/ui/components/ui/badge";

import type { TDashboardMode } from "@/features/dashboard/types";

interface IDashboardModeLabelProps {
  readonly mode: TDashboardMode;
}

const MODE_LABEL_COPY: Record<TDashboardMode, string> = {
  freelancer: "Freelancer Mode",
  client: "Client Mode",
};

export function DashboardModeLabel({ mode }: IDashboardModeLabelProps) {
  return (
    <Badge variant="outline" className="hr-v2-badge-accent border-current/20">
      {MODE_LABEL_COPY[mode]}
    </Badge>
  );
}
