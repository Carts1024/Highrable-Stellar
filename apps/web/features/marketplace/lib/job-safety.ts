import type { TConvexDoc } from "@repo/convex-client";

export type TJobSafetyStatus =
  | "unfunded"
  | "escrow_created"
  | "verified_funded"
  | "paid"
  | "disputed"
  | "cancelled";

export type TJobSafetySeverity = "low" | "medium" | "high" | "safe" | "neutral";

export type TJobSafetyResult = {
  status: TJobSafetyStatus;
  label: string;
  description: string;
  severity: TJobSafetySeverity;
};

type TJobSafetyInput = {
  job: Pick<TConvexDoc<"jobs">, "status">;
  escrow?: Pick<TConvexDoc<"escrows">, "status"> | null;
};

type TJobSafetyMeta = {
  label: string;
  description: string;
  severity: TJobSafetySeverity;
  badgeClassName: string;
  sortRank: number;
};

const JOB_SAFETY_META: Record<TJobSafetyStatus, TJobSafetyMeta> = {
  unfunded: {
    label: "Unfunded",
    description: "Funds are not locked yet. Freelancers should not start work.",
    severity: "high",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    sortRank: 40,
  },
  escrow_created: {
    label: "Escrow Created",
    description: "Escrow exists, but payment has not been funded.",
    severity: "medium",
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-800",
    sortRank: 30,
  },
  verified_funded: {
    label: "Verified Funded",
    description: "Stablecoin funds are locked in Stellar escrow.",
    severity: "safe",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    sortRank: 10,
  },
  paid: {
    label: "Paid",
    description: "Payment was released through Stellar escrow.",
    severity: "safe",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-800",
    sortRank: 50,
  },
  disputed: {
    label: "Disputed",
    description: "This job is under manual review.",
    severity: "high",
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    sortRank: 60,
  },
  cancelled: {
    label: "Cancelled",
    description: "This job is no longer active.",
    severity: "neutral",
    badgeClassName: "border-gray-300 bg-gray-100 text-gray-700",
    sortRank: 70,
  },
};

export function getJobSafetyStatus({ job, escrow }: TJobSafetyInput): TJobSafetyResult {
  const status = resolveJobSafetyStatus({ job, escrow });
  const meta = JOB_SAFETY_META[status];

  return {
    status,
    label: meta.label,
    description: meta.description,
    severity: meta.severity,
  };
}

export function getJobSafetyLabel(status: TJobSafetyStatus): string {
  return JOB_SAFETY_META[status].label;
}

export function getJobSafetyDescription(status: TJobSafetyStatus): string {
  return JOB_SAFETY_META[status].description;
}

export function getJobSafetySeverity(status: TJobSafetyStatus): TJobSafetySeverity {
  return JOB_SAFETY_META[status].severity;
}

export function getJobSafetyBadgeClassName(status: TJobSafetyStatus): string {
  return JOB_SAFETY_META[status].badgeClassName;
}

export function getJobSafetySortRank(status: TJobSafetyStatus): number {
  return JOB_SAFETY_META[status].sortRank;
}

export function compareJobsBySafetyThenNewest(
  left: TJobSafetyInput,
  right: TJobSafetyInput,
): number {
  const leftSafety = getJobSafetyStatus(left);
  const rightSafety = getJobSafetyStatus(right);
  const rankDelta =
    getJobSafetySortRank(leftSafety.status) - getJobSafetySortRank(rightSafety.status);

  if (rankDelta !== 0) {
    return rankDelta;
  }

  const leftCreatedAt = "createdAt" in left.job ? Number(left.job.createdAt) : 0;
  const rightCreatedAt = "createdAt" in right.job ? Number(right.job.createdAt) : 0;

  return rightCreatedAt - leftCreatedAt;
}

function resolveJobSafetyStatus({ job, escrow }: TJobSafetyInput): TJobSafetyStatus {
  if (job.status === "cancelled" || escrow?.status === "cancelled") {
    return "cancelled";
  }

  if (job.status === "disputed" || escrow?.status === "disputed") {
    return "disputed";
  }

  if (job.status === "completed" || escrow?.status === "released") {
    return "paid";
  }

  if (escrow?.status === "funded" || escrow?.status === "submitted") {
    return "verified_funded";
  }

  if (escrow?.status === "created") {
    return "escrow_created";
  }

  return "unfunded";
}
