import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";

import type { TAssetAmount } from "@/features/client-profile/types";

export function formatAssetAmountList(rows: readonly TAssetAmount[], emptyLabel: string): string {
  if (rows.length === 0) {
    return emptyLabel;
  }

  return rows.map((row) => `${formatAmount(row.amount)} ${formatAsset(row.asset)}`).join(" + ");
}

export function formatPercent(value: number | null): string {
  if (value === null) {
    return "Not enough history";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value);
}

export function getClientWorkTypeLabel(workType: "micro_gig" | "milestone_project" | "milestone") {
  return workType === "micro_gig" ? "Micro Gig" : "Milestone";
}

export function formatShortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}
