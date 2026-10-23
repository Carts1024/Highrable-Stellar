import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import { TEST_WALLETS } from "../fixtures/disputes";

type DeadlineParentType = "micro_gig" | "milestone";
type BackendTest = TestConvex<typeof schema>;
const FIXED_TEST_TIME = new Date("2026-01-15T12:00:00.000Z").getTime();

async function seedDueReminder(
  t: BackendTest,
  options: {
    parentType: DeadlineParentType;
    deadlineAt: number;
    reminderType: "deadline_1h" | "deadline_overdue";
    assignParentFreelancer?: boolean;
    assignEscrowFreelancer?: boolean;
  },
) {
  return await t.run(async (ctx) => {
    const jobId = await ctx.db.insert("jobs", {
      title: "Deadline reminder test",
      description: "Test fixture",
      budget: 500,
      asset: "USDC",
      jobType: options.parentType === "micro_gig" ? "micro_gig" : "milestone_project",
      clientWallet: TEST_WALLETS.client,
      ...(options.parentType === "micro_gig" && options.assignParentFreelancer
        ? { selectedFreelancerWallet: TEST_WALLETS.freelancer }
        : {}),
      status: "funded",
      deadlineAt: options.deadlineAt,
      jobHash: "deadline-reminder-test",
      createdAt: FIXED_TEST_TIME - 60_000,
      updatedAt: FIXED_TEST_TIME - 60_000,
    });

    const milestoneId =
      options.parentType === "milestone"
        ? await ctx.db.insert("milestones", {
            jobId,
            order: 1,
            title: "Test milestone",
            amount: 500,
            asset: "USDC",
            status: "funded",
            ...(options.assignParentFreelancer
              ? { assignedFreelancerWallet: TEST_WALLETS.freelancer }
              : {}),
            deadlineAt: options.deadlineAt,
            createdAt: FIXED_TEST_TIME - 60_000,
            updatedAt: FIXED_TEST_TIME - 60_000,
          })
        : undefined;

    const escrowId = await ctx.db.insert("escrows", {
      jobId,
      ...(milestoneId !== undefined ? { milestoneId } : {}),
      escrowId: "deadline-reminder-test-escrow",
      clientWallet: TEST_WALLETS.client,
      ...(options.assignEscrowFreelancer ? { freelancerWallet: TEST_WALLETS.freelancer } : {}),
      amount: 500,
      asset: "USDC",
      status: "funded",
      createdAt: FIXED_TEST_TIME - 60_000,
      updatedAt: FIXED_TEST_TIME - 60_000,
    });

    const parentId = milestoneId ?? jobId;
    const reminderId = await ctx.db.insert("deadlineReminders", {
      parentType: options.parentType,
      parentId,
      jobId,
      ...(milestoneId !== undefined ? { milestoneId } : {}),
      escrowId,
      clientWallet: TEST_WALLETS.client,
      ...(options.assignParentFreelancer || options.assignEscrowFreelancer
        ? { freelancerWallet: TEST_WALLETS.freelancer }
        : {}),
      reminderType: options.reminderType,
      scheduledFor: FIXED_TEST_TIME - 1,
      status: "pending",
      recipientWallets:
        options.reminderType === "deadline_overdue"
          ? [TEST_WALLETS.client]
          : [TEST_WALLETS.freelancer],
      createdAt: FIXED_TEST_TIME - 60_000,
      updatedAt: FIXED_TEST_TIME - 60_000,
    });

    return { jobId, milestoneId, escrowId, reminderId };
  });
}

describe("scan upcoming deadlines", () => {
  it("sends an overdue notification when a funded open escrow has no freelancer assigned", async () => {
    const t = convexTest(schema, modules);
    const { jobId, reminderId } = await seedDueReminder(t, {
      parentType: "micro_gig",
      deadlineAt: FIXED_TEST_TIME - 1,
      reminderType: "deadline_overdue",
    });

    await expect(t.mutation(internal.deadlines.scanUpcomingDeadlines, {})).resolves.toEqual({
      scanned: 1,
      sent: 1,
      skipped: 0,
    });

    const state = await t.run(async (ctx) => ({
      job: await ctx.db.get(jobId),
      reminder: await ctx.db.get(reminderId),
      notifications: await ctx.db.query("notifications").collect(),
      conversations: await ctx.db.query("conversations").collect(),
      messages: await ctx.db.query("messages").collect(),
    }));

    expect(state.reminder?.status).toBe("sent");
    expect(state.job).toMatchObject({ deadlineStatus: "overdue" });
    expect(state.job?.overdueAt).toBe(FIXED_TEST_TIME);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      recipientWallet: TEST_WALLETS.client,
      type: "deadline_overdue",
    });
    expect(state.conversations).toHaveLength(0);
    expect(state.messages).toHaveLength(0);
  });

  it.each(["micro_gig", "milestone"] as const)(
    "posts to the assigned %s conversation when the escrow itself is not assigned",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const { jobId, milestoneId } = await seedDueReminder(t, {
        parentType,
        deadlineAt: FIXED_TEST_TIME + 30 * 60_000,
        reminderType: "deadline_1h",
        assignParentFreelancer: true,
      });

      await expect(t.mutation(internal.deadlines.scanUpcomingDeadlines, {})).resolves.toEqual({
        scanned: 1,
        sent: 1,
        skipped: 0,
      });

      const state = await t.run(async (ctx) => ({
        conversations: await ctx.db.query("conversations").collect(),
        messages: await ctx.db.query("messages").collect(),
        notifications: await ctx.db.query("notifications").collect(),
      }));
      const expectedParentId = parentType === "milestone" ? milestoneId : jobId;

      expect(state.conversations).toHaveLength(1);
      expect(state.conversations[0]).toMatchObject({
        parentType,
        parentId: expectedParentId,
        participantWallets: [TEST_WALLETS.client, TEST_WALLETS.freelancer],
      });
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toMatchObject({
        parentType,
        parentId: expectedParentId,
        eventType: "deadline_warning",
      });
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0]).toMatchObject({
        recipientWallet: TEST_WALLETS.freelancer,
        type: "deadline_warning",
      });
    },
  );

  it("keeps deadline event messages in an assigned escrow conversation", async () => {
    const t = convexTest(schema, modules);
    const { escrowId } = await seedDueReminder(t, {
      parentType: "micro_gig",
      deadlineAt: FIXED_TEST_TIME + 30 * 60_000,
      reminderType: "deadline_1h",
      assignParentFreelancer: true,
      assignEscrowFreelancer: true,
    });

    await t.mutation(internal.deadlines.scanUpcomingDeadlines, {});

    const state = await t.run(async (ctx) => ({
      conversations: await ctx.db.query("conversations").collect(),
      messages: await ctx.db.query("messages").collect(),
    }));

    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0]).toMatchObject({
      parentType: "escrow",
      parentId: escrowId,
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      parentType: "escrow",
      parentId: escrowId,
      eventType: "deadline_warning",
    });
  });
});
