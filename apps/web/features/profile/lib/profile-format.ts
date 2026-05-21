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

export function getSafeExternalProfileUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value.trim());
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
      ? parsedUrl.toString()
      : null;
  } catch {
    return null;
  }
}

function sanitizeProfileHandle(value: string | undefined): string | null {
  const sanitizedValue = value?.trim().replace(/^@/, "");
  return sanitizedValue && /^[a-zA-Z0-9_.-]+$/.test(sanitizedValue) ? sanitizedValue : null;
}

export function getXProfileUrl(value: string | undefined): string | null {
  const handle = sanitizeProfileHandle(value);
  return handle ? `https://x.com/${encodeURIComponent(handle)}` : null;
}

export function getGithubProfileUrl(value: string | undefined): string | null {
  const handle = sanitizeProfileHandle(value);
  return handle ? `https://github.com/${encodeURIComponent(handle)}` : null;
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
