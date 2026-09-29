import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  countRecords,
  seedDisputeFixture,
  TEST_ADMIN_SECRET,
  TEST_WALLETS,
} from "../fixtures/disputes";

describe("dispute participant and administrator transitions", () => {
  it.each([
    {
      escrowStatus: "funded" as const,
      openedByRole: "client" as const,
      parentType: "micro_gig" as const,
    },
    {
      escrowStatus: "submitted" as const,
      openedByRole: "freelancer" as const,
      parentType: "milestone" as const,
    },
  ])(
    "lets the $openedByRole open a $parentType case",
    async ({ escrowStatus, openedByRole, parentType }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        escrowStatus,
        parentType,
        label: `${parentType}-${openedByRole}`,
      });
      const openedByWallet =
        openedByRole === "client" ? fixture.clientWallet : fixture.freelancerWallet;

      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        openedByWallet,
      });
      const disputeId = await t.mutation(api.disputes.createDispute, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        openedByWallet,
        openedByWalletType: "external_wallet",
        reasonCategory: "work_not_delivered",
        title: "Participant fixture dispute",
        description: "Participant fixture description.",
      });
      const dispute = await t.query(api.disputes.getDispute, {
        disputeId,
        viewerWallet: openedByWallet,
      });
      const timeline = await t.query(api.disputes.getDisputeTimeline, {
        disputeId,
        viewerWallet: openedByWallet,
      });

      expect(eligibility).toMatchObject({ allowed: true, openedByRole });
      expect(dispute).toMatchObject({
        _id: disputeId,
        parentType,
        parentId: fixture.parentId,
        jobId: fixture.jobId,
        escrowId: fixture.escrowId,
        clientWallet: TEST_WALLETS.client,
        freelancerWallet: TEST_WALLETS.freelancer,
        openedByWallet,
        openedByRole,
        status: "open",
        onChainStatus: "not_marked",
      });
      if (parentType === "micro_gig") {
        expect(dispute?.microGigId).toBe(fixture.jobId);
        expect(dispute?.milestoneId).toBeUndefined();
      } else {
        expect(dispute?.milestoneId).toBe(fixture.milestoneId);
        expect(dispute?.microGigId).toBeUndefined();
      }
      expect(timeline).toHaveLength(1);
      expect(timeline[0]).toMatchObject({
        type: "dispute_opened",
        actorWallet: openedByWallet,
        actorRole: openedByRole,
        newStatus: "open",
      });
    },
  );

  it("lets the configured administrator enter review and add moderator notes", async () => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", TEST_WALLETS.admin);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", TEST_ADMIN_SECRET);

    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "administrator" });
    const disputeId = await t.mutation(api.disputes.createDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.clientWallet,
      openedByWalletType: "external_wallet",
      reasonCategory: "payment_release_disagreement",
      title: "Administrator fixture dispute",
      description: "Administrator fixture description.",
    });

    await t.mutation(api.admin.changeDisputeReviewStatus, {
      adminWallet: fixture.adminWallet,
      adminApiSecret: TEST_ADMIN_SECRET,
      disputeId,
      status: "under_review",
      message: "Review started by the configured administrator.",
    });
    await t.mutation(api.admin.addModeratorNote, {
      adminWallet: fixture.adminWallet,
      adminApiSecret: TEST_ADMIN_SECRET,
      disputeId,
      message: "Moderator reviewed the submitted context.",
    });

    const dispute = await t.query(api.disputes.getDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const timeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });

    expect(dispute?.status).toBe("under_review");
    expect(timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "status_changed",
          actorWallet: fixture.adminWallet,
          actorRole: "moderator",
          oldStatus: "open",
          newStatus: "under_review",
        }),
        expect.objectContaining({
          type: "moderator_note_added",
          actorWallet: fixture.adminWallet,
          actorRole: "moderator",
          message: "Moderator reviewed the submitted context.",
        }),
      ]),
    );
  });
});

describe("dispute failure paths", () => {
  it("rejects unrelated participants without dispute or audit records", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "unrelated" });

    await expect(
      t.mutation(api.disputes.createDispute, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        openedByWallet: fixture.unrelatedWallet,
        openedByWalletType: "external_wallet",
        reasonCategory: "other",
        title: "Unauthorized dispute",
        description: "This should fail.",
      }),
    ).rejects.toThrow(/Only the client or assigned freelancer/);
    expect(await countRecords(t, "disputes")).toBe(0);
    expect(await countRecords(t, "disputeEvents")).toBe(0);
  });

  it("rejects a duplicate active dispute without adding another audit event", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "duplicate" });
    const args = {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.clientWallet,
      openedByWalletType: "external_wallet" as const,
      reasonCategory: "other" as const,
      title: "Duplicate dispute",
      description: "The second active dispute should fail.",
    };

    await t.mutation(api.disputes.createDispute, args);
    await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
      /already disputed|already has an active dispute/,
    );
    expect(await countRecords(t, "disputes")).toBe(1);
    expect(await countRecords(t, "disputeEvents")).toBe(1);
  });

  it.each([
    {
      label: "invalid wallet",
      adminWallet: TEST_WALLETS.unrelated,
      adminApiSecret: TEST_ADMIN_SECRET,
      expectedMessage: /configured platform wallet/,
    },
    {
      label: "missing secret",
      adminWallet: TEST_WALLETS.admin,
      adminApiSecret: "",
      expectedMessage: /Admin API secret is not configured/,
    },
    {
      label: "incorrect secret",
      adminWallet: TEST_WALLETS.admin,
      adminApiSecret: "wrong-c02-secret",
      expectedMessage: /Invalid admin API secret/,
    },
  ])(
    "rejects $label without creating dispute or audit records",
    async ({ adminWallet, adminApiSecret, expectedMessage }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `admin-failure-${adminWallet}` });
      const disputeId = await t.mutation(api.disputes.createDispute, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        openedByWallet: fixture.clientWallet,
        openedByWalletType: "external_wallet",
        reasonCategory: "other",
        title: "Admin failure fixture",
        description: "The admin operation should fail before writing an audit event.",
      });
      const disputesBefore = await countRecords(t, "disputes");
      const eventsBefore = await countRecords(t, "disputeEvents");

      vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", TEST_WALLETS.admin);
      vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", TEST_ADMIN_SECRET);
      if (adminApiSecret === "") {
        vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", "");
      }

      await expect(
        t.mutation(api.admin.changeDisputeReviewStatus, {
          adminWallet,
          adminApiSecret,
          disputeId,
          status: "under_review",
        }),
      ).rejects.toThrow(expectedMessage);

      expect(await countRecords(t, "disputes")).toBe(disputesBefore);
      expect(await countRecords(t, "disputeEvents")).toBe(eventsBefore);
    },
  );
});
