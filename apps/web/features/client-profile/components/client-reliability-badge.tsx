import { Badge } from "@repo/ui/components/ui/badge";

import type {
  TClientTrustIndicator,
  TClientTrustTone,
} from "@/features/client-profile/lib/client-trust";

const TONE_CLASS_NAMES: Record<TClientTrustTone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
  neutral: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-50",
  warning: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50",
  danger: "border-red-200 bg-red-50 text-red-800 hover:bg-red-50",
};

export function ClientReliabilityBadge({
  indicator,
}: {
  readonly indicator: TClientTrustIndicator;
}) {
  return (
    <Badge variant="outline" className={TONE_CLASS_NAMES[indicator.tone]}>
      {indicator.label}
    </Badge>
  );
}
