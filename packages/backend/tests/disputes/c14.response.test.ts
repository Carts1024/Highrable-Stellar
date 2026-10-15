import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  type BackendTest,
  seedDisputeFixture,
  snapshotDisputeCreationState,
  TEST_WALLETS,
} from "../fixtures/disputes";

const ACTIVE_STATUSES = [
  "open",
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
] as const;

const TERMINAL_STATUSES = [
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const;

const PARENT_TYPES = ["micro_gig", "milestone"] as const;
const PARTICIPANT_ROLES = ["client", "freelancer"] as const;
const WALLET_TYPES = ["external_wallet", "passkey_smart_account"] as const;

type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
type WalletType = (typeof WALLET_TYPES)[number];
type DisputeStatus = (typeof ACTIVE_STATUSES)[number] | (typeof TERMINAL_STATUSES)[number];
type ResponseCase = {
  status: DisputeStatus;
  parentType: (typeof PARENT_TYPES)[number];
  role: ParticipantRole;
  walletType: WalletType;
};

const responseCases = (statuses: readonly DisputeStatus[]): ResponseCase[] =>
  statuses.flatMap((status) =>
    PARENT_TYPES.flatMap((parentType) =>
      PARTICIPANT_ROLES.flatMap((role) =>
        WALLET_TYPES.map((walletType) => ({ status, parentType, role, walletType })),
      ),
    ),
  );

function walletForRole(
  fixture: Awaited<ReturnType<typeof seedDisputeFixture>>,
  role: ParticipantRole,
) {
  return role === "client" ? fixture.clientWallet : fixture.freelancerWallet;
}

function createDispute(t: BackendTest, fixture: Awaited<ReturnType<typeof seedDisputeFixture>>) {
  return t.mutation(api.disputes.createDispute, {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_not_delivered",
    title: "C14 response dispute",
    description: "C14 response fixture dispute.",
  });
}

async function insertAttachment(
  t: BackendTest,
  fixture: Awaited<ReturnType<typeof seedDisputeFixture>>,
  role: ParticipantRole,
  label: string,
) {
  const wallet = walletForRole(fixture, role);
  return await t.run(async (ctx) =>
    ctx.db.insert("attachments", {
      type: "file",
      name: `${label}.txt`,
      size: 10,
      mimeType: "text/plain",
      uploadedByWallet: wallet,
      uploadedByWalletType: "external_wallet",
      ownerRole: role,
      parentType: "unknown",
      visibility: "private",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

async function responseEvents(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("disputeEvents")
        .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
        .collect()
    ).filter(
      (event) =>
        event.type === "client_response_added" || event.type === "freelancer_response_added",
    ),
  );
}

async function responseNotifications(
  t: BackendTest,
  recipientWallet?: string,
  disputeId?: Id<"disputes">,
) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("notifications").collect()).filter((notification) => {
      if (notification.type !== "dispute_response_added") return false;
      if (recipientWallet !== undefined && notification.recipientWallet !== recipientWallet) {
        return false;
      }
      if (disputeId !== undefined) {
        const metadata = notification.metadata;
        if (
          typeof metadata !== "object" ||
          metadata === null ||
          (metadata as { disputeId?: Id<"disputes"> }).disputeId !== disputeId
        ) {
          return false;
        }
      }
      return true;
    }),
  );
}

describe("Deliverable 3 C14 participant response hardening", () => {
  it.each(responseCases(ACTIVE_STATUSES))(
    "accepts $role responses from $walletType wallets on $parentType parents in $status",
    async ({ status, parentType, role, walletType }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c14-active-${status}-${parentType}-${role}-${walletType}`,
      });
      const disputeId = await createDispute(t, fixture);

      await t.run(async (ctx) => ctx.db.patch(disputeId, { status }));

      expect(
        await t.mutation(api.disputes.addDisputeResponse, {
          disputeId,
          responderWallet: walletForRole(fixture, role),
          responderWalletType: walletType,
          message: "An active participant response.",
          requestId: `active-${status}-${parentType}-${role}-${walletType}`,
        }),
      ).toBe(true);
    },
  );

  it.each(responseCases(TERMINAL_STATUSES))(
    "rejects $role responses from $walletType wallets on $parentType parents in terminal $status",
    async ({ status, parentType, role, walletType }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c14-terminal-${status}-${parentType}-${role}-${walletType}`,
      });
      const disputeId = await createDispute(t, fixture);
      await t.run(async (ctx) => ctx.db.patch(disputeId, { status }));
      const before = await snapshotDisputeCreationState(t);

      await expect(
        t.mutation(api.disputes.addDisputeResponse, {
          disputeId,
          responderWallet: walletForRole(fixture, role),
          responderWalletType: walletType,
          message: "A terminal response.",
          requestId: `terminal-${status}-${parentType}-${role}-${walletType}`,
        }),
      ).rejects.toThrow("not accepting new responses");
      expect(await snapshotDisputeCreationState(t)).toEqual(before);
    },
  );

  it("creates one attributed response event and one opposite-participant notification without a conversation message", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { parentType: "milestone", label: "c14-effects" });
    const disputeId = await createDispute(t, fixture);
    const attachmentId = await insertAttachment(t, fixture, "freelancer", "c14-response");
    const beforeMessages = await t.run(
      async (ctx) => (await ctx.db.query("messages").collect()).length,
    );

    expect(
      await t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.freelancerWallet,
        responderWalletType: "passkey_smart_account",
        message: "  Milestone response\n",
        attachmentIds: [attachmentId, attachmentId],
        requestId: "  c14-effects-request  ",
      }),
    ).toBe(true);

    const events = await responseEvents(t, disputeId);
    const notifications = await responseNotifications(t, fixture.clientWallet, disputeId);
    const records = await t.run(async (ctx) => ({
      dispute: await ctx.db.get(disputeId),
      attachment: await ctx.db.get(attachmentId),
      messages: await ctx.db.query("messages").collect(),
    }));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "freelancer_response_added",
      actorWallet: fixture.freelancerWallet,
      actorWalletType: "passkey_smart_account",
      actorRole: "freelancer",
      message: "Milestone response",
      attachmentIds: [attachmentId],
      requestId: "c14-effects-request",
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      recipientWallet: fixture.clientWallet,
      type: "dispute_response_added",
      parentType: "milestone",
      parentId: fixture.milestoneId,
      jobId: fixture.jobId,
      milestoneId: fixture.milestoneId,
      escrowId: fixture.escrowId,
    });
    expect(records.attachment).toMatchObject({
      parentType: "dispute",
      parentId: disputeId,
      visibility: "participants",
    });
    expect(records.dispute?.evidenceAttachmentIds).toEqual([attachmentId]);
    expect(records.messages).toHaveLength(beforeMessages);
  });

  it("replays a matching keyed response without writes, including timestamps and access logs", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c14-replay" });
    const disputeId = await createDispute(t, fixture);
    const attachmentId = await insertAttachment(t, fixture, "client", "c14-replay");
    const args = {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet" as const,
      message: "  Same response\n",
      attachmentIds: [attachmentId, attachmentId],
      requestId: "c14-replay-request",
    };

    await t.mutation(api.disputes.addDisputeResponse, args);
    await t.run(async (ctx) =>
      ctx.db.insert("attachmentAccessLogs", {
        attachmentId,
        parentType: "dispute",
        parentId: disputeId,
        viewerWallet: fixture.clientWallet,
        viewerWalletType: "external_wallet",
        viewerRole: "dispute_participant",
        action: "preview_opened",
        result: "allowed",
        createdAt: Date.now(),
      }),
    );
    const before = await snapshotDisputeCreationState(t);
    expect(await t.mutation(api.disputes.addDisputeResponse, args)).toBe(true);
    expect(await snapshotDisputeCreationState(t)).toEqual(before);
    expect(await responseEvents(t, disputeId)).toHaveLength(1);
    expect(await responseNotifications(t, fixture.freelancerWallet, disputeId)).toHaveLength(1);
  });

  it("rejects conflicting keyed reuse atomically when content, wallet type, or attachment order changes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c14-conflict" });
    const disputeId = await createDispute(t, fixture);
    const firstAttachment = await insertAttachment(t, fixture, "client", "c14-conflict-first");
    const secondAttachment = await insertAttachment(t, fixture, "client", "c14-conflict-second");
    const first = {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet" as const,
      message: "First response",
      attachmentIds: [firstAttachment, secondAttachment],
      requestId: "c14-conflict-request",
    };
    await t.mutation(api.disputes.addDisputeResponse, first);

    for (const conflicting of [
      { ...first, message: "Different response" },
      { ...first, responderWalletType: "passkey_smart_account" as const },
      { ...first, attachmentIds: [secondAttachment, firstAttachment] },
    ]) {
      const before = await snapshotDisputeCreationState(t);
      await expect(t.mutation(api.disputes.addDisputeResponse, conflicting)).rejects.toThrow(
        "already used for a different dispute response",
      );
      expect(await snapshotDisputeCreationState(t)).toEqual(before);
    }
    expect(await responseEvents(t, disputeId)).toHaveLength(1);
    expect(await responseNotifications(t, fixture.freelancerWallet, disputeId)).toHaveLength(1);
  });

  it("serializes concurrent matching calls to one keyed operation", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c14-concurrent" });
    const disputeId = await createDispute(t, fixture);
    const args = {
      disputeId,
      responderWallet: fixture.freelancerWallet,
      responderWalletType: "passkey_smart_account" as const,
      message: "Concurrent response",
      requestId: "c14-concurrent-request",
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () => t.mutation(api.disputes.addDisputeResponse, args)),
    );
    expect(results).toEqual(Array.from({ length: 8 }, () => true));
    expect(await responseEvents(t, disputeId)).toHaveLength(1);
    expect(await responseNotifications(t, fixture.clientWallet, disputeId)).toHaveLength(1);
  });

  it("allows identical content under different keys and isolates keys by actor and case", async () => {
    const t = convexTest(schema, modules);
    const firstFixture = await seedDisputeFixture(t, { label: "c14-key-isolation-first" });
    const secondFixture = await seedDisputeFixture(t, { label: "c14-key-isolation-second" });
    const firstDisputeId = await createDispute(t, firstFixture);
    const secondDisputeId = await createDispute(t, secondFixture);

    const content = {
      message: "Identical response content",
      responderWalletType: "external_wallet" as const,
    };
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId: firstDisputeId,
      responderWallet: firstFixture.clientWallet,
      ...content,
      requestId: "shared-key",
    });
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId: firstDisputeId,
      responderWallet: firstFixture.clientWallet,
      ...content,
      requestId: "different-key",
    });
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId: firstDisputeId,
      responderWallet: firstFixture.freelancerWallet,
      ...content,
      requestId: "shared-key",
    });
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId: secondDisputeId,
      responderWallet: secondFixture.clientWallet,
      ...content,
      requestId: "shared-key",
    });

    expect(await responseEvents(t, firstDisputeId)).toHaveLength(3);
    expect(await responseEvents(t, secondDisputeId)).toHaveLength(1);
  });

  it.each([
    ["empty", "   "],
    ["too long", "x".repeat(129)],
  ] as const)("rejects %s request IDs without writes", async (_label, requestId) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: `c14-request-id-${_label}` });
    const disputeId = await createDispute(t, fixture);
    const before = await snapshotDisputeCreationState(t);

    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "Response",
        requestId,
      }),
    ).rejects.toThrow();
    expect(await snapshotDisputeCreationState(t)).toEqual(before);
  });

  it("validates authorization, parent relationships, status, messages, and attachments before replay lookup", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c14-validation-order" });
    const disputeId = await createDispute(t, fixture);
    const attachmentId = await insertAttachment(t, fixture, "client", "c14-validation");
    const args = {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet" as const,
      message: "Validated response",
      attachmentIds: [attachmentId],
      requestId: "c14-validation-request",
    };
    await t.mutation(api.disputes.addDisputeResponse, args);

    const rejectionCases = [
      {
        arrange: async () =>
          await t.run(async (ctx) =>
            ctx.db.patch(fixture.jobId, { clientWallet: fixture.unrelatedWallet }),
          ),
        expected: "Escrow client must match the parent job owner",
        restore: async () =>
          await t.run(async (ctx) =>
            ctx.db.patch(fixture.jobId, { clientWallet: fixture.clientWallet }),
          ),
        mutation: args,
      },
      {
        arrange: async () =>
          await t.run(async (ctx) => ctx.db.patch(disputeId, { status: "cancelled" })),
        expected: "not accepting new responses",
        restore: async () =>
          await t.run(async (ctx) => ctx.db.patch(disputeId, { status: "open" })),
        mutation: args,
      },
      {
        arrange: async () => undefined,
        expected: "message is required",
        restore: async () => undefined,
        mutation: { ...args, message: "  " },
      },
      {
        arrange: async () =>
          await t.run(async (ctx) => ctx.db.patch(attachmentId, { status: "deleted" })),
        expected: "Attachment not found",
        restore: async () =>
          await t.run(async (ctx) => ctx.db.patch(attachmentId, { status: "active" })),
        mutation: args,
      },
      {
        arrange: async () => undefined,
        expected: "Only the client or assigned freelancer",
        restore: async () => undefined,
        mutation: { ...args, responderWallet: fixture.unrelatedWallet },
      },
    ] as const;

    for (const rejectionCase of rejectionCases) {
      await rejectionCase.arrange();
      const before = await snapshotDisputeCreationState(t);
      await expect(
        t.mutation(api.disputes.addDisputeResponse, rejectionCase.mutation),
      ).rejects.toThrow(rejectionCase.expected);
      expect(await snapshotDisputeCreationState(t)).toEqual(before);
      await rejectionCase.restore();
    }

    const conflictingParentFixture = await seedDisputeFixture(t, {
      label: "c14-validation-conflicting-parent",
    });
    await t.run(async (ctx) =>
      ctx.db.patch(fixture.escrowId, { jobId: conflictingParentFixture.jobId }),
    );
    const conflictingParentBefore = await snapshotDisputeCreationState(t);
    await expect(t.mutation(api.disputes.addDisputeResponse, args)).rejects.toThrow(
      "Escrow is not linked to its parent job",
    );
    expect(await snapshotDisputeCreationState(t)).toEqual(conflictingParentBefore);
    await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { jobId: fixture.jobId }));

    const missingParentTest = convexTest(schema, modules);
    const missingParentFixture = await seedDisputeFixture(missingParentTest, {
      label: "c14-validation-missing-parent",
    });
    const missingParentDisputeId = await createDispute(missingParentTest, missingParentFixture);
    await missingParentTest.mutation(api.disputes.addDisputeResponse, {
      disputeId: missingParentDisputeId,
      responderWallet: missingParentFixture.clientWallet,
      responderWalletType: "external_wallet",
      message: "Missing-parent response",
      requestId: "c14-missing-parent-request",
    });
    await missingParentTest.run(async (ctx) => ctx.db.delete(missingParentFixture.jobId));
    const missingParentBefore = await snapshotDisputeCreationState(missingParentTest);
    await expect(
      missingParentTest.mutation(api.disputes.addDisputeResponse, {
        disputeId: missingParentDisputeId,
        responderWallet: missingParentFixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "Missing-parent response",
        requestId: "c14-missing-parent-request",
      }),
    ).rejects.toThrow("Parent job not found");
    expect(await snapshotDisputeCreationState(missingParentTest)).toEqual(missingParentBefore);
  });

  it("keeps omitted request IDs backward compatible and leaves legacy events without a key", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c14-legacy" });
    const disputeId = await createDispute(t, fixture);
    const response = {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet" as const,
      message: "Legacy response",
    };

    expect(await t.mutation(api.disputes.addDisputeResponse, response)).toBe(true);
    expect(await t.mutation(api.disputes.addDisputeResponse, response)).toBe(true);
    const events = await responseEvents(t, disputeId);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.requestId === undefined)).toBe(true);

    const legacyEventId = await t.run(async (ctx) =>
      ctx.db.insert("disputeEvents", {
        disputeId,
        type: "freelancer_response_added",
        actorWallet: fixture.freelancerWallet,
        actorWalletType: "external_wallet",
        actorRole: "freelancer",
        message: "Legacy stored response",
        attachmentIds: [],
        createdAt: Date.now(),
      }),
    );
    const legacyEvent = await t.run(async (ctx) => ctx.db.get(legacyEventId));
    expect(legacyEvent?.requestId).toBeUndefined();
  });

  it("keeps timeline order, tie order, case isolation, and the 200-event boundary while replaying an older keyed event", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c14-timeline-first" });
    const otherFixture = await seedDisputeFixture(t, { label: "c14-timeline-second" });
    const disputeId = await createDispute(t, fixture);
    const otherDisputeId = await createDispute(t, otherFixture);

    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet",
      message: "Old keyed response",
      requestId: "c14-old-key",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("disputeEvents", {
        disputeId: otherDisputeId,
        type: "moderator_note_added",
        actorWallet: TEST_WALLETS.admin,
        actorWalletType: "external_wallet",
        actorRole: "moderator",
        message: "Other case event",
        attachmentIds: [],
        createdAt: Date.now() + 1,
      });
      await ctx.db.insert("disputeEvents", {
        disputeId,
        type: "moderator_note_added",
        actorWallet: TEST_WALLETS.admin,
        actorWalletType: "external_wallet",
        actorRole: "moderator",
        message: "Later event",
        attachmentIds: [],
        createdAt: Date.now() + 2,
      });
      await ctx.db.insert("disputeEvents", {
        disputeId,
        type: "moderator_note_added",
        actorWallet: TEST_WALLETS.admin,
        actorWalletType: "external_wallet",
        actorRole: "moderator",
        message: "Earlier event",
        attachmentIds: [],
        createdAt: Date.now() - 1,
      });
      await ctx.db.insert("disputeEvents", {
        disputeId,
        type: "moderator_note_added",
        actorWallet: TEST_WALLETS.admin,
        actorWalletType: "external_wallet",
        actorRole: "moderator",
        message: "Tie first",
        attachmentIds: [],
        createdAt: Date.now() + 3,
      });
      await ctx.db.insert("disputeEvents", {
        disputeId,
        type: "moderator_note_added",
        actorWallet: TEST_WALLETS.admin,
        actorWalletType: "external_wallet",
        actorRole: "moderator",
        message: "Tie second",
        attachmentIds: [],
        createdAt: Date.now() + 3,
      });
    });

    const timeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    expect(timeline.map((event) => event.message)).toEqual([
      "Earlier event",
      expect.stringContaining("Client opened"),
      "Old keyed response",
      "Later event",
      "Tie first",
      "Tie second",
    ]);
    expect(
      await t.query(api.disputes.getDisputeTimeline, {
        disputeId: otherDisputeId,
        viewerWallet: otherFixture.clientWallet,
      }),
    ).toHaveLength(2);

    const keyedEvent = (await responseEvents(t, disputeId)).find(
      (event) => event.requestId === "c14-old-key",
    );
    if (!keyedEvent) throw new Error("The keyed response event was not created.");
    await t.run(async (ctx) => ctx.db.patch(keyedEvent._id, { createdAt: Date.now() + 1_000 }));

    await t.run(async (ctx) => {
      for (let index = 0; index < 201; index += 1) {
        await ctx.db.insert("disputeEvents", {
          disputeId,
          type: "moderator_note_added",
          actorWallet: TEST_WALLETS.admin,
          actorWalletType: "external_wallet",
          actorRole: "moderator",
          message: `Boundary event ${index}`,
          attachmentIds: [],
          createdAt: Date.now() + 100 + index,
        });
      }
    });

    const boundedTimeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    expect(boundedTimeline).toHaveLength(200);
    expect(boundedTimeline.some((event) => event.requestId === "c14-old-key")).toBe(false);

    const beforeReplay = await snapshotDisputeCreationState(t);
    expect(
      await t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "Old keyed response",
        requestId: "c14-old-key",
      }),
    ).toBe(true);
    expect(await snapshotDisputeCreationState(t)).toEqual(beforeReplay);
  });
});
