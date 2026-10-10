import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  makeDisputeEventFields,
  makeDisputeFields,
  seedDisputeFixture,
  TEST_WALLETS,
} from "../fixtures/disputes";

const DISPUTE_PARENT_TYPES = ["micro_gig", "milestone", "escrow", "job"] as const;

const DISPUTE_REASON_CATEGORIES = [
  "work_not_delivered",
  "work_quality_issue",
  "client_unresponsive",
  "freelancer_unresponsive",
  "missed_deadline",
  "revision_disagreement",
  "payment_release_disagreement",
  "scope_disagreement",
  "other",
] as const;

const WALLET_TYPES = ["external_wallet", "passkey_smart_account"] as const;

const DISPUTE_STATUSES = [
  "open",
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const;

const DISPUTE_ON_CHAIN_STATUSES = ["not_marked", "marking", "marked", "mark_failed"] as const;

const DISPUTE_ACTOR_ROLES = ["client", "freelancer", "moderator", "system"] as const;

const DISPUTE_EVENT_TYPES = [
  "dispute_opened",
  "evidence_added",
  "on_chain_mark_started",
  "on_chain_mark_succeeded",
  "on_chain_mark_failed",
  "status_changed",
  "client_response_added",
  "freelancer_response_added",
  "moderator_note_added",
  "resolution_proposed",
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const;

describe("dispute schema contracts", () => {
  it.each(DISPUTE_STATUSES)("accepts dispute status %s", async (status) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    const inserted = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputes",
        makeDisputeFields(fixture, {
          disputeNumber: `DSP-C02-status-${status}`,
          status,
        }),
      ),
    );

    expect(inserted).toBeDefined();
  });

  it.each(DISPUTE_ON_CHAIN_STATUSES)("accepts on-chain marking phase %s", async (onChainStatus) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    const inserted = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputes",
        makeDisputeFields(fixture, {
          disputeNumber: `DSP-C02-on-chain-${onChainStatus}`,
          onChainStatus,
        }),
      ),
    );

    expect(inserted).toBeDefined();
  });

  it.each(DISPUTE_PARENT_TYPES)("accepts dispute parent type %s", async (parentType) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    const inserted = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputes",
        makeDisputeFields(fixture, {
          disputeNumber: `DSP-C02-parent-${parentType}`,
          parentType,
        }),
      ),
    );

    expect(inserted).toBeDefined();
  });

  it.each(DISPUTE_REASON_CATEGORIES)("accepts reason category %s", async (reasonCategory) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    const inserted = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputes",
        makeDisputeFields(fixture, {
          disputeNumber: `DSP-C02-reason-${reasonCategory}`,
          reasonCategory,
        }),
      ),
    );

    expect(inserted).toBeDefined();
  });

  it.each(WALLET_TYPES)(
    "accepts wallet type %s in dispute and event records",
    async (walletType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t);
      const disputeId = await t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, {
            disputeNumber: `DSP-C02-wallet-${walletType}`,
            clientWalletType: walletType,
            freelancerWalletType: walletType,
            openedByWalletType: walletType,
          }),
        ),
      );

      const eventId = await t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields(disputeId, {
            actorWalletType: walletType,
          }),
        ),
      );

      expect(eventId).toBeDefined();
    },
  );

  it.each(DISPUTE_ACTOR_ROLES)("accepts event actor role %s", async (actorRole) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);
    const disputeId = await t.run(async (ctx) =>
      ctx.db.insert("disputes", makeDisputeFields(fixture)),
    );

    const eventId = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputeEvents",
        makeDisputeEventFields(disputeId, {
          actorRole,
          actorWallet: actorRole === "system" ? "system" : TEST_WALLETS.client,
          actorWalletType: actorRole === "system" ? "system" : "external_wallet",
        }),
      ),
    );

    expect(eventId).toBeDefined();
  });

  it.each(DISPUTE_EVENT_TYPES)("accepts event type %s", async (type) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);
    const disputeId = await t.run(async (ctx) =>
      ctx.db.insert("disputes", makeDisputeFields(fixture)),
    );

    const eventId = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputeEvents",
        makeDisputeEventFields(disputeId, {
          type,
        }),
      ),
    );

    expect(eventId).toBeDefined();
  });

  it.each([
    ["without optional statuses", {}],
    ["with old status", { oldStatus: "open" }],
    ["with new status", { newStatus: "resolved_client" }],
    ["with both statuses", { oldStatus: "under_review", newStatus: "cancelled" }],
  ] as const)("accepts event status fields %s", async (_label, statusFields) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);
    const disputeId = await t.run(async (ctx) =>
      ctx.db.insert("disputes", makeDisputeFields(fixture)),
    );

    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("disputeEvents", makeDisputeEventFields(disputeId, statusFields)),
    );

    expect(eventId).toBeDefined();
  });

  it("rejects unknown enum values, missing fields, and incorrect field types", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, { status: "not_a_real_status" as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) => {
        const invalid = makeDisputeFields(fixture);
        delete (invalid as Partial<typeof invalid>).title;
        return await ctx.db.insert("disputes", invalid);
      }),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields("not-a-dispute-id" as Id<"disputes">),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, { openedAt: "not-a-number" as never }),
        ),
      ),
    ).rejects.toThrow();
  });

  it("rejects IDs belonging to the wrong table", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, {
            escrowId: fixture.jobId as unknown as Id<"escrows">,
          }),
        ),
      ),
    ).rejects.toThrow();
  });

  it("rejects uncovered enum, type, and wrong-table combinations", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, { parentType: "not_a_parent" as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, { reasonCategory: "not_a_reason" as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, { openedByWalletType: "not_a_wallet_type" as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert("disputes", makeDisputeFields(fixture, { clientWalletType: 42 as never })),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, { onChainStatus: "not_a_phase" as never }),
        ),
      ),
    ).rejects.toThrow();

    const disputeId = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputes",
        makeDisputeFields(fixture, { disputeNumber: "DSP-C02-invalid-event" }),
      ),
    );

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields(disputeId, { type: "not_an_event" as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields(disputeId, { actorRole: "not_a_role" as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields(disputeId, { actorWalletType: "not_a_wallet_type" as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields(disputeId, { oldStatus: 42 as never }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields(disputeId, {
            attachmentIds: [fixture.jobId as unknown as Id<"attachments">],
          }),
        ),
      ),
    ).rejects.toThrow();

    await expect(
      t.run(async (ctx) =>
        ctx.db.insert(
          "disputeEvents",
          makeDisputeEventFields(fixture.jobId as unknown as Id<"disputes">),
        ),
      ),
    ).rejects.toThrow();
  });
});
