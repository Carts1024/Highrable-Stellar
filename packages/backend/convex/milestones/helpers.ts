import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TEscrowStatus, TEscrowTransactionType } from "../escrows/schema";
import type { TMilestoneStatus } from "./schema";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
  requirePositiveNumber,
} from "../_shared/input";
import { getEscrowTxFieldByType } from "../escrows/helpers";
import { getJobType } from "../jobs/helpers";

const ASSIGNABLE_MILESTONE_STATUSES = new Set<TMilestoneStatus>(["open", "assigned"]);
const EDITABLE_MILESTONE_STATUSES = new Set<TMilestoneStatus>(["draft", "open"]);

const ESCROW_TO_MILESTONE_STATUS_MAP: Record<TEscrowStatus, TMilestoneStatus> = {
  created: "escrow_created",
  funded: "funded",
  submitted: "submitted",
  released: "released",
  cancelled: "cancelled",
  disputed: "disputed",
};

export function sanitizeMilestoneTitle(title: string): string {
  return requireNonEmptyString(title, "milestone title");
}

export function sanitizeMilestoneDescription(description: string | undefined): string | undefined {
  return optionalNonEmptyString(description, "milestone description");
}

export function sanitizeMilestoneAmount(amount: number): number {
  return requirePositiveNumber(amount, "milestone amount");
}

export function sanitizeMilestoneAsset(asset: string): string {
  return requireNonEmptyString(asset, "asset");
}

export function sanitizeMilestoneWallet(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export function getMilestoneStatusFromEscrowStatus(status: TEscrowStatus): TMilestoneStatus {
  return ESCROW_TO_MILESTONE_STATUS_MAP[status];
}

export async function getMilestoneOrThrow(ctx: QueryCtx, milestoneId: Id<"milestones">) {
  const milestone = await ctx.db.get(milestoneId);
  if (!milestone) {
    throw new NotFoundError("Milestone not found.");
  }

  return milestone;
}

export async function assertMilestoneProjectClient(
  ctx: QueryCtx,
  params: {
    jobId: Id<"jobs">;
    clientWallet: string;
  },
) {
  const job = await ctx.db.get(params.jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }

  if (getJobType(job) !== "milestone_project") {
    throw new BadRequestError("Job is not a milestone project.");
  }

  if (job.clientWallet !== params.clientWallet) {
    throw new ForbiddenError("Only the job client can manage milestones.");
  }

  return job;
}

export function assertMilestoneAssignable(status: TMilestoneStatus): void {
  if (!ASSIGNABLE_MILESTONE_STATUSES.has(status)) {
    throw new ForbiddenError("Milestone can only be assigned while open or assigned.");
  }
}

export function assertMilestoneEditable(status: TMilestoneStatus): void {
  if (!EDITABLE_MILESTONE_STATUSES.has(status)) {
    throw new ForbiddenError("Milestone can only be edited before escrow is created.");
  }
}

export async function deriveMilestoneProjectJobStatus(
  ctx: QueryCtx,
  jobId: Id<"jobs">,
): Promise<"open" | "selected" | "funded" | "submitted" | "completed" | "cancelled" | "disputed"> {
  const milestones = await ctx.db
    .query("milestones")
    .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
    .take(500);

  if (milestones.length === 0) {
    return "open";
  }

  if (milestones.some((milestone) => milestone.status === "disputed")) {
    return "disputed";
  }

  const allTerminal = milestones.every(
    (milestone) => milestone.status === "released" || milestone.status === "cancelled",
  );
  if (allTerminal) {
    return milestones.every((milestone) => milestone.status === "cancelled")
      ? "cancelled"
      : "completed";
  }

  if (milestones.some((milestone) => milestone.status === "submitted")) {
    return "submitted";
  }

  if (milestones.some((milestone) => milestone.status === "funded")) {
    return "funded";
  }

  if (
    milestones.some(
      (milestone) =>
        milestone.status === "assigned" || milestone.status === "escrow_created",
    )
  ) {
    return "selected";
  }

  return "open";
}

export async function patchParentJobStatusForMilestoneProject(
  ctx: MutationCtx,
  jobId: Id<"jobs">,
): Promise<void> {
  const status = await deriveMilestoneProjectJobStatus(ctx, jobId);
  await ctx.db.patch(jobId, { status });
}

export async function patchMilestoneForEscrowStatus(
  ctx: MutationCtx,
  params: {
    milestoneId: Id<"milestones">;
    escrowId: string;
    status: TEscrowStatus;
    txHash?: string;
    txType?: TEscrowTransactionType;
  },
) {
  const milestone = await getMilestoneOrThrow(ctx, params.milestoneId);
  const milestoneStatus = getMilestoneStatusFromEscrowStatus(params.status);
  const patch: {
    status: TMilestoneStatus;
    updatedAt: number;
    escrowId: string;
    createTxHash?: string;
    fundTxHash?: string;
    submitTxHash?: string;
    releaseTxHash?: string;
    cancelTxHash?: string;
    disputeTxHash?: string;
  } = {
    status: milestoneStatus,
    updatedAt: Date.now(),
    escrowId: params.escrowId,
  };

  if (params.txHash && params.txType) {
    const txField = getEscrowTxFieldByType(params.txType);
    if (txField !== "assignTxHash") {
      patch[txField] = params.txHash;
    }
  }

  await ctx.db.patch(params.milestoneId, patch);
  await patchParentJobStatusForMilestoneProject(ctx, milestone.jobId);
}
