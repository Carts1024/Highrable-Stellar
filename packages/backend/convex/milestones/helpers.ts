import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TEscrowStatus, TEscrowTransactionType } from "../escrows/schema";
import type { TApplicationGateStatus, TMilestoneStatus } from "./schema";
import type { TMilestoneApplicationGate, TMilestoneDoc } from "./types";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { sanitizeSupportedEscrowAsset } from "../_shared/escrowAssets";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
  requirePositiveNumber,
} from "../_shared/input";
import { getEscrowTxFieldByType } from "../escrows/helpers";
import { getJobType } from "../jobs/helpers";

const ASSIGNABLE_MILESTONE_STATUSES = new Set<TMilestoneStatus>(["open"]);
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
  return sanitizeSupportedEscrowAsset(asset);
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

function createClosedGate(message: string): TMilestoneApplicationGate {
  return {
    status: "closed",
    canApply: false,
    reason: "milestone_closed",
    message,
  };
}

function getApplicationGateMessage(status: TApplicationGateStatus): string {
  if (status === "open") {
    return "Applications are open for this milestone.";
  }

  if (status === "continuation_pending") {
    return "The client has offered this milestone to the previous freelancer and is waiting for a response.";
  }

  if (status === "continuation_rejected") {
    return "The previous freelancer rejected the continuation offer. Applications are now open.";
  }

  if (status === "closed") {
    return "Applications are closed for this milestone.";
  }

  return "Applications are locked until the client opens this milestone.";
}

export async function getPreviousMilestone(
  ctx: QueryCtx,
  milestone: TMilestoneDoc,
): Promise<TMilestoneDoc | null> {
  if (milestone.order <= 1) {
    return null;
  }

  return await ctx.db
    .query("milestones")
    .withIndex("by_jobId_order", (q) =>
      q.eq("jobId", milestone.jobId).eq("order", milestone.order - 1),
    )
    .unique();
}

export async function deriveMilestoneApplicationGate(
  ctx: QueryCtx,
  milestone: TMilestoneDoc,
): Promise<TMilestoneApplicationGate> {
  if (milestone.status !== "open") {
    return createClosedGate(
      "Applications are closed because this milestone is already in progress or finished.",
    );
  }

  if (milestone.order <= 1) {
    const status = milestone.applicationGateStatus ?? "open";
    return {
      status,
      canApply: status === "open",
      reason: status === "open" ? "first_milestone_open" : "milestone_closed",
      message:
        status === "open"
          ? "Applications are open for the first milestone."
          : getApplicationGateMessage(status),
      ...(milestone.continuationOfferFreelancerWallet !== undefined
        ? { continuationOfferFreelancerWallet: milestone.continuationOfferFreelancerWallet }
        : {}),
    };
  }

  const previousMilestone = await getPreviousMilestone(ctx, milestone);

  if (!previousMilestone || previousMilestone.status !== "released") {
    return {
      status: "locked",
      canApply: false,
      reason: "previous_milestone_unfinished",
      message: "Applications are locked until the previous milestone is completed and paid.",
      ...(previousMilestone ? { previousMilestoneId: previousMilestone._id } : {}),
      ...(previousMilestone?.assignedFreelancerWallet !== undefined
        ? { previousFreelancerWallet: previousMilestone.assignedFreelancerWallet }
        : {}),
    };
  }

  const status = milestone.applicationGateStatus ?? "locked";
  const base = {
    status,
    previousMilestoneId: previousMilestone._id,
    ...(previousMilestone.assignedFreelancerWallet !== undefined
      ? { previousFreelancerWallet: previousMilestone.assignedFreelancerWallet }
      : {}),
    ...(milestone.continuationOfferFreelancerWallet !== undefined
      ? { continuationOfferFreelancerWallet: milestone.continuationOfferFreelancerWallet }
      : {}),
  };

  if (status === "open") {
    return {
      ...base,
      canApply: true,
      reason: "replacement_applications_open",
      message: "Applications are open for this milestone.",
    };
  }

  if (status === "continuation_rejected") {
    return {
      ...base,
      canApply: true,
      reason: "continuation_offer_rejected",
      message:
        "The previous freelancer rejected the continuation offer. Applications are now open.",
    };
  }

  if (status === "continuation_pending") {
    return {
      ...base,
      canApply: false,
      reason: "continuation_offer_pending",
      message: "Waiting for the previous freelancer to accept or reject the continuation offer.",
    };
  }

  if (status === "closed") {
    return {
      ...base,
      canApply: false,
      reason: "milestone_closed",
      message: getApplicationGateMessage(status),
    };
  }

  return {
    ...base,
    canApply: false,
    reason: "waiting_client_decision",
    message:
      "The previous milestone is paid. The client must retain the freelancer or open applications.",
  };
}

export async function assertMilestoneAcceptsApplications(
  ctx: QueryCtx,
  milestone: TMilestoneDoc,
): Promise<void> {
  const applicationGate = await deriveMilestoneApplicationGate(ctx, milestone);

  if (!applicationGate.canApply) {
    throw new ForbiddenError(applicationGate.message);
  }
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
      (milestone) => milestone.status === "assigned" || milestone.status === "escrow_created",
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
  await ctx.db.patch(jobId, { status, updatedAt: Date.now() });
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
