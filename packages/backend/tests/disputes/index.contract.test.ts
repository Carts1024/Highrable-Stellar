import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  assignDisputeFixture,
  type BackendTest,
  makeDisputeEventFields,
  makeDisputeFields,
  seedDisputeFixture,
  TEST_ADMIN_SECRET,
  TEST_WALLETS,
} from "../fixtures/disputes";

async function createDispute(
  t: BackendTest,
  fixture: Awaited<ReturnType<typeof seedDisputeFixture>>,
  openedByWallet = fixture.clientWallet,
) {
  return await t.mutation(api.disputes.createDispute, {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_quality_issue",
    title: "Index contract dispute",
    description: "Index contract fixture dispute.",
  });
}

describe("dispute index contracts", () => {
  it("locks every existing dispute and event index name and field order", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      label: "all-indexes",
      parentType: "milestone",
      escrowStatus: "submitted",
    });
    const disputeId = await t.run(async (ctx) =>
      ctx.db.insert("disputes", makeDisputeFields(fixture)),
    );
    await t.run(async (ctx) =>
      ctx.db.insert(
        "disputeEvents",
        makeDisputeEventFields(disputeId, {
          type: "moderator_note_added",
          actorWallet: TEST_WALLETS.admin,
          actorRole: "moderator",
          createdAt: 1_768_480_800_001,
        }),
      ),
    );

    const indexed = await t.run(async (ctx) => {
      const disputeByNumber = await ctx.db
        .query("disputes")
        .withIndex("by_disputeNumber", (q) => q.eq("disputeNumber", "DSP-C02-milestone-submitted"))
        .first();
      const disputeByParent = await ctx.db
        .query("disputes")
        .withIndex("by_parent_status", (q) =>
          q
            .eq("parentType", fixture.parentType)
            .eq("parentId", fixture.parentId)
            .eq("status", "open"),
        )
        .first();
      const disputeByEscrow = await ctx.db
        .query("disputes")
        .withIndex("by_escrow_status", (q) =>
          q.eq("escrowId", fixture.escrowId).eq("status", "open"),
        )
        .first();
      const disputeByOnChainEscrow = await ctx.db
        .query("disputes")
        .withIndex("by_onChainEscrow_status", (q) =>
          q.eq("onChainEscrowId", "on-chain-milestone-submitted").eq("status", "open"),
        )
        .first();
      const disputeByMilestone = await ctx.db
        .query("disputes")
        .withIndex("by_milestone_status", (q) =>
          q.eq("milestoneId", fixture.milestoneId!).eq("status", "open"),
        )
        .first();
      const disputeByClient = await ctx.db
        .query("disputes")
        .withIndex("by_client", (q) =>
          q.eq("clientWallet", fixture.clientWallet).eq("updatedAt", 1_768_480_800_000),
        )
        .first();
      const disputeByFreelancer = await ctx.db
        .query("disputes")
        .withIndex("by_freelancer", (q) =>
          q.eq("freelancerWallet", fixture.freelancerWallet).eq("updatedAt", 1_768_480_800_000),
        )
        .first();
      const disputeByStatus = await ctx.db
        .query("disputes")
        .withIndex("by_status", (q) => q.eq("status", "open").eq("updatedAt", 1_768_480_800_000))
        .first();
      const eventByDispute = await ctx.db
        .query("disputeEvents")
        .withIndex("by_dispute", (q) =>
          q.eq("disputeId", disputeId).eq("createdAt", 1_768_480_800_001),
        )
        .first();
      const eventByType = await ctx.db
        .query("disputeEvents")
        .withIndex("by_type", (q) =>
          q.eq("type", "moderator_note_added").eq("createdAt", 1_768_480_800_001),
        )
        .first();

      return {
        disputeByClient,
        disputeByEscrow,
        disputeByFreelancer,
        disputeByMilestone,
        disputeByNumber,
        disputeByOnChainEscrow,
        disputeByParent,
        disputeByStatus,
        eventByDispute,
        eventByType,
      };
    });

    expect(Object.values(indexed).every(Boolean)).toBe(true);
    expect(indexed.disputeByNumber?._id).toBe(disputeId);
    expect(indexed.eventByDispute?._id).toBe(indexed.eventByType?._id);
  });

  it("supports participant filtering, parent/escrow lookup, status filtering, and chronological timelines", async () => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", TEST_WALLETS.admin);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", TEST_ADMIN_SECRET);

    const t = convexTest(schema, modules);
    const microFixture = await seedDisputeFixture(t, {
      label: "lookup-micro",
      parentType: "micro_gig",
    });
    const milestoneFixture = await seedDisputeFixture(t, {
      label: "lookup-milestone",
      parentType: "milestone",
      escrowStatus: "submitted",
    });
    const microDisputeId = await createDispute(t, microFixture);
    const milestoneDisputeId = await createDispute(
      t,
      milestoneFixture,
      milestoneFixture.freelancerWallet,
    );
    await assignDisputeFixture(t, microDisputeId, TEST_WALLETS.admin);

    const clientDisputes = await t.query(api.disputes.getDisputesForWallet, {
      walletAddress: TEST_WALLETS.client,
    });
    const freelancerDisputes = await t.query(api.disputes.getDisputesForWallet, {
      walletAddress: TEST_WALLETS.freelancer,
    });
    const unrelatedDisputes = await t.query(api.disputes.getDisputesForWallet, {
      walletAddress: TEST_WALLETS.unrelated,
    });
    const parentDispute = await t.query(api.disputes.getDisputeByParent, {
      parentType: milestoneFixture.parentType,
      parentId: milestoneFixture.parentId,
      viewerWallet: TEST_WALLETS.client,
    });
    const escrowDispute = await t.query(api.disputes.getActiveDisputeForEscrow, {
      escrowId: microFixture.escrowId,
      viewerWallet: TEST_WALLETS.client,
    });

    await t.mutation(api.admin.changeDisputeReviewStatus, {
      adminWallet: TEST_WALLETS.admin,
      adminApiSecret: TEST_ADMIN_SECRET,
      disputeId: microDisputeId,
      status: "under_review",
    });
    const underReview = await t.query(api.admin.listAdminDisputes, {
      adminWallet: TEST_WALLETS.admin,
      adminApiSecret: TEST_ADMIN_SECRET,
      status: "under_review",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert(
        "disputeEvents",
        makeDisputeEventFields(microDisputeId, {
          type: "moderator_note_added",
          actorWallet: TEST_WALLETS.admin,
          actorRole: "moderator",
          message: "Later event",
          createdAt: 1_768_480_800_200,
        }),
      );
      await ctx.db.insert(
        "disputeEvents",
        makeDisputeEventFields(microDisputeId, {
          type: "status_changed",
          actorWallet: TEST_WALLETS.admin,
          actorRole: "moderator",
          message: "Middle event",
          createdAt: 1_768_480_800_100,
        }),
      );
    });
    const timeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId: microDisputeId,
      viewerWallet: TEST_WALLETS.client,
    });

    expect(clientDisputes.map((dispute) => dispute._id)).toEqual(
      expect.arrayContaining([microDisputeId, milestoneDisputeId]),
    );
    expect(freelancerDisputes.map((dispute) => dispute._id)).toEqual(
      expect.arrayContaining([microDisputeId, milestoneDisputeId]),
    );
    expect(unrelatedDisputes).toEqual([]);
    expect(parentDispute?._id).toBe(milestoneDisputeId);
    expect(escrowDispute?._id).toBe(microDisputeId);
    expect(underReview.map((dispute) => dispute.disputeId)).toEqual([microDisputeId]);
    expect(timeline.map((event) => event.message)).toEqual([
      expect.stringContaining("Client opened"),
      "Dispute status changed to under review.",
      "Middle event",
      "Later event",
    ]);
  });
});
