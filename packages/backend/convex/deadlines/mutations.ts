import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import { internalMutation, mutation } from "../_generated/server";
import { BadRequestError, ConflictError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanEditDeadline,
  buildDeadlineReminderMessage,
  computeDeadlineStatus,
  createDeadlineSystemMessage,
  patchDeadlineParent,
  resolveDeadlineParent,
  sanitizeDeadlineReason,
  shouldSendReminder,
  upsertDeadlineReminders,
  validateDeadlineAt,
} from "./helpers";
import { deadlineParentTypeValidator, notificationTypeValidator } from "./schema";

async function setDeadline(
  ctx: MutationCtx,
  args: {
    parentType: "micro_gig" | "milestone";
    parentId: string;
    deadlineAt: number;
    clientWallet: string;
    changedByWalletType?: "external_wallet" | "passkey_smart_account";
    reason?: string;
  },
) {
  const parent = await assertCanEditDeadline(ctx, args);
  const deadlineAt = validateDeadlineAt(args.deadlineAt);
  const changedByWallet = normalizeWalletAddress(args.clientWallet);
  const oldDeadlineAt = parent.deadlineAt;
  const deadlineStatus = computeDeadlineStatus({
    deadlineAt,
    submittedAt: parent.submittedAt,
    completedAt: parent.completedAt,
    approvedAt: parent.approvedAt,
    escrowStatus: parent.escrowStatus,
    workStatus: parent.status,
  });

  await patchDeadlineParent(ctx, parent, {
    deadlineAt,
    deadlineStatus,
    overdueAt: undefined,
    updatedAt: Date.now(),
  });

  await ctx.db.insert("deadlineAuditEvents", {
    parentType: parent.parentType,
    parentId: parent.parentId,
    ...(oldDeadlineAt !== undefined ? { oldDeadlineAt } : {}),
    newDeadlineAt: deadlineAt,
    changedByWallet,
    ...(args.changedByWalletType !== undefined
      ? { changedByWalletType: args.changedByWalletType }
      : {}),
    ...(sanitizeDeadlineReason(args.reason) !== undefined
      ? { reason: sanitizeDeadlineReason(args.reason) }
      : {}),
    createdAt: Date.now(),
  });

  const refreshed = await resolveDeadlineParent(ctx, {
    parentType: parent.parentType,
    parentId: parent.parentId,
  });
  await upsertDeadlineReminders(ctx, refreshed);

  return refreshed;
}

async function sendDueReminder(ctx: MutationCtx, reminderId: Id<"deadlineReminders">) {
  const reminder = await ctx.db.get(reminderId);
  if (!reminder) {
    throw new NotFoundError("Reminder not found.");
  }
  if (reminder.status !== "pending") {
    return { status: reminder.status };
  }

  const parent = await resolveDeadlineParent(ctx, {
    parentType: reminder.parentType,
    parentId: reminder.parentId,
  });
  if (!shouldSendReminder(parent)) {
    await ctx.db.patch(reminderId, {
      status: "skipped",
      updatedAt: Date.now(),
      metadata: { ...(reminder.metadata ?? {}), skippedReason: "work_not_active" },
    });
    return { status: "skipped" };
  }

  const message = buildDeadlineReminderMessage({
    parent,
    reminderType: reminder.reminderType,
  });
  const notificationType =
    reminder.reminderType === "deadline_overdue" ? "deadline_overdue" : "deadline_warning";

  for (const recipientWallet of reminder.recipientWallets) {
    await ctx.db.insert("notifications", {
      recipientWallet,
      type: notificationType,
      title: message.title,
      body: message.body,
      parentType: parent.parentType,
      parentId: parent.parentId,
      jobId: parent.jobId,
      ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
      ...(parent.escrowId !== undefined ? { escrowId: parent.escrowId } : {}),
      createdAt: Date.now(),
      metadata: {
        reminderId: reminder._id,
        reminderType: reminder.reminderType,
        deadlineAt: parent.deadlineAt,
        ...message.metadata,
      },
    });
  }

  await createDeadlineSystemMessage(ctx, { parent, reminderType: reminder.reminderType });

  const deadlineStatus = computeDeadlineStatus({
    deadlineAt: parent.deadlineAt,
    submittedAt: parent.submittedAt,
    completedAt: parent.completedAt,
    approvedAt: parent.approvedAt,
    escrowStatus: parent.escrowStatus,
    workStatus: parent.status,
  });
  await patchDeadlineParent(ctx, parent, {
    deadlineStatus,
    ...(deadlineStatus === "overdue" && parent.overdueAt === undefined
      ? { overdueAt: Date.now() }
      : {}),
    deadlineReminderState: {
      [reminder.reminderType]: Date.now(),
    },
    updatedAt: Date.now(),
  });
  await ctx.db.patch(reminderId, {
    status: "sent",
    sentAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { status: "sent" };
}

export const setMicroGigDeadline = mutation({
  args: {
    jobId: v.id("jobs"),
    deadlineAt: v.number(),
    clientWallet: v.string(),
    walletType: v.optional(walletTypeValidator),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await setDeadline(ctx, {
      parentType: "micro_gig",
      parentId: args.jobId,
      deadlineAt: args.deadlineAt,
      clientWallet: args.clientWallet,
      ...(args.walletType !== undefined ? { changedByWalletType: args.walletType } : {}),
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
    });
  },
});

export const setMilestoneDeadline = mutation({
  args: {
    milestoneId: v.id("milestones"),
    deadlineAt: v.number(),
    clientWallet: v.string(),
    walletType: v.optional(walletTypeValidator),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await setDeadline(ctx, {
      parentType: "milestone",
      parentId: args.milestoneId,
      deadlineAt: args.deadlineAt,
      clientWallet: args.clientWallet,
      ...(args.walletType !== undefined ? { changedByWalletType: args.walletType } : {}),
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
    });
  },
});

export const updateDeadline = mutation({
  args: {
    parentType: deadlineParentTypeValidator,
    parentId: v.string(),
    deadlineAt: v.number(),
    clientWallet: v.string(),
    walletType: v.optional(walletTypeValidator),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await setDeadline(ctx, {
      parentType: args.parentType,
      parentId: args.parentId,
      deadlineAt: args.deadlineAt,
      clientWallet: args.clientWallet,
      ...(args.walletType !== undefined ? { changedByWalletType: args.walletType } : {}),
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
    });
  },
});

export const markNotificationRead = mutation({
  args: {
    notificationId: v.id("notifications"),
    recipientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const recipientWallet = normalizeWalletAddress(args.recipientWallet);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new NotFoundError("Notification not found.");
    }
    if (notification.recipientWallet !== recipientWallet) {
      throw new BadRequestError("Notification does not belong to this wallet.");
    }

    await ctx.db.patch(args.notificationId, { readAt: Date.now() });
    return true;
  },
});

export const markAllNotificationsRead = mutation({
  args: {
    recipientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const recipientWallet = normalizeWalletAddress(args.recipientWallet);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientWallet", recipientWallet))
      .take(200);
    const now = Date.now();

    for (const notification of notifications) {
      if (!notification.readAt) {
        await ctx.db.patch(notification._id, { readAt: now });
      }
    }

    return true;
  },
});

export const createDeadlineNotification = internalMutation({
  args: {
    recipientWallet: v.string(),
    type: notificationTypeValidator,
    title: v.string(),
    body: v.string(),
    parentType: deadlineParentTypeValidator,
    parentId: v.string(),
    jobId: v.optional(v.id("jobs")),
    milestoneId: v.optional(v.id("milestones")),
    escrowId: v.optional(v.id("escrows")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      ...args,
      recipientWallet: normalizeWalletAddress(args.recipientWallet),
      createdAt: Date.now(),
    });
  },
});

export const createDeadlineReminder = internalMutation({
  args: {
    parentType: deadlineParentTypeValidator,
    parentId: v.string(),
  },
  handler: async (ctx, args) => {
    const parent = await resolveDeadlineParent(ctx, args);
    await upsertDeadlineReminders(ctx, parent);
    return true;
  },
});

export const markReminderSent = internalMutation({
  args: {
    reminderId: v.id("deadlineReminders"),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) {
      throw new NotFoundError("Reminder not found.");
    }
    if (reminder.status === "sent") {
      throw new ConflictError("Reminder already sent.");
    }
    await ctx.db.patch(args.reminderId, {
      status: "sent",
      sentAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const markReminderSkipped = internalMutation({
  args: {
    reminderId: v.id("deadlineReminders"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) {
      throw new NotFoundError("Reminder not found.");
    }
    await ctx.db.patch(args.reminderId, {
      status: "skipped",
      updatedAt: Date.now(),
      metadata: {
        ...(typeof reminder.metadata === "object" && reminder.metadata !== null
          ? reminder.metadata
          : {}),
        skippedReason: args.reason ?? "not_applicable",
      },
    });
    return true;
  },
});

export const sendDeadlineReminder = internalMutation({
  args: {
    reminderId: v.id("deadlineReminders"),
  },
  handler: async (ctx, args) => {
    return await sendDueReminder(ctx, args.reminderId);
  },
});

export const scanUpcomingDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dueReminders = await ctx.db
      .query("deadlineReminders")
      .withIndex("by_status_scheduledFor", (q) =>
        q.eq("status", "pending").lte("scheduledFor", now),
      )
      .take(100);

    let sent = 0;
    let skipped = 0;
    for (const reminder of dueReminders) {
      const result = await sendDueReminder(ctx, reminder._id);
      if (result.status === "sent") sent += 1;
      if (result.status === "skipped") skipped += 1;
    }

    return { scanned: dueReminders.length, sent, skipped };
  },
});

export const markOverdueDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const overdueReminders = await ctx.db
      .query("deadlineReminders")
      .withIndex("by_status_scheduledFor", (q) =>
        q.eq("status", "pending").lte("scheduledFor", now),
      )
      .take(100);

    let sent = 0;
    let skipped = 0;
    for (const reminder of overdueReminders.filter(
      (reminder) => reminder.reminderType === "deadline_overdue",
    )) {
      const result = await sendDueReminder(ctx, reminder._id);
      if (result.status === "sent") sent += 1;
      if (result.status === "skipped") skipped += 1;
    }

    return { scanned: overdueReminders.length, sent, skipped };
  },
});

export const reconcileDeadlineReminderState = internalMutation({
  args: {
    parentType: deadlineParentTypeValidator,
    parentId: v.string(),
  },
  handler: async (ctx, args) => {
    const parent = await resolveDeadlineParent(ctx, args);
    await upsertDeadlineReminders(ctx, parent);
    return true;
  },
});
