import type { TStatusTone } from "@/features/common/components/status-text";
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
  tone: TStatusTone;
  sortRank: number;
};

const JOB_SAFETY_META: Record<TJobSafetyStatus, TJobSafetyMeta> = {
  unfunded: {
    label: "Unfunded",
    description: "Funds are not locked yet. Freelancers should not start work.",
    severity: "high",
    tone: "warning",
    sortRank: 40,
  },
  escrow_created: {
    label: "Escrow Created",
    description: "Escrow exists, but payment has not been funded.",
    severity: "medium",
    tone: "warning",
    sortRank: 30,
  },
  verified_funded: {
    label: "Verified Funded",
    description: "Stablecoin funds are locked in Stellar escrow.",
    severity: "safe",
    tone: "success",
    sortRank: 10,
  },
  paid: {
    label: "Paid",
    description: "Payment was released through Stellar escrow.",
    severity: "safe",
    tone: "info",
    sortRank: 50,
  },
  disputed: {
    label: "Disputed",
    description: "This job is under manual review.",
    severity: "high",
    tone: "danger",
    sortRank: 60,
  },
  cancelled: {
    label: "Cancelled",
    description: "This job is no longer active.",
    severity: "neutral",
    tone: "neutral",
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

export function getJobSafetyTone(status: TJobSafetyStatus): TStatusTone {
  return JOB_SAFETY_META[status].tone;
}

export function getApplicationTrustSafetyNoticeType(
  status: TJobSafetyStatus,
): "verified_funded" | "unfunded" {
  return status === "verified_funded" ? "verified_funded" : "unfunded";
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
