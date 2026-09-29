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
  it("accepts every existing status and on-chain marking phase", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);

    const inserted = await t.run(async (ctx) => {
      const disputeIds = [];
      for (const [index, status] of DISPUTE_STATUSES.entries()) {
        disputeIds.push(
          await ctx.db.insert(
            "disputes",
            makeDisputeFields(fixture, {
              disputeNumber: `DSP-C02-status-${index}`,
              status,
              onChainStatus: DISPUTE_ON_CHAIN_STATUSES[index % DISPUTE_ON_CHAIN_STATUSES.length],
            }),
          ),
        );
      }
      return disputeIds;
    });

    expect(inserted).toHaveLength(DISPUTE_STATUSES.length);
  });

  it("accepts every existing event type and actor role", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t);
    const disputeId = await t.run(async (ctx) =>
      ctx.db.insert("disputes", makeDisputeFields(fixture)),
    );

    const inserted = await t.run(async (ctx) => {
      const eventIds = [];
      for (const [index, type] of DISPUTE_EVENT_TYPES.entries()) {
        eventIds.push(
          await ctx.db.insert(
            "disputeEvents",
            makeDisputeEventFields(disputeId, {
              type,
              actorRole: DISPUTE_ACTOR_ROLES[index % DISPUTE_ACTOR_ROLES.length],
              actorWallet:
                DISPUTE_ACTOR_ROLES[index % DISPUTE_ACTOR_ROLES.length] === "system"
                  ? "system"
                  : TEST_WALLETS.client,
              actorWalletType:
                DISPUTE_ACTOR_ROLES[index % DISPUTE_ACTOR_ROLES.length] === "system"
                  ? "system"
                  : "external_wallet",
              createdAt: 1_768_480_800_000 + index,
            }),
          ),
        );
      }
      return eventIds;
    });

    expect(inserted).toHaveLength(DISPUTE_EVENT_TYPES.length);
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
});
