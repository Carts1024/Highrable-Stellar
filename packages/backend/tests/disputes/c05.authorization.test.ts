import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  countRecords,
  makeDisputeFields,
  seedDisputeFixture,
  type BackendTest,
  type DisputeFixture,
  TEST_WALLETS,
} from "../fixtures/disputes";

const CREATE_REASON = "work_not_delivered" as const;

async function createDispute(
  t: BackendTest,
  fixture: DisputeFixture,
  options: {
    openedByWallet?: string;
    parentId?: string;
    parentType?: "micro_gig" | "milestone" | "escrow" | "job";
    title?: string;
  } = {},
) {
  return await t.mutation(api.disputes.createDispute, {
    parentType: options.parentType ?? fixture.parentType,
    parentId: options.parentId ?? fixture.parentId,
    openedByWallet: options.openedByWallet ?? fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: CREATE_REASON,
    title: options.title ?? "C05 authorization dispute",
    description: "C05 authorization fixture dispute.",
  });
}

async function countSideEffects(t: BackendTest) {
  return await t.run(async (ctx) => ({
    attachments: (await ctx.db.query("attachments").take(100)).length,
    conversations: (await ctx.db.query("conversations").take(100)).length,
    disputeEvents: (await ctx.db.query("disputeEvents").take(100)).length,
    disputes: (await ctx.db.query("disputes").take(100)).length,
    messages: (await ctx.db.query("messages").take(100)).length,
    notifications: (await ctx.db.query("notifications").take(100)).length,
    workAgreementVersions: (await ctx.db.query("workAgreementVersions").take(100)).length,
    workAgreements: (await ctx.db.query("workAgreements").take(100)).length,
  }));
}

async function insertMilestoneProjectJob(t: BackendTest, label: string) {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("jobs", {
        title: `C05 ${label} job`,
        description: "C05 relationship fixture.",
        budget: 500,
        asset: "USDC",
        jobType: "milestone_project",
        totalBudget: 500,
        milestoneCount: 1,
        clientWallet: TEST_WALLETS.client,
        selectedFreelancerWallet: TEST_WALLETS.freelancer,
        status: "funded",
        jobHash: `c05-${label}`,
        createdAt: 1_768_480_800_000,
        updatedAt: 1_768_480_800_000,
      }),
  );
}

describe("C05 dispute authorization and creation invariants", () => {
  it.each([
    ["micro_gig", "funded", "client"],
    ["micro_gig", "funded", "freelancer"],
    ["micro_gig", "submitted", "client"],
    ["micro_gig", "submitted", "freelancer"],
    ["milestone", "funded", "client"],
    ["milestone", "funded", "freelancer"],
    ["milestone", "submitted", "client"],
    ["milestone", "submitted", "freelancer"],
  ] as const)(
    "allows the $2 of a $0 $1 escrow and persists backend-derived links and roles",
    async (parentType, escrowStatus, openedByRole) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        escrowStatus,
        label: `c05-${parentType}-${escrowStatus}-${openedByRole}`,
      });
      const openedByWallet =
        openedByRole === "client" ? fixture.clientWallet : fixture.freelancerWallet;

      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        openedByWallet,
      });
      const disputeId = await createDispute(t, fixture, { openedByWallet });
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
        parentType,
        parentId: fixture.parentId,
        jobId: fixture.jobId,
        escrowId: fixture.escrowId,
        clientWallet: fixture.clientWallet,
        freelancerWallet: fixture.freelancerWallet,
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
      expect(timeline[0]).toMatchObject({
        type: "dispute_opened",
        actorWallet: openedByWallet,
        actorRole: openedByRole,
      });
    },
  );

  it("supports explicit escrow parents, the job alias, and legacy jobs while preserving canonical output", async () => {
    const explicitEscrowTest = convexTest(schema, modules);
    const explicitEscrowFixture = await seedDisputeFixture(explicitEscrowTest, {
      label: "explicit-escrow",
    });
    const explicitEscrowDisputeId = await createDispute(explicitEscrowTest, explicitEscrowFixture, {
      parentType: "escrow",
      parentId: explicitEscrowFixture.escrowId,
    });
    const explicitEscrowDispute = await explicitEscrowTest.query(api.disputes.getDispute, {
      disputeId: explicitEscrowDisputeId,
      viewerWallet: explicitEscrowFixture.clientWallet,
    });
    expect(explicitEscrowDispute).toMatchObject({
      parentType: "escrow",
      parentId: explicitEscrowFixture.escrowId,
      microGigId: explicitEscrowFixture.jobId,
    });

    const aliasTest = convexTest(schema, modules);
    const aliasFixture = await seedDisputeFixture(aliasTest, { label: "job-alias" });
    const aliasDisputeId = await createDispute(aliasTest, aliasFixture, {
      parentType: "job",
      parentId: aliasFixture.jobId,
    });
    const aliasDispute = await aliasTest.query(api.disputes.getDispute, {
      disputeId: aliasDisputeId,
      viewerWallet: aliasFixture.clientWallet,
    });
    expect(aliasDispute).toMatchObject({
      parentType: "micro_gig",
      parentId: aliasFixture.jobId,
      microGigId: aliasFixture.jobId,
    });

    const projectEscrowTest = convexTest(schema, modules);
    const projectEscrowFixture = await seedDisputeFixture(projectEscrowTest, {
      parentType: "milestone",
      label: "project-explicit-escrow",
    });
    const projectEscrowDisputeId = await createDispute(projectEscrowTest, projectEscrowFixture, {
      parentType: "escrow",
      parentId: projectEscrowFixture.escrowId,
    });
    const projectEscrowDispute = await projectEscrowTest.query(api.disputes.getDispute, {
      disputeId: projectEscrowDisputeId,
      viewerWallet: projectEscrowFixture.clientWallet,
    });
    expect(projectEscrowDispute).toMatchObject({
      parentType: "milestone",
      parentId: projectEscrowFixture.milestoneId,
      milestoneId: projectEscrowFixture.milestoneId,
    });

    const legacyTest = convexTest(schema, modules);
    const legacyFixture = await seedDisputeFixture(legacyTest, { label: "legacy-job" });
    await legacyTest.run(async (ctx) => ctx.db.patch(legacyFixture.jobId, { jobType: undefined }));
    const legacyDisputeId = await createDispute(legacyTest, legacyFixture, {
      parentType: "job",
      parentId: legacyFixture.jobId,
    });
    const legacyDispute = await legacyTest.query(api.disputes.getDispute, {
      disputeId: legacyDisputeId,
      viewerWallet: legacyFixture.clientWallet,
    });
    expect(legacyDispute?.parentType).toBe("micro_gig");
  });

  it.each(["micro_gig", "job"] as const)(
    "rejects project-level %s requests with a milestone-selection instruction",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: "milestone",
        label: `project-level-${parentType}`,
      });

      const args = {
        parentType,
        parentId: fixture.jobId,
        openedByWallet: fixture.clientWallet,
        openedByWalletType: "external_wallet" as const,
        reasonCategory: CREATE_REASON,
        title: "Project-level dispute",
        description: "A milestone must be selected.",
      };
      const before = await countSideEffects(t);
      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType,
        parentId: fixture.jobId,
        openedByWallet: fixture.clientWallet,
      });

      expect(eligibility).toMatchObject({
        allowed: false,
        reason: expect.stringContaining("specific milestone or escrow"),
      });
      await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
        /specific milestone or escrow/,
      );
      expect(await countSideEffects(t)).toEqual(before);
    },
  );

  it("normalizes supplied and stored participant wallets and derives roles from records", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "wallet-normalization" });
    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.jobId, {
        clientWallet: fixture.clientWallet.toLowerCase(),
        selectedFreelancerWallet: fixture.freelancerWallet.toLowerCase(),
      });
      await ctx.db.patch(fixture.escrowId, {
        clientWallet: fixture.clientWallet.toLowerCase(),
        freelancerWallet: fixture.freelancerWallet.toLowerCase(),
      });
    });

    const disputeId = await createDispute(t, fixture, {
      openedByWallet: fixture.freelancerWallet.toLowerCase(),
    });
    const dispute = await t.query(api.disputes.getDispute, {
      disputeId,
      viewerWallet: fixture.freelancerWallet.toLowerCase(),
    });
    expect(dispute).toMatchObject({
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
      openedByWallet: fixture.freelancerWallet,
      openedByRole: "freelancer",
    });
  });
});

describe("C05 parent graph validation", () => {
  it.each([
    {
      label: "missing parent job",
      parentType: "micro_gig" as const,
      setup: async (t: BackendTest, fixture: DisputeFixture) => {
        await t.run(async (ctx) => ctx.db.delete(fixture.jobId));
        return { parentId: fixture.jobId };
      },
      expected: /Parent job not found/,
    },
    {
      label: "malformed parent ID",
      parentType: "micro_gig" as const,
      setup: async (_t: BackendTest, _fixture: DisputeFixture) => ({ parentId: "not-a-convex-id" }),
      expected: /valid job ID/,
    },
    {
      label: "wrong-table parent ID",
      parentType: "micro_gig" as const,
      setup: async (_t: BackendTest, fixture: DisputeFixture) => ({
        parentId: fixture.escrowId,
      }),
      expected: /valid job ID/,
    },
  ])("rejects $label before creating records", async ({ parentType, setup, expected }) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: `parent-${expected.source}` });
    const { parentId } = await setup(t, fixture);
    const before = await countSideEffects(t);

    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType,
      parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility).toMatchObject({ allowed: false, reason: expect.stringMatching(expected) });
    await expect(createDispute(t, fixture, { parentType, parentId })).rejects.toThrow(expected);
    expect(await countSideEffects(t)).toEqual(before);
  });

  it("rejects missing, malformed, and wrong-table milestone parents", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "milestone-ids",
    });

    await t.run(async (ctx) => ctx.db.delete(fixture.milestoneId!));
    await expect(
      createDispute(t, fixture, { parentType: "milestone", parentId: fixture.milestoneId! }),
    ).rejects.toThrow(/Milestone not found/);

    await expect(
      createDispute(t, fixture, { parentType: "milestone", parentId: "not-a-convex-id" }),
    ).rejects.toThrow(/valid milestone ID/);
    await expect(
      createDispute(t, fixture, { parentType: "milestone", parentId: fixture.jobId }),
    ).rejects.toThrow(/valid milestone ID/);

    const missingEscrowTest = convexTest(schema, modules);
    const missingEscrowFixture = await seedDisputeFixture(missingEscrowTest, {
      label: "missing-escrow",
    });
    await missingEscrowTest.run(async (ctx) => ctx.db.delete(missingEscrowFixture.escrowId));
    await expect(createDispute(missingEscrowTest, missingEscrowFixture)).rejects.toThrow(
      /Active escrow not found/,
    );
  });

  it.each([
    ["client ownership", "client"],
    ["micro-gig assignment", "micro-assignment"],
  ] as const)("rejects conflicting %s", async (_label, conflict) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: `conflict-${conflict}` });
    await t.run(async (ctx) => {
      if (conflict === "client") {
        await ctx.db.patch(fixture.escrowId, { clientWallet: fixture.unrelatedWallet });
      } else {
        await ctx.db.patch(fixture.escrowId, { freelancerWallet: fixture.unrelatedWallet });
      }
    });

    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility.allowed).toBe(false);
    await expect(createDispute(t, fixture)).rejects.toThrow(
      conflict === "client" ? /parent job owner/ : /assigned freelancer/,
    );
  });

  it("rejects milestone assignment conflicts, broken links, and on-chain escrow references", async () => {
    const assignmentTest = convexTest(schema, modules);
    const assignmentFixture = await seedDisputeFixture(assignmentTest, {
      parentType: "milestone",
      label: "milestone-assignment",
    });
    await assignmentTest.run(async (ctx) =>
      ctx.db.patch(assignmentFixture.milestoneId!, {
        assignedFreelancerWallet: assignmentFixture.unrelatedWallet,
      }),
    );
    await expect(createDispute(assignmentTest, assignmentFixture)).rejects.toThrow(
      /assigned freelancer/,
    );

    const unassignedTest = convexTest(schema, modules);
    const unassignedFixture = await seedDisputeFixture(unassignedTest, {
      parentType: "milestone",
      label: "milestone-unassigned",
    });
    await unassignedTest.run(async (ctx) =>
      ctx.db.patch(unassignedFixture.milestoneId!, { assignedFreelancerWallet: undefined }),
    );
    await expect(createDispute(unassignedTest, unassignedFixture)).rejects.toThrow(
      /assigned escrow work/,
    );

    const linkTest = convexTest(schema, modules);
    const linkFixture = await seedDisputeFixture(linkTest, {
      parentType: "milestone",
      label: "milestone-link",
    });
    const otherJobId = await insertMilestoneProjectJob(linkTest, "broken-link");
    await linkTest.run(async (ctx) => ctx.db.patch(linkFixture.escrowId, { jobId: otherJobId }));
    await expect(createDispute(linkTest, linkFixture)).rejects.toThrow(
      /not linked to its parent job/,
    );

    const referenceTest = convexTest(schema, modules);
    const referenceFixture = await seedDisputeFixture(referenceTest, {
      parentType: "milestone",
      label: "milestone-reference",
    });
    await referenceTest.run(async (ctx) =>
      ctx.db.patch(referenceFixture.milestoneId!, { escrowId: "different-on-chain-escrow" }),
    );
    await expect(createDispute(referenceTest, referenceFixture)).rejects.toThrow(
      /escrow reference does not match/,
    );
  });

  it.each(["micro_gig", "milestone"] as const)(
    "rejects ambiguous %s escrow matches",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `ambiguous-${parentType}`,
      });
      await t.run(async (ctx) =>
        ctx.db.insert("escrows", {
          jobId: fixture.jobId,
          ...(fixture.milestoneId !== undefined ? { milestoneId: fixture.milestoneId } : {}),
          escrowId: `duplicate-${parentType}`,
          clientWallet: fixture.clientWallet,
          freelancerWallet: fixture.freelancerWallet,
          amount: 500,
          asset: "USDC",
          status: "funded",
          createdAt: 1_768_480_800_100,
          updatedAt: 1_768_480_800_100,
        }),
      );

      await expect(createDispute(t, fixture)).rejects.toThrow(/Multiple escrows match/);
    },
  );
});

describe("C05 eligibility and rollback invariants", () => {
  it("allows only assigned escrows and every query result agrees with mutation eligibility", async () => {
    for (const status of ["created", "released", "cancelled", "disputed"] as const) {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `ineligible-${status}` });
      await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { status }));

      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        openedByWallet: fixture.clientWallet,
      });
      expect(eligibility.allowed).toBe(false);
      const expectedMessage =
        status === "released"
          ? /already been released/
          : status === "cancelled"
            ? /already been cancelled/
            : /funded or submitted status/;
      await expect(createDispute(t, fixture)).rejects.toThrow(expectedMessage);
      expect(await countRecords(t, "disputes")).toBe(0);
    }

    for (const escrowStatus of ["funded", "submitted"] as const) {
      for (const parentType of ["micro_gig", "milestone"] as const) {
        const t = convexTest(schema, modules);
        const fixture = await seedDisputeFixture(t, {
          escrowStatus,
          parentType,
          label: `unassigned-${parentType}-${escrowStatus}`,
        });
        await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { freelancerWallet: undefined }));
        const eligibility = await t.query(api.disputes.canOpenDispute, {
          parentType: fixture.parentType,
          parentId: fixture.parentId,
          openedByWallet: fixture.clientWallet,
        });
        expect(eligibility).toMatchObject({
          allowed: false,
          reason: expect.stringContaining("assigned escrow work"),
        });
        await expect(createDispute(t, fixture)).rejects.toThrow(/assigned escrow work/);
      }
    }
  });

  it("finds an active dispute after more than 50 historical closed disputes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "history-over-50" });
    await t.run(async (ctx) => {
      for (let index = 0; index < 51; index += 1) {
        await ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, {
            disputeNumber: `DSP-C05-CLOSED-${index}`,
            status: "cancelled",
          }),
        );
      }
    });

    const disputeId = await createDispute(t, fixture);
    expect(disputeId).toBeDefined();
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.freelancerWallet,
    });
    expect(eligibility.allowed).toBe(false);
    await expect(
      createDispute(t, fixture, {
        openedByWallet: fixture.freelancerWallet,
        title: "Duplicate after closed history",
      }),
    ).rejects.toThrow(/already disputed|already has an active dispute/);
  });

  it("rejects unrelated wallets and administrators who are not participants", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "nonparticipant-admin" });

    await expect(
      createDispute(t, fixture, { openedByWallet: fixture.unrelatedWallet }),
    ).rejects.toThrow(/Only the client or assigned freelancer/);
    await expect(
      createDispute(t, fixture, { openedByWallet: fixture.adminWallet }),
    ).rejects.toThrow(/Only the client or assigned freelancer/);
    expect(await countSideEffects(t)).toEqual({
      attachments: 0,
      conversations: 0,
      disputeEvents: 0,
      disputes: 0,
      messages: 0,
      notifications: 0,
      workAgreementVersions: 0,
      workAgreements: 0,
    });
  });

  it("leaves dispute, event, notification, and related records unchanged after duplicate rejection", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "duplicate-rollback" });
    await createDispute(t, fixture);
    const before = await countSideEffects(t);

    await expect(createDispute(t, fixture, { title: "Rejected duplicate" })).rejects.toThrow(
      /already disputed|already has an active dispute/,
    );
    expect(await countSideEffects(t)).toEqual(before);
  });
});

describe("C05 admin review configuration guard", () => {
  it("keeps admin review behind the configured wallet and secret", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "admin-credentials" });
    const disputeId = await createDispute(t, fixture);

    await expect(
      t.mutation(api.admin.changeDisputeReviewStatus, {
        adminWallet: fixture.adminWallet,
        adminApiSecret: "missing-config",
        disputeId,
        status: "under_review",
      }),
    ).rejects.toThrow(/configured platform wallet|Admin API secret is not configured/);
  });
});
