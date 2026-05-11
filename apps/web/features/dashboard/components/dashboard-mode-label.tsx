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
    <Badge variant="outline" className="border-[#FF7003]/30 bg-[#FF7003]/5 text-[#B24D00]">
      {MODE_LABEL_COPY[mode]}
    </Badge>
  );
}
