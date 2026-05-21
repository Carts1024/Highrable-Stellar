import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import {
  assertCanViewDeadline,
  computeDeadlineStatus,
  getRemainingTimeLabel,
  resolveDeadlineParent,
} from "./helpers";
import { deadlineParentTypeValidator } from "./schema";

type TDeadlineView = ReturnType<typeof toDeadlineView>;

function toDeadlineView(
  parent: Awaited<ReturnType<typeof resolveDeadlineParent>>,
  now = Date.now(),
) {
  const status = computeDeadlineStatus({
    deadlineAt: parent.deadlineAt,
    submittedAt: parent.submittedAt,
    completedAt: parent.completedAt,
    approvedAt: parent.approvedAt,
    escrowStatus: parent.escrowStatus,
    workStatus: parent.status,
    now,
  });

  return {
    ...parent,
    deadlineStatus: status,
    remainingTimeLabel: getRemainingTimeLabel(parent.deadlineAt, now),
  };
}

async function getDeadlineViewsForWallet(
  ctx: QueryCtx,
  walletAddressInput: string,
): Promise<TDeadlineView[]> {
  const walletAddress = normalizeWalletAddress(walletAddressInput);
  const [jobs, milestones] = await Promise.all([
    ctx.db
      .query("jobs")
      .withIndex("by_clientWallet", (q) => q.eq("clientWallet", walletAddress))
      .take(100),
    ctx.db
      .query("milestones")
      .withIndex("by_assignedFreelancerWallet", (q) =>
        q.eq("assignedFreelancerWallet", walletAddress),
      )
      .take(100),
  ]);

  const freelancerJobs = await ctx.db
    .query("jobs")
    .withIndex("by_selectedFreelancerWallet", (q) =>
      q.eq("selectedFreelancerWallet", walletAddress),
    )
    .take(100);
  const ownedMilestones = await Promise.all(
    milestones.map((milestone: { _id: Id<"milestones"> }) =>
      resolveDeadlineParent(ctx, { parentType: "milestone", parentId: milestone._id }),
    ),
  );
  const jobParents = await Promise.all(
    [...jobs, ...freelancerJobs]
      .filter((job) => (job.jobType ?? "micro_gig") === "micro_gig")
      .map((job) => resolveDeadlineParent(ctx, { parentType: "micro_gig", parentId: job._id })),
  );

  return [...jobParents, ...ownedMilestones]
    .map((parent) => toDeadlineView(parent))
    .sort((left, right) => (left.deadlineAt ?? Infinity) - (right.deadlineAt ?? Infinity));
}

export const getDeadlineForParent = query({
  args: {
    parentType: deadlineParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = await assertCanViewDeadline(ctx, args);
    return toDeadlineView(parent);
  },
});

export const getDeadlinesForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    return await getDeadlineViewsForWallet(ctx, args.walletAddress);
  },
});

export const getUpcomingDeadlinesForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await getDeadlineViewsForWallet(ctx, args.walletAddress);
    return rows.filter(
      (row) =>
        row.deadlineStatus === "upcoming" ||
        row.deadlineStatus === "due_soon" ||
        row.deadlineStatus === "due_very_soon",
    );
  },
});

export const getOverdueWorkForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await getDeadlineViewsForWallet(ctx, args.walletAddress);
    return rows.filter((row) => row.deadlineStatus === "overdue");
  },
});

export const getDeadlineRemindersForParent = query({
  args: {
    parentType: deadlineParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertCanViewDeadline(ctx, args);
    return await ctx.db
      .query("deadlineReminders")
      .withIndex("by_parent", (q) =>
        q.eq("parentType", args.parentType).eq("parentId", args.parentId),
      )
      .take(20);
  },
});

export const getNotificationsForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientWallet", walletAddress))
      .order("desc")
      .take(100);
  },
});

export const getUnreadNotificationCount = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientWallet", walletAddress))
      .take(200);

    return notifications.filter((notification) => notification.readAt === undefined).length;
  },
});
