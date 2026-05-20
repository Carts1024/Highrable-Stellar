import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TDeadlineStatus } from "../jobs/schema";
import type { TWalletType } from "../users/schema";
import type { TDeadlineParentType, TDeadlineReminderType } from "./schema";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress, optionalNonEmptyString } from "../_shared/input";
import { createSystemMessageForEvent } from "../conversations/helpers";

const MIN_DEADLINE_LEAD_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const TERMINAL_CANCELLED = new Set(["cancelled"]);
const TERMINAL_DISPUTED = new Set(["disputed"]);
const TERMINAL_RELEASED = new Set(["released", "completed"]);
const ACTIVE_ESCROW_STATUSES = new Set(["funded", "submitted"]);

export type TDeadlineReminderState = Partial<Record<TDeadlineReminderType, number>>;

export type TDeadlineParentContext = {
  parentType: TDeadlineParentType;
  parentId: string;
  jobId: Id<"jobs">;
  milestoneId?: Id<"milestones">;
  escrowId?: Id<"escrows">;
  clientWallet: string;
  freelancerWallet?: string;
  title: string;
  requiredOutput?: string;
  deadlineAt?: number;
  submittedAt?: number;
  completedAt?: number;
  approvedAt?: number;
  overdueAt?: number;
  status: string;
  escrowStatus?: string;
};

export function validateDeadlineAt(deadlineAt: number, now = Date.now()): number {
  if (!Number.isFinite(deadlineAt)) {
    throw new BadRequestError("Deadline must be a valid date and time.");
  }

  if (deadlineAt <= now) {
    throw new BadRequestError("Deadline must be in the future.");
  }

  if (deadlineAt - now < MIN_DEADLINE_LEAD_MS) {
    throw new BadRequestError("Deadline must be at least 30 minutes in the future.");
  }

  return Math.trunc(deadlineAt);
}

export function validateMilestoneDeadlineOrder(
  milestones: Array<{ deadlineAt: number }>,
  now = Date.now(),
): void {
  let previousDeadlineAt: number | null = null;

  for (const [index, milestone] of milestones.entries()) {
    validateDeadlineAt(milestone.deadlineAt, now);
    if (previousDeadlineAt !== null && milestone.deadlineAt < previousDeadlineAt) {
      throw new BadRequestError(
        `Milestone ${index + 1} cannot be due before Milestone ${index}.`,
      );
    }
    previousDeadlineAt = milestone.deadlineAt;
  }
}

export function computeDeadlineStatus(input: {
  deadlineAt?: number;
  submittedAt?: number;
  completedAt?: number;
  approvedAt?: number;
  escrowStatus?: string;
  workStatus?: string;
  now?: number;
}): TDeadlineStatus {
  if (TERMINAL_CANCELLED.has(input.escrowStatus ?? "") || input.workStatus === "cancelled") {
    return "cancelled";
  }
  if (TERMINAL_DISPUTED.has(input.escrowStatus ?? "") || input.workStatus === "disputed") {
    return "disputed";
  }

  const terminalCompletedAt = input.approvedAt ?? input.completedAt;
  if (
    TERMINAL_RELEASED.has(input.escrowStatus ?? "") ||
    input.workStatus === "released" ||
    input.workStatus === "completed"
  ) {
    if (!input.deadlineAt || !terminalCompletedAt) {
      return "released";
    }
    return terminalCompletedAt <= input.deadlineAt ? "completed_on_time" : "completed_late";
  }

  if (!input.deadlineAt) {
    return "no_deadline";
  }

  if (input.submittedAt !== undefined) {
    return input.submittedAt <= input.deadlineAt ? "submitted_on_time" : "submitted_late";
  }

  const now = input.now ?? Date.now();
  const remainingMs = input.deadlineAt - now;

  if (remainingMs <= 0) {
    return "overdue";
  }

  if (remainingMs <= HOUR_MS) {
    return "due_very_soon";
  }

  if (remainingMs <= DAY_MS) {
    return "due_soon";
  }

  return "upcoming";
}

export function getRemainingTimeLabel(deadlineAt?: number, now = Date.now()): string {
  if (!deadlineAt) {
    return "No deadline";
  }

  const diff = deadlineAt - now;
  const absoluteMs = Math.abs(diff);
  const hours = Math.floor(absoluteMs / HOUR_MS);
  const minutes = Math.max(1, Math.round((absoluteMs % HOUR_MS) / (60 * 1000)));

  if (diff <= 0) {
    if (hours >= 24) {
      return `${Math.floor(hours / 24)}d overdue`;
    }
    return hours > 0 ? `${hours}h overdue` : `${minutes}m overdue`;
  }

  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d remaining`;
  }

  return hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
}

export async function resolveDeadlineParent(
  ctx: QueryCtx,
  input: { parentType: TDeadlineParentType; parentId: string },
): Promise<TDeadlineParentContext> {
  if (input.parentType === "micro_gig") {
    const job = await ctx.db.get(input.parentId as Id<"jobs">);
    if (!job || (job.jobType ?? "micro_gig") !== "micro_gig") {
      throw new NotFoundError("Micro gig not found.");
    }

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
      .first();

    return {
      parentType: "micro_gig",
      parentId: job._id,
      jobId: job._id,
      ...(escrow?._id !== undefined ? { escrowId: escrow._id } : {}),
      clientWallet: job.clientWallet,
      ...(job.selectedFreelancerWallet !== undefined
        ? { freelancerWallet: job.selectedFreelancerWallet }
        : escrow?.freelancerWallet !== undefined
          ? { freelancerWallet: escrow.freelancerWallet }
          : {}),
      title: job.title,
      ...(job.deadlineAt !== undefined ? { deadlineAt: job.deadlineAt } : {}),
      ...(job.submittedAt !== undefined ? { submittedAt: job.submittedAt } : {}),
      ...(job.completedAt !== undefined ? { completedAt: job.completedAt } : {}),
      ...(job.approvedAt !== undefined ? { approvedAt: job.approvedAt } : {}),
      ...(job.overdueAt !== undefined ? { overdueAt: job.overdueAt } : {}),
      status: job.status,
      ...(escrow?.status !== undefined ? { escrowStatus: escrow.status } : {}),
    };
  }

  const milestone = await ctx.db.get(input.parentId as Id<"milestones">);
  if (!milestone) {
    throw new NotFoundError("Milestone not found.");
  }

  const job = await ctx.db.get(milestone.jobId);
  if (!job) {
    throw new NotFoundError("Parent job not found.");
  }

  const escrow = await ctx.db
    .query("escrows")
    .withIndex("by_milestoneId", (q) => q.eq("milestoneId", milestone._id))
    .first();

  return {
    parentType: "milestone",
    parentId: milestone._id,
    jobId: milestone.jobId,
    milestoneId: milestone._id,
    ...(escrow?._id !== undefined ? { escrowId: escrow._id } : {}),
    clientWallet: job.clientWallet,
    ...(milestone.assignedFreelancerWallet !== undefined
      ? { freelancerWallet: milestone.assignedFreelancerWallet }
      : escrow?.freelancerWallet !== undefined
        ? { freelancerWallet: escrow.freelancerWallet }
        : {}),
    title: `Milestone ${milestone.order}`,
    requiredOutput: milestone.requiredOutput ?? milestone.title,
    ...(milestone.deadlineAt !== undefined ? { deadlineAt: milestone.deadlineAt } : {}),
    ...(milestone.submittedAt !== undefined ? { submittedAt: milestone.submittedAt } : {}),
    ...(milestone.completedAt !== undefined ? { completedAt: milestone.completedAt } : {}),
    ...(milestone.approvedAt !== undefined ? { approvedAt: milestone.approvedAt } : {}),
    ...(milestone.overdueAt !== undefined ? { overdueAt: milestone.overdueAt } : {}),
    status: milestone.status,
    ...(escrow?.status !== undefined ? { escrowStatus: escrow.status } : {}),
  };
}

export async function assertCanViewDeadline(
  ctx: QueryCtx,
  input: { parentType: TDeadlineParentType; parentId: string; viewerWallet?: string },
) {
  const parent = await resolveDeadlineParent(ctx, input);
  if (!input.viewerWallet) {
    return parent;
  }

  const viewerWallet = normalizeWalletAddress(input.viewerWallet);
  if (
    viewerWallet === parent.clientWallet ||
    viewerWallet === parent.freelancerWallet ||
    parent.status === "open"
  ) {
    return parent;
  }

  throw new ForbiddenError("You do not have permission to view this deadline.");
}

export async function assertCanEditDeadline(
  ctx: QueryCtx,
  input: {
    parentType: TDeadlineParentType;
    parentId: string;
    clientWallet: string;
  },
) {
  const parent = await resolveDeadlineParent(ctx, input);
  const clientWallet = normalizeWalletAddress(input.clientWallet);

  if (parent.clientWallet !== clientWallet) {
    throw new ForbiddenError("Only the client can update this deadline.");
  }

  if (parent.parentType === "micro_gig" && parent.status !== "open" && parent.status !== "selected") {
    throw new ForbiddenError("You cannot change the deadline after work has started.");
  }

  if (parent.parentType === "milestone" && parent.status !== "draft" && parent.status !== "open") {
    throw new ForbiddenError("You cannot change the deadline after work has started.");
  }

  return parent;
}

export function shouldSendReminder(parent: TDeadlineParentContext): boolean {
  if (!parent.deadlineAt) {
    return false;
  }

  const status = computeDeadlineStatus({
    deadlineAt: parent.deadlineAt,
    submittedAt: parent.submittedAt,
    completedAt: parent.completedAt,
    approvedAt: parent.approvedAt,
    escrowStatus: parent.escrowStatus,
    workStatus: parent.status,
  });

  if (
    status === "submitted_on_time" ||
    status === "submitted_late" ||
    status === "completed_on_time" ||
    status === "completed_late" ||
    status === "released" ||
    status === "cancelled" ||
    status === "disputed"
  ) {
    return false;
  }

  if (parent.escrowStatus === undefined) {
    return false;
  }

  return ACTIVE_ESCROW_STATUSES.has(parent.escrowStatus);
}

export function buildDeadlineReminderMessage(input: {
  parent: TDeadlineParentContext;
  reminderType: TDeadlineReminderType;
  now?: number;
}) {
  const label =
    input.parent.parentType === "milestone"
      ? input.parent.requiredOutput ?? input.parent.title
      : "This micro gig";
  const deadlineLabel = input.parent.deadlineAt
    ? new Date(input.parent.deadlineAt).toISOString()
    : "No deadline";
  const remaining = getRemainingTimeLabel(input.parent.deadlineAt, input.now);

  if (input.reminderType === "deadline_overdue") {
    return {
      title: "Deadline missed",
      body:
        input.parent.parentType === "milestone"
          ? `Deadline missed: ${label} is now overdue.`
          : "Deadline missed: This micro gig is now overdue.",
      metadata: { deadlineLabel, remaining },
    };
  }

  const checkpointLabel: Record<TDeadlineReminderType, string> = {
    deadline_24h: "24 hours",
    deadline_6h: "6 hours",
    deadline_1h: "1 hour",
    deadline_overdue: "overdue",
  };

  return {
    title: "Deadline reminder",
    body:
      input.parent.parentType === "milestone"
        ? `Deadline reminder: ${label} is due in ${checkpointLabel[input.reminderType]}.`
        : `Deadline reminder: This micro gig is due in ${checkpointLabel[input.reminderType]}.`,
    metadata: { deadlineLabel, remaining },
  };
}

export async function createDeadlineSystemMessage(
  ctx: MutationCtx,
  input: { parent: TDeadlineParentContext; reminderType: TDeadlineReminderType },
) {
  const message = buildDeadlineReminderMessage(input);

  return await createSystemMessageForEvent(ctx, {
    parentType: input.parent.escrowId !== undefined ? "escrow" : input.parent.parentType,
    parentId: input.parent.escrowId ?? input.parent.parentId,
    eventType: input.reminderType === "deadline_overdue" ? "deadline_missed" : "deadline_warning",
    body: message.body,
    eventPayload: {
      parentType: input.parent.parentType,
      parentId: input.parent.parentId,
      jobId: input.parent.jobId,
      milestoneId: input.parent.milestoneId,
      escrowId: input.parent.escrowId,
      reminderType: input.reminderType,
      deadlineAt: input.parent.deadlineAt,
      requiredOutput: input.parent.requiredOutput,
      ...message.metadata,
    },
  });
}

export function getReminderSchedule(deadlineAt: number) {
  return [
    { reminderType: "deadline_24h" as const, scheduledFor: deadlineAt - DAY_MS },
    { reminderType: "deadline_6h" as const, scheduledFor: deadlineAt - 6 * HOUR_MS },
    { reminderType: "deadline_1h" as const, scheduledFor: deadlineAt - HOUR_MS },
    { reminderType: "deadline_overdue" as const, scheduledFor: deadlineAt },
  ];
}

export function sanitizeDeadlineReason(reason?: string): string | undefined {
  return optionalNonEmptyString(reason, "reason")?.slice(0, 500);
}

export function getRecipientWallets(parent: TDeadlineParentContext, reminderType: TDeadlineReminderType) {
  const wallets = new Set<string>();
  if (parent.freelancerWallet) {
    wallets.add(parent.freelancerWallet);
  }
  if (reminderType === "deadline_overdue") {
    wallets.add(parent.clientWallet);
  }

  return Array.from(wallets);
}

export async function upsertDeadlineReminders(ctx: MutationCtx, parent: TDeadlineParentContext) {
  if (!parent.deadlineAt) {
    return;
  }

  const now = Date.now();
  for (const reminder of getReminderSchedule(parent.deadlineAt)) {
    const existing = await ctx.db
      .query("deadlineReminders")
      .withIndex("by_parent_reminder", (q) =>
        q
          .eq("parentType", parent.parentType)
          .eq("parentId", parent.parentId)
          .eq("reminderType", reminder.reminderType),
      )
      .first();

    const patch = {
      jobId: parent.jobId,
      ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
      ...(parent.escrowId !== undefined ? { escrowId: parent.escrowId } : {}),
      clientWallet: parent.clientWallet,
      ...(parent.freelancerWallet !== undefined ? { freelancerWallet: parent.freelancerWallet } : {}),
      scheduledFor: Math.max(reminder.scheduledFor, now),
      recipientWallets: getRecipientWallets(parent, reminder.reminderType),
      updatedAt: now,
      metadata: { deadlineAt: parent.deadlineAt },
    };

    if (existing) {
      if (existing.status === "pending") {
        await ctx.db.patch(existing._id, patch);
      }
      continue;
    }

    await ctx.db.insert("deadlineReminders", {
      parentType: parent.parentType,
      parentId: parent.parentId,
      reminderType: reminder.reminderType,
      status: "pending",
      createdAt: now,
      ...patch,
    });
  }
}

export type TDeadlinePatch = {
  deadlineAt?: number;
  deadlineStatus?: TDeadlineStatus;
  deadlineReminderState?: TDeadlineReminderState;
  submittedAt?: number;
  completedAt?: number;
  approvedAt?: number;
  overdueAt?: number;
  updatedAt?: number;
};

export async function patchDeadlineParent(
  ctx: MutationCtx,
  parent: TDeadlineParentContext,
  patch: TDeadlinePatch,
) {
  if (parent.parentType === "micro_gig") {
    await ctx.db.patch(parent.jobId, patch);
    return;
  }

  await ctx.db.patch(parent.milestoneId!, patch);
}

export function getWalletTypeForRecipient(
  wallet: string,
  input?: { walletAddress: string; walletType?: TWalletType },
) {
  return input?.walletAddress === wallet ? input.walletType : undefined;
}
