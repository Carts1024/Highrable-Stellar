import { formatAmount, formatAsset } from "@/features/dashboard/lib/format";

import type { TAssetAmount, TFreelancerWorkType } from "@/features/profile/types";

export function formatAssetAmountList(rows: readonly TAssetAmount[], emptyLabel: string): string {
  if (rows.length === 0) {
    return emptyLabel;
  }

  return rows.map((row) => `${formatAmount(row.amount)} ${formatAsset(row.asset)}`).join(" + ");
}

export function getWorkTypeLabel(workType: TFreelancerWorkType): string {
  return workType === "milestone" ? "Milestone" : "Micro Gig";
}

export function getReviewCompletionType(workType: TFreelancerWorkType): "micro_gig" | "milestone" {
  return workType === "milestone" ? "milestone" : "micro_gig";
}

export function normalizeSkillsInput(skillsInput: string): string[] {
  return Array.from(
    new Set(
      skillsInput
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  );
}
