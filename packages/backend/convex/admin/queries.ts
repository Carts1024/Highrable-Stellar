import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import {
  DISPUTE_ON_CHAIN_STATUSES,
  DISPUTE_STATUSES,
  disputeOnChainStatusValidator,
  disputeStatusValidator,
} from "../disputes/schema";
import { ESCROW_STATUSES } from "../escrows/schema";
import { JOB_STATUSES } from "../jobs/schema";
import { REVISION_REQUEST_STATUSES } from "../revisions/schema";
import { USER_ROLES } from "../users/schema";
import { assertAdminContext, getDisputeOrThrow } from "./helpers";

const USER_ROLE_VALUES = [USER_ROLES.client, USER_ROLES.freelancer, USER_ROLES.admin] as const;
const DISPUTE_STATUS_VALUES = [
  DISPUTE_STATUSES.open,
  DISPUTE_STATUSES.under_review,
  DISPUTE_STATUSES.awaiting_client_response,
  DISPUTE_STATUSES.awaiting_freelancer_response,
  DISPUTE_STATUSES.resolved_client,
  DISPUTE_STATUSES.resolved_freelancer,
  DISPUTE_STATUSES.split_resolution,
  DISPUTE_STATUSES.cancelled,
] as const;
const DISPUTE_ON_CHAIN_STATUS_VALUES = [
  DISPUTE_ON_CHAIN_STATUSES.not_marked,
  DISPUTE_ON_CHAIN_STATUSES.marking,
  DISPUTE_ON_CHAIN_STATUSES.marked,
  DISPUTE_ON_CHAIN_STATUSES.mark_failed,
] as const;
const WORK_SUBMISSION_STATUS_VALUES = [
  "draft",
  "submitted_for_review",
  "revision_requested",
  "revision_submitted",
  "accepted_for_final",
  "submitted",
  "anchoring",
  "anchored",
  "anchor_failed",
  "cancelled",
] as const;
const WORK_SUBMISSION_ON_CHAIN_STATUS_VALUES = [
  "not_submitted",
  "pending",
  "confirmed",
  "failed",
] as const;
const DEADLINE_REMINDER_STATUS_VALUES = ["pending", "sent", "skipped", "failed"] as const;
const METRICS_SCAN_LIMIT = 2000;

type TStringCounter<TKey extends string> = Record<TKey, number>;

function createCounter<TKey extends string>(keys: readonly TKey[]): TStringCounter<TKey> {
  const counter = {} as TStringCounter<TKey>;
  for (const key of keys) {
    counter[key] = 0;
  }

  return counter;
}

function incrementCounter<TKey extends string>(
  counter: TStringCounter<TKey>,
  key: string | undefined,
): void {
  if (!key) {
    return;
  }

  if (key in counter) {
    counter[key as TKey] += 1;
  }
}

function toRecentDisputeRow(dispute: Doc<"disputes">) {
  return {
    disputeId: dispute._id,
    disputeNumber: dispute.disputeNumber,
    title: dispute.title,
    status: dispute.status,
    onChainStatus: dispute.onChainStatus,
    reasonCategory: dispute.reasonCategory,
    clientWallet: dispute.clientWallet,
    freelancerWallet: dispute.freelancerWallet,
    updatedAt: dispute.updatedAt,
    openedAt: dispute.openedAt,
  };
}

async function listRecentDisputes(ctx: QueryCtx, limit: number): Promise<Doc<"disputes">[]> {
  const perStatusLimit = Math.max(5, Math.ceil(limit / DISPUTE_STATUS_VALUES.length) + 3);

  const grouped = await Promise.all(
    DISPUTE_STATUS_VALUES.map(async (status) => {
      return await ctx.db
        .query("disputes")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(perStatusLimit);
    }),
  );

  const byId = new Map<Id<"disputes">, Doc<"disputes">>();
  for (const rows of grouped) {
    for (const dispute of rows) {
      byId.set(dispute._id, dispute);
    }
  }

  return Array.from(byId.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, limit);
}

async function resolveAttachmentForAdmin(ctx: QueryCtx, attachmentId: Id<"attachments">) {
  const attachment = await ctx.db.get(attachmentId);
  if (!attachment) {
    return null;
  }

  return {
    ...attachment,
    url: attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null,
  };
}

export const getAdminDashboardMetrics = query({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminContext(args);

    const [users, jobs, escrows, disputes, workSubmissions, revisions, deadlineReminders, recent] =
      await Promise.all([
        ctx.db.query("users").take(METRICS_SCAN_LIMIT),
        ctx.db.query("jobs").take(METRICS_SCAN_LIMIT),
        ctx.db.query("escrows").take(METRICS_SCAN_LIMIT),
        ctx.db.query("disputes").take(METRICS_SCAN_LIMIT),
        ctx.db.query("workSubmissions").take(METRICS_SCAN_LIMIT),
        ctx.db.query("revisionRequests").take(METRICS_SCAN_LIMIT),
        ctx.db.query("deadlineReminders").take(METRICS_SCAN_LIMIT),
        listRecentDisputes(ctx, 12),
      ]);

    const usersByRole = createCounter(USER_ROLE_VALUES);
    const jobsByStatus = createCounter(Object.values(JOB_STATUSES));
    const escrowsByStatus = createCounter(Object.values(ESCROW_STATUSES));
    const disputesByStatus = createCounter(DISPUTE_STATUS_VALUES);
    const disputesByOnChainStatus = createCounter(DISPUTE_ON_CHAIN_STATUS_VALUES);
    const workSubmissionsByStatus = createCounter(WORK_SUBMISSION_STATUS_VALUES);
    const workSubmissionsByOnChainStatus = createCounter(WORK_SUBMISSION_ON_CHAIN_STATUS_VALUES);
    const revisionsByStatus = createCounter(Object.values(REVISION_REQUEST_STATUSES));
    const deadlineRemindersByStatus = createCounter(DEADLINE_REMINDER_STATUS_VALUES);

    for (const user of users) {
      incrementCounter(usersByRole, user.role);
    }
    for (const job of jobs) {
      incrementCounter(jobsByStatus, job.status);
    }
    for (const escrow of escrows) {
      incrementCounter(escrowsByStatus, escrow.status);
    }
    for (const dispute of disputes) {
      incrementCounter(disputesByStatus, dispute.status);
      incrementCounter(disputesByOnChainStatus, dispute.onChainStatus);
    }
    for (const submission of workSubmissions) {
      incrementCounter(workSubmissionsByStatus, submission.status);
      incrementCounter(workSubmissionsByOnChainStatus, submission.onChainStatus);
    }
    for (const revision of revisions) {
      incrementCounter(revisionsByStatus, revision.status);
    }
    for (const reminder of deadlineReminders) {
      incrementCounter(deadlineRemindersByStatus, reminder.status);
    }

    const overdueDeadlineReminders = deadlineReminders.filter(
      (reminder) => reminder.reminderType === "deadline_overdue",
    ).length;

    return {
      generatedAt: Date.now(),
      isTruncated:
        users.length >= METRICS_SCAN_LIMIT ||
        jobs.length >= METRICS_SCAN_LIMIT ||
        escrows.length >= METRICS_SCAN_LIMIT ||
        disputes.length >= METRICS_SCAN_LIMIT ||
        workSubmissions.length >= METRICS_SCAN_LIMIT ||
        revisions.length >= METRICS_SCAN_LIMIT ||
        deadlineReminders.length >= METRICS_SCAN_LIMIT,
      users: {
        total: users.length,
        byRole: usersByRole,
      },
      jobs: {
        total: jobs.length,
        byStatus: jobsByStatus,
      },
      escrows: {
        total: escrows.length,
        byStatus: escrowsByStatus,
      },
      disputes: {
        total: disputes.length,
        byStatus: disputesByStatus,
        byOnChainStatus: disputesByOnChainStatus,
      },
      workSubmissions: {
        total: workSubmissions.length,
        byStatus: workSubmissionsByStatus,
        byOnChainStatus: workSubmissionsByOnChainStatus,
      },
      revisions: {
        total: revisions.length,
        byStatus: revisionsByStatus,
      },
      deadlineReminders: {
        total: deadlineReminders.length,
        byStatus: deadlineRemindersByStatus,
        overdueCount: overdueDeadlineReminders,
      },
      recentDisputes: recent.map(toRecentDisputeRow),
    };
  },
});

export const listAdminDisputes = query({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    status: v.optional(disputeStatusValidator),
    onChainStatus: v.optional(disputeOnChainStatusValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminContext(args);

    const limit = Math.max(1, Math.min(Math.trunc(args.limit ?? 50), 200));
    const candidateLimit = Math.max(limit * 4, 100);

    const source =
      args.status !== undefined
        ? await ctx.db
            .query("disputes")
            .withIndex("by_status", (q) => q.eq("status", args.status!))
            .order("desc")
            .take(candidateLimit)
        : await listRecentDisputes(ctx, candidateLimit);

    return source
      .filter((dispute) => {
        if (args.onChainStatus && dispute.onChainStatus !== args.onChainStatus) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit)
      .map(toRecentDisputeRow);
  },
});

export const getAdminDispute = query({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    disputeId: v.id("disputes"),
  },
  handler: async (ctx, args) => {
    assertAdminContext(args);

    const dispute = await getDisputeOrThrow(ctx, args.disputeId);

    const [job, milestone, escrow, timeline, evidence] = await Promise.all([
      dispute.jobId ? ctx.db.get(dispute.jobId) : Promise.resolve(null),
      dispute.milestoneId ? ctx.db.get(dispute.milestoneId) : Promise.resolve(null),
      dispute.escrowId ? ctx.db.get(dispute.escrowId) : Promise.resolve(null),
      ctx.db
        .query("disputeEvents")
        .withIndex("by_dispute", (q) => q.eq("disputeId", dispute._id))
        .order("asc")
        .take(300),
      Promise.all(
        dispute.evidenceAttachmentIds.map(async (attachmentId) =>
          resolveAttachmentForAdmin(ctx, attachmentId),
        ),
      ),
    ]);

    const timelineWithAttachments = await Promise.all(
      timeline.map(async (event) => {
        const attachments = await Promise.all(
          event.attachmentIds.map(async (attachmentId) =>
            resolveAttachmentForAdmin(ctx, attachmentId),
          ),
        );

        return {
          ...event,
          attachments: attachments.filter((attachment) => attachment !== null),
        };
      }),
    );

    return {
      dispute: {
        ...dispute,
        attachments: evidence.filter((attachment) => attachment !== null),
      },
      timeline: timelineWithAttachments,
      job,
      milestone,
      escrow,
    };
  },
});
