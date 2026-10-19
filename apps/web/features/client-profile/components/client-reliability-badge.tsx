import { StatusText, type TStatusTone } from "@/features/common/components/status-text";
import React from "react";

import type {
  TClientTrustIndicator,
  TClientTrustTone,
} from "@/features/client-profile/lib/client-trust";

const TONES: Record<TClientTrustTone, TStatusTone> = {
  positive: "success",
  neutral: "neutral",
  warning: "warning",
  danger: "danger",
};

export function ClientReliabilityBadge({
  indicator,
}: {
  readonly indicator: TClientTrustIndicator;
}) {
  return <StatusText tone={TONES[indicator.tone]}>{indicator.label}</StatusText>;
}
