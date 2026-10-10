import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  makeDisputeFields,
  seedAcceptedDisputeAgreement,
  seedDisputeReferences,
  seedDisputeFixture,
  type BackendTest,
  type DisputeFixture,
  type DisputeReferenceFixture,
  TEST_WALLETS,
} from "../fixtures/disputes";

const CREATE_REASON = "work_not_delivered" as const;

type CreationEntry = {
  label: string;
  fixtureParentType: "micro_gig" | "milestone";
  parentType: "micro_gig" | "milestone" | "escrow" | "job";
  canonicalParentType: "micro_gig" | "milestone" | "escrow";
};

const CREATION_ENTRIES: readonly CreationEntry[] = [
  {
    label: "micro-gig",
    fixtureParentType: "micro_gig",
    parentType: "micro_gig",
    canonicalParentType: "micro_gig",
  },
  {
    label: "job alias",
    fixtureParentType: "micro_gig",
    parentType: "job",
    canonicalParentType: "micro_gig",
  },
  {
    label: "explicit micro-gig escrow",
    fixtureParentType: "micro_gig",
    parentType: "escrow",
    canonicalParentType: "escrow",
  },
  {
    label: "milestone",
    fixtureParentType: "milestone",
    parentType: "milestone",
    canonicalParentType: "milestone",
  },
  {
    label: "explicit milestone escrow",
    fixtureParentType: "milestone",
    parentType: "escrow",
    canonicalParentType: "milestone",
  },
];

const ACTIVE_DISPUTE_STATUSES = [
  "open",
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
] as const;

type CreateDisputeOptions = {
  openedByWallet?: string;
  parentId?: string;
  parentType?: "micro_gig" | "milestone" | "escrow" | "job";
  title?: string;
  evidenceAttachmentIds?: Id<"attachments">[];
  relatedWorkSubmissionIds?: Id<"workSubmissions">[];
  relatedRevisionRequestIds?: Id<"revisionRequests">[];
  relatedMessageIds?: Id<"messages">[];
  relatedDeadlineEventIds?: Id<"deadlineAuditEvents">[];
};

function getCreationParentId(fixture: DisputeFixture, entry: CreationEntry): string {
  if (entry.parentType === "escrow") return fixture.escrowId;
  if (entry.parentType === "milestone") return fixture.milestoneId!;
  return fixture.jobId;
}

function getCreationArgs(fixture: DisputeFixture, options: CreateDisputeOptions = {}) {
  return {
    parentType: options.parentType ?? fixture.parentType,
    parentId: options.parentId ?? fixture.parentId,
    openedByWallet: options.openedByWallet ?? fixture.clientWallet,
    openedByWalletType: "external_wallet" as const,
    reasonCategory: CREATE_REASON,
    title: options.title ?? "C05 authorization dispute",
    description: "C05 authorization fixture dispute.",
    ...(options.evidenceAttachmentIds !== undefined
      ? { evidenceAttachmentIds: options.evidenceAttachmentIds }
      : {}),
    ...(options.relatedWorkSubmissionIds !== undefined
      ? { relatedWorkSubmissionIds: options.relatedWorkSubmissionIds }
      : {}),
    ...(options.relatedRevisionRequestIds !== undefined
      ? { relatedRevisionRequestIds: options.relatedRevisionRequestIds }
      : {}),
    ...(options.relatedMessageIds !== undefined
      ? { relatedMessageIds: options.relatedMessageIds }
      : {}),
    ...(options.relatedDeadlineEventIds !== undefined
      ? { relatedDeadlineEventIds: options.relatedDeadlineEventIds }
      : {}),
  };
}

async function seedRejectedCreationContext(
  t: BackendTest,
  fixture: DisputeFixture,
): Promise<DisputeReferenceFixture> {
  await seedAcceptedDisputeAgreement(t, fixture);
  return await seedDisputeReferences(t, fixture);
}

async function snapshotCreationDocuments(t: BackendTest) {
  return await t.run(async (ctx) => ({
    attachments: await ctx.db.query("attachments").collect(),
    conversations: await ctx.db.query("conversations").collect(),
    disputes: await ctx.db.query("disputes").collect(),
    disputeEvents: await ctx.db.query("disputeEvents").collect(),
    escrows: await ctx.db.query("escrows").collect(),
    jobs: await ctx.db.query("jobs").collect(),
    messages: await ctx.db.query("messages").collect(),
    milestones: await ctx.db.query("milestones").collect(),
    notifications: await ctx.db.query("notifications").collect(),
    workAgreementEvents: await ctx.db.query("workAgreementEvents").collect(),
    workAgreementVersions: await ctx.db.query("workAgreementVersions").collect(),
    workAgreements: await ctx.db.query("workAgreements").collect(),
  }));
}

function withReferenceArgs(
  fixture: DisputeFixture,
  references: DisputeReferenceFixture,
  entry: CreationEntry,
  openedByWallet: string,
) {
  return getCreationArgs(fixture, {
    parentType: entry.parentType,
    parentId: getCreationParentId(fixture, entry),
    openedByWallet,
    evidenceAttachmentIds: [references.attachmentId],
    relatedWorkSubmissionIds: [references.submissionId],
    relatedRevisionRequestIds: [references.revisionRequestId],
    relatedMessageIds: [references.messageId],
    relatedDeadlineEventIds: [references.deadlineEventId],
  });
}

async function createDispute(
  t: BackendTest,
  fixture: DisputeFixture,
  options: CreateDisputeOptions = {},
) {
  return await t.mutation(api.disputes.createDispute, getCreationArgs(fixture, options));
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

  const acceptedMatrix = CREATION_ENTRIES.flatMap((entry) =>
    (["funded", "submitted"] as const).flatMap((escrowStatus) =>
      (["client", "freelancer"] as const).map(
        (openedByRole) => [entry, escrowStatus, openedByRole] as const,
      ),
    ),
  );

  it.each(acceptedMatrix)(
    "agrees on eligibility and creation for $0.label $1 $2 opening",
    async (entry, escrowStatus, openedByRole) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: entry.fixtureParentType,
        escrowStatus,
        label: `matrix-${entry.label}-${escrowStatus}-${openedByRole}`,
      });
      const openedByWallet =
        openedByRole === "client" ? fixture.clientWallet : fixture.freelancerWallet;
      const parentType = entry.parentType;
      const parentId = getCreationParentId(fixture, entry);

      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType,
        parentId,
        openedByWallet,
      });
      expect(eligibility).toMatchObject({
        allowed: true,
        openedByRole,
        escrowId: fixture.escrowId,
      });

      const disputeId = await createDispute(t, fixture, {
        parentType,
        parentId,
        openedByWallet,
      });
      const dispute = await t.query(api.disputes.getDispute, {
        disputeId,
        viewerWallet: openedByWallet,
      });
      const events = await t.run(
        async (ctx) =>
          await ctx.db
            .query("disputeEvents")
            .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
            .collect(),
      );

      const expectedParentId =
        entry.canonicalParentType === "escrow"
          ? fixture.escrowId
          : entry.fixtureParentType === "milestone"
            ? fixture.milestoneId
            : fixture.jobId;
      expect(dispute).toMatchObject({
        parentType: entry.canonicalParentType,
        parentId: expectedParentId,
        jobId: fixture.jobId,
        escrowId: fixture.escrowId,
        onChainEscrowId: `escrow-matrix-${entry.label}-${escrowStatus}-${openedByRole}`,
        clientWallet: fixture.clientWallet,
        freelancerWallet: fixture.freelancerWallet,
        openedByWallet,
        openedByRole,
        status: "open",
        onChainStatus: "not_marked",
      });
      if (entry.fixtureParentType === "milestone") {
        expect(dispute?.milestoneId).toBe(fixture.milestoneId);
        expect(dispute?.microGigId).toBeUndefined();
      } else {
        expect(dispute?.microGigId).toBe(fixture.jobId);
        expect(dispute?.milestoneId).toBeUndefined();
      }
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "dispute_opened",
        actorWallet: openedByWallet,
        actorRole: openedByRole,
        newStatus: "open",
      });
    },
  );

  it.each(CREATION_ENTRIES.filter((entry) => entry.fixtureParentType === "micro_gig"))(
    "preserves legacy micro-gig creation through the $label path without jobType",
    async (entry) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: "micro_gig",
        label: `legacy-${entry.label}`,
      });
      await t.run(async (ctx) => ctx.db.patch(fixture.jobId, { jobType: undefined }));
      const parentId = getCreationParentId(fixture, entry);
      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: entry.parentType,
        parentId,
        openedByWallet: fixture.clientWallet,
      });
      expect(eligibility.allowed).toBe(true);
      const disputeId = await createDispute(t, fixture, {
        parentType: entry.parentType,
        parentId,
      });
      const dispute = await t.query(api.disputes.getDispute, {
        disputeId,
        viewerWallet: fixture.clientWallet,
      });
      expect(dispute).toMatchObject({
        parentType: entry.canonicalParentType,
        jobId: fixture.jobId,
        microGigId: fixture.jobId,
        escrowId: fixture.escrowId,
      });
    },
  );

  it.each(CREATION_ENTRIES)(
    "rejects an unrelated wallet and a configured nonparticipant administrator on the $label path",
    async (entry) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: entry.fixtureParentType,
        label: `nonparticipant-${entry.label}`,
      });
      const references = await seedRejectedCreationContext(t, fixture);
      vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", fixture.adminWallet);
      await t.run(async (ctx) => {
        const admin = await ctx.db
          .query("users")
          .withIndex("by_walletAddress", (q) => q.eq("walletAddress", fixture.adminWallet))
          .unique();
        const unrelated = await ctx.db
          .query("users")
          .withIndex("by_walletAddress", (q) => q.eq("walletAddress", fixture.unrelatedWallet))
          .unique();
        if (!admin || !unrelated) throw new Error("C05 user fixture missing.");
        await ctx.db.patch(admin._id, { role: "client" });
        await ctx.db.patch(unrelated._id, { role: "admin" });
      });
      const before = await snapshotCreationDocuments(t);

      for (const openedByWallet of [fixture.unrelatedWallet, fixture.adminWallet]) {
        const eligibility = await t.query(api.disputes.canOpenDispute, {
          parentType: entry.parentType,
          parentId: getCreationParentId(fixture, entry),
          openedByWallet,
        });
        expect(eligibility).toMatchObject({ allowed: false, openedByRole: null });
        await expect(
          t.mutation(
            api.disputes.createDispute,
            withReferenceArgs(fixture, references, entry, openedByWallet),
          ),
        ).rejects.toThrow(/Only the client or assigned freelancer/);
      }

      expect(await snapshotCreationDocuments(t)).toEqual(before);
    },
  );

  it.each(
    CREATION_ENTRIES.flatMap((entry) =>
      (["funded", "submitted"] as const).map((escrowStatus) => [entry, escrowStatus] as const),
    ),
  )(
    "rejects unassigned $1 work on the $0.label path before any write",
    async (entry, escrowStatus) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: entry.fixtureParentType,
        escrowStatus,
        label: `unassigned-${entry.label}-${escrowStatus}`,
      });
      const references = await seedRejectedCreationContext(t, fixture);
      await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { freelancerWallet: undefined }));
      const before = await snapshotCreationDocuments(t);
      const args = withReferenceArgs(fixture, references, entry, fixture.clientWallet);
      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: args.parentType,
        parentId: args.parentId,
        openedByWallet: fixture.clientWallet,
      });
      expect(eligibility).toMatchObject({
        allowed: false,
        reason: expect.stringContaining("assigned escrow work"),
      });
      await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
        /assigned escrow work/,
      );
      expect(await snapshotCreationDocuments(t)).toEqual(before);
    },
  );

  it.each(
    CREATION_ENTRIES.flatMap((entry) =>
      (["created", "released", "cancelled", "disputed"] as const).map(
        (escrowStatus) => [entry, escrowStatus] as const,
      ),
    ),
  )(
    "rejects $1 escrows through the $0.label path with query/mutation agreement",
    async (entry, escrowStatus) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: entry.fixtureParentType,
        label: `status-${entry.label}-${escrowStatus}`,
      });
      const references = await seedRejectedCreationContext(t, fixture);
      await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { status: escrowStatus }));
      const before = await snapshotCreationDocuments(t);
      const args = withReferenceArgs(fixture, references, entry, fixture.clientWallet);
      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: args.parentType,
        parentId: args.parentId,
        openedByWallet: fixture.clientWallet,
      });
      const expectedMessage =
        escrowStatus === "released"
          ? /already been released/
          : escrowStatus === "cancelled"
            ? /already been cancelled/
            : /funded or submitted status/;
      expect(eligibility).toMatchObject({ allowed: false });
      await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(expectedMessage);
      expect(await snapshotCreationDocuments(t)).toEqual(before);
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
      const references = await seedRejectedCreationContext(t, fixture);

      const args = getCreationArgs(fixture, {
        parentType,
        parentId: fixture.jobId,
        title: "Project-level dispute",
        evidenceAttachmentIds: [references.attachmentId],
        relatedWorkSubmissionIds: [references.submissionId],
        relatedRevisionRequestIds: [references.revisionRequestId],
        relatedMessageIds: [references.messageId],
        relatedDeadlineEventIds: [references.deadlineEventId],
      });
      const before = await snapshotCreationDocuments(t);
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
      expect(await snapshotCreationDocuments(t)).toEqual(before);
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
    const references = await seedRejectedCreationContext(t, fixture);
    const { parentId } = await setup(t, fixture);
    const before = await snapshotCreationDocuments(t);

    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType,
      parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility).toMatchObject({ allowed: false, reason: expect.stringMatching(expected) });
    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          parentType,
          parentId,
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(expected);
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it("rejects missing, malformed, and wrong-table milestone parents", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "milestone-ids",
    });
    const references = await seedRejectedCreationContext(t, fixture);

    await t.run(async (ctx) => ctx.db.delete(fixture.milestoneId!));
    const missingBefore = await snapshotCreationDocuments(t);
    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          parentType: "milestone",
          parentId: fixture.milestoneId!,
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(/Milestone not found/);
    expect(await snapshotCreationDocuments(t)).toEqual(missingBefore);

    const malformedBefore = await snapshotCreationDocuments(t);
    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          parentType: "milestone",
          parentId: "not-a-convex-id",
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(/valid milestone ID/);
    expect(await snapshotCreationDocuments(t)).toEqual(malformedBefore);

    const wrongTableBefore = await snapshotCreationDocuments(t);
    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          parentType: "milestone",
          parentId: fixture.jobId,
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(/valid milestone ID/);
    expect(await snapshotCreationDocuments(t)).toEqual(wrongTableBefore);

    const missingEscrowTest = convexTest(schema, modules);
    const missingEscrowFixture = await seedDisputeFixture(missingEscrowTest, {
      label: "missing-escrow",
    });
    const missingEscrowReferences = await seedRejectedCreationContext(
      missingEscrowTest,
      missingEscrowFixture,
    );
    await missingEscrowTest.run(async (ctx) => ctx.db.delete(missingEscrowFixture.escrowId));
    const missingEscrowBefore = await snapshotCreationDocuments(missingEscrowTest);
    await expect(
      missingEscrowTest.mutation(
        api.disputes.createDispute,
        getCreationArgs(missingEscrowFixture, {
          evidenceAttachmentIds: [missingEscrowReferences.attachmentId],
          relatedWorkSubmissionIds: [missingEscrowReferences.submissionId],
          relatedRevisionRequestIds: [missingEscrowReferences.revisionRequestId],
          relatedMessageIds: [missingEscrowReferences.messageId],
          relatedDeadlineEventIds: [missingEscrowReferences.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(/Active escrow not found/);
    expect(await snapshotCreationDocuments(missingEscrowTest)).toEqual(missingEscrowBefore);
  });

  it.each([
    ["client ownership", "client"],
    ["micro-gig assignment", "micro-assignment"],
  ] as const)("rejects conflicting %s", async (_label, conflict) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: `conflict-${conflict}` });
    const references = await seedRejectedCreationContext(t, fixture);
    await t.run(async (ctx) => {
      if (conflict === "client") {
        await ctx.db.patch(fixture.escrowId, { clientWallet: fixture.unrelatedWallet });
      } else {
        await ctx.db.patch(fixture.escrowId, { freelancerWallet: fixture.unrelatedWallet });
      }
    });
    const before = await snapshotCreationDocuments(t);

    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility.allowed).toBe(false);
    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(conflict === "client" ? /parent job owner/ : /assigned freelancer/);
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it("rejects milestone assignment conflicts, broken links, and on-chain escrow references", async () => {
    const assignmentTest = convexTest(schema, modules);
    const assignmentFixture = await seedDisputeFixture(assignmentTest, {
      parentType: "milestone",
      label: "milestone-assignment",
    });
    const assignmentReferences = await seedRejectedCreationContext(
      assignmentTest,
      assignmentFixture,
    );
    await assignmentTest.run(async (ctx) =>
      ctx.db.patch(assignmentFixture.milestoneId!, {
        assignedFreelancerWallet: assignmentFixture.unrelatedWallet,
      }),
    );
    const assignmentBefore = await snapshotCreationDocuments(assignmentTest);
    await expect(
      assignmentTest.mutation(
        api.disputes.createDispute,
        withReferenceArgs(
          assignmentFixture,
          assignmentReferences,
          CREATION_ENTRIES.find((entry) => entry.label === "milestone")!,
          assignmentFixture.clientWallet,
        ),
      ),
    ).rejects.toThrow(/assigned freelancer/);
    expect(await snapshotCreationDocuments(assignmentTest)).toEqual(assignmentBefore);

    const unassignedTest = convexTest(schema, modules);
    const unassignedFixture = await seedDisputeFixture(unassignedTest, {
      parentType: "milestone",
      label: "milestone-unassigned",
    });
    const unassignedReferences = await seedRejectedCreationContext(
      unassignedTest,
      unassignedFixture,
    );
    await unassignedTest.run(async (ctx) =>
      ctx.db.patch(unassignedFixture.milestoneId!, { assignedFreelancerWallet: undefined }),
    );
    const unassignedBefore = await snapshotCreationDocuments(unassignedTest);
    await expect(
      unassignedTest.mutation(
        api.disputes.createDispute,
        withReferenceArgs(
          unassignedFixture,
          unassignedReferences,
          CREATION_ENTRIES.find((entry) => entry.label === "milestone")!,
          unassignedFixture.clientWallet,
        ),
      ),
    ).rejects.toThrow(/assigned escrow work/);
    expect(await snapshotCreationDocuments(unassignedTest)).toEqual(unassignedBefore);

    const linkTest = convexTest(schema, modules);
    const linkFixture = await seedDisputeFixture(linkTest, {
      parentType: "milestone",
      label: "milestone-link",
    });
    const linkReferences = await seedRejectedCreationContext(linkTest, linkFixture);
    const otherJobId = await insertMilestoneProjectJob(linkTest, "broken-link");
    await linkTest.run(async (ctx) => ctx.db.patch(linkFixture.escrowId, { jobId: otherJobId }));
    const linkBefore = await snapshotCreationDocuments(linkTest);
    await expect(
      linkTest.mutation(
        api.disputes.createDispute,
        withReferenceArgs(
          linkFixture,
          linkReferences,
          CREATION_ENTRIES.find((entry) => entry.label === "milestone")!,
          linkFixture.clientWallet,
        ),
      ),
    ).rejects.toThrow(/not linked to its parent job/);
    expect(await snapshotCreationDocuments(linkTest)).toEqual(linkBefore);

    const referenceTest = convexTest(schema, modules);
    const referenceFixture = await seedDisputeFixture(referenceTest, {
      parentType: "milestone",
      label: "milestone-reference",
    });
    const referenceReferences = await seedRejectedCreationContext(referenceTest, referenceFixture);
    await referenceTest.run(async (ctx) =>
      ctx.db.patch(referenceFixture.milestoneId!, { escrowId: "different-on-chain-escrow" }),
    );
    const referenceBefore = await snapshotCreationDocuments(referenceTest);
    await expect(
      referenceTest.mutation(
        api.disputes.createDispute,
        withReferenceArgs(
          referenceFixture,
          referenceReferences,
          CREATION_ENTRIES.find((entry) => entry.label === "milestone")!,
          referenceFixture.clientWallet,
        ),
      ),
    ).rejects.toThrow(/escrow reference does not match/);
    expect(await snapshotCreationDocuments(referenceTest)).toEqual(referenceBefore);
  });

  it("rejects a milestone assignment mismatch through the explicit milestone escrow path", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "explicit-milestone-assignment",
    });
    const references = await seedRejectedCreationContext(t, fixture);
    await t.run(async (ctx) =>
      ctx.db.patch(fixture.milestoneId!, {
        assignedFreelancerWallet: fixture.unrelatedWallet,
      }),
    );
    const before = await snapshotCreationDocuments(t);
    const entry = CREATION_ENTRIES.find((item) => item.label === "explicit milestone escrow")!;
    const args = withReferenceArgs(fixture, references, entry, fixture.clientWallet);
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: args.parentType,
      parentId: args.parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("assigned freelancer"),
    });
    await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
      /assigned freelancer/,
    );
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it.each(["micro_gig", "milestone"] as const)(
    "rejects ambiguous %s escrow matches",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `ambiguous-${parentType}`,
      });
      const references = await seedRejectedCreationContext(t, fixture);
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

      const before = await snapshotCreationDocuments(t);
      const ambiguousEntry =
        parentType === "micro_gig"
          ? CREATION_ENTRIES.find((entry) => entry.parentType === "micro_gig")!
          : CREATION_ENTRIES.find((entry) => entry.parentType === "milestone")!;
      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: ambiguousEntry.parentType,
        parentId: getCreationParentId(fixture, ambiguousEntry),
        openedByWallet: fixture.clientWallet,
      });
      expect(eligibility).toMatchObject({
        allowed: false,
        reason: expect.stringContaining("Multiple escrows match"),
      });
      await expect(
        t.mutation(
          api.disputes.createDispute,
          withReferenceArgs(fixture, references, ambiguousEntry, fixture.clientWallet),
        ),
      ).rejects.toThrow(/Multiple escrows match/);
      expect(await snapshotCreationDocuments(t)).toEqual(before);

      const explicitEntry = CREATION_ENTRIES.find(
        (entry) =>
          entry.fixtureParentType === parentType &&
          entry.parentType === "escrow" &&
          entry.canonicalParentType === (parentType === "micro_gig" ? "escrow" : "milestone"),
      )!;
      const explicitEligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: "escrow",
        parentId: fixture.escrowId,
        openedByWallet: fixture.clientWallet,
      });
      expect(explicitEligibility.allowed).toBe(true);
      const explicitDisputeId = await t.mutation(
        api.disputes.createDispute,
        withReferenceArgs(fixture, references, explicitEntry, fixture.clientWallet),
      );
      const explicitDispute = await t.query(api.disputes.getDispute, {
        disputeId: explicitDisputeId,
        viewerWallet: fixture.clientWallet,
      });
      expect(explicitDispute).toMatchObject({
        parentType: explicitEntry.canonicalParentType,
        escrowId: fixture.escrowId,
        jobId: fixture.jobId,
        ...(parentType === "milestone" ? { milestoneId: fixture.milestoneId } : {}),
      });
    },
  );

  it.each([
    ["missing explicit escrow", "missing"],
    ["malformed explicit escrow", "malformed"],
    ["wrong-table explicit escrow", "wrong-table"],
  ] as const)("rejects a $0 parent before any write", async (_label, kind) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: `explicit-parent-${kind}` });
    const references = await seedRejectedCreationContext(t, fixture);
    let parentId: string = fixture.escrowId;
    if (kind === "missing") {
      await t.run(async (ctx) => ctx.db.delete(fixture.escrowId));
    } else if (kind === "malformed") {
      parentId = "not-a-convex-id";
    } else {
      parentId = fixture.jobId;
    }
    const before = await snapshotCreationDocuments(t);
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: "escrow",
      parentId,
      openedByWallet: fixture.clientWallet,
    });
    const expected = kind === "missing" ? /Escrow not found/ : /valid escrow ID/;
    expect(eligibility).toMatchObject({ allowed: false, reason: expect.stringMatching(expected) });
    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          parentType: "escrow",
          parentId,
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(expected);
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it.each(CREATION_ENTRIES)(
    "rejects the $label path when the escrow on-chain reference is missing",
    async (entry) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: entry.fixtureParentType,
        label: `missing-chain-reference-${entry.label}`,
      });
      const references = await seedRejectedCreationContext(t, fixture);
      await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { escrowId: "" }));
      const before = await snapshotCreationDocuments(t);
      const args = withReferenceArgs(fixture, references, entry, fixture.clientWallet);
      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: args.parentType,
        parentId: args.parentId,
        openedByWallet: fixture.clientWallet,
      });
      expect(eligibility).toMatchObject({
        allowed: false,
        reason: expect.stringContaining("missing its on-chain escrow id"),
      });
      await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
        /missing its on-chain escrow id/,
      );
      expect(await snapshotCreationDocuments(t)).toEqual(before);
    },
  );

  it.each(
    CREATION_ENTRIES.flatMap((entry) =>
      (["client", "freelancer"] as const).map((mismatch) => [entry, mismatch] as const),
    ),
  )(
    "rejects $0.label when stored $1 ownership disagrees with the parent relationship",
    async (entry, mismatch) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: entry.fixtureParentType,
        label: `ownership-${entry.label}-${mismatch}`,
      });
      const references = await seedRejectedCreationContext(t, fixture);
      await t.run(async (ctx) =>
        ctx.db.patch(fixture.escrowId, {
          ...(mismatch === "client"
            ? { clientWallet: fixture.unrelatedWallet }
            : { freelancerWallet: fixture.unrelatedWallet }),
        }),
      );
      const before = await snapshotCreationDocuments(t);
      const args = withReferenceArgs(fixture, references, entry, fixture.clientWallet);
      const eligibility = await t.query(api.disputes.canOpenDispute, {
        parentType: args.parentType,
        parentId: args.parentId,
        openedByWallet: fixture.clientWallet,
      });
      const expected = mismatch === "client" ? /parent job owner/ : /assigned freelancer/;
      expect(eligibility).toMatchObject({
        allowed: false,
        reason: expect.stringMatching(expected),
      });
      await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(expected);
      expect(await snapshotCreationDocuments(t)).toEqual(before);
    },
  );

  it("rejects incompatible milestone/job links on explicit escrow parents atomically", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "incompatible-explicit-links",
    });
    const references = await seedRejectedCreationContext(t, fixture);
    const otherJobId = await insertMilestoneProjectJob(t, "incompatible-explicit-links");
    const otherMilestoneId = await t.run(async (ctx) =>
      ctx.db.insert("milestones", {
        jobId: otherJobId,
        order: 1,
        title: "Other job milestone",
        amount: 500,
        asset: "USDC",
        status: "funded",
        assignedFreelancerWallet: fixture.freelancerWallet,
        createdAt: 1_768_480_800_200,
        updatedAt: 1_768_480_800_200,
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.patch(fixture.escrowId, {
        jobId: fixture.jobId,
        milestoneId: otherMilestoneId,
      }),
    );
    const before = await snapshotCreationDocuments(t);
    const args = withReferenceArgs(
      fixture,
      references,
      CREATION_ENTRIES.find((entry) => entry.label === "explicit milestone escrow")!,
      fixture.clientWallet,
    );
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: args.parentType,
      parentId: args.parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("Milestone does not belong"),
    });
    await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
      /Milestone does not belong/,
    );
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it("rejects a milestone escrow reference conflict independently of escrow selection", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "milestone-reference-conflict",
    });
    const references = await seedRejectedCreationContext(t, fixture);
    await t.run(async (ctx) =>
      ctx.db.patch(fixture.milestoneId!, { escrowId: "different-on-chain-escrow" }),
    );
    const before = await snapshotCreationDocuments(t);
    const entry = CREATION_ENTRIES.find((item) => item.label === "explicit milestone escrow")!;
    const args = withReferenceArgs(fixture, references, entry, fixture.clientWallet);
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: args.parentType,
      parentId: args.parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("escrow reference does not match"),
    });
    await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
      /escrow reference does not match/,
    );
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });
});

describe("C05 eligibility and rollback invariants", () => {
  it("allows only assigned escrows and every query result agrees with mutation eligibility", async () => {
    for (const status of ["created", "released", "cancelled", "disputed"] as const) {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `ineligible-${status}` });
      await seedRejectedCreationContext(t, fixture);
      await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { status }));
      const before = await snapshotCreationDocuments(t);

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
      expect(await snapshotCreationDocuments(t)).toEqual(before);
    }

    for (const escrowStatus of ["funded", "submitted"] as const) {
      for (const parentType of ["micro_gig", "milestone"] as const) {
        const t = convexTest(schema, modules);
        const fixture = await seedDisputeFixture(t, {
          escrowStatus,
          parentType,
          label: `unassigned-${parentType}-${escrowStatus}`,
        });
        await seedRejectedCreationContext(t, fixture);
        await t.run(async (ctx) => ctx.db.patch(fixture.escrowId, { freelancerWallet: undefined }));
        const before = await snapshotCreationDocuments(t);
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
        expect(await snapshotCreationDocuments(t)).toEqual(before);
      }
    }
  });

  it.each(ACTIVE_DISPUTE_STATUSES)(
    "blocks duplicate creation in every alias/path when the existing dispute is $0",
    async (activeStatus) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `active-duplicate-${activeStatus}` });
      const references = await seedRejectedCreationContext(t, fixture);
      const initialEntry = CREATION_ENTRIES.find(
        (entry) => entry.parentType === fixture.parentType,
      )!;
      const initialId = await t.mutation(
        api.disputes.createDispute,
        withReferenceArgs(fixture, references, initialEntry, fixture.clientWallet),
      );
      await t.run(async (ctx) => ctx.db.patch(initialId, { status: activeStatus }));
      const before = await snapshotCreationDocuments(t);

      for (const entry of CREATION_ENTRIES.filter(
        (candidate) => candidate.fixtureParentType === fixture.parentType,
      )) {
        const args = withReferenceArgs(fixture, references, entry, fixture.freelancerWallet);
        const eligibility = await t.query(api.disputes.canOpenDispute, {
          parentType: args.parentType,
          parentId: args.parentId,
          openedByWallet: fixture.freelancerWallet,
        });
        expect(eligibility).toMatchObject({ allowed: false });
        await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
          /already disputed|already has an active dispute/,
        );
        expect(await snapshotCreationDocuments(t)).toEqual(before);
      }
    },
  );

  it("checks milestone conflicts even when the active record has no escrow link", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "milestone-conflict-without-escrow",
    });
    const references = await seedRejectedCreationContext(t, fixture);
    await t.run(async (ctx) =>
      ctx.db.insert(
        "disputes",
        makeDisputeFields(fixture, {
          disputeNumber: "DSP-C05-MILESTONE-ONLY",
          escrowId: undefined,
          status: "open",
        }),
      ),
    );
    const before = await snapshotCreationDocuments(t);
    const entry = CREATION_ENTRIES.find((item) => item.label === "explicit milestone escrow")!;
    const args = withReferenceArgs(fixture, references, entry, fixture.clientWallet);
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: args.parentType,
      parentId: args.parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("milestone already has an active dispute"),
    });
    await expect(t.mutation(api.disputes.createDispute, args)).rejects.toThrow(
      /milestone already has an active dispute/,
    );
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it("finds an active dispute after more than 50 historical closed disputes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "history-over-50" });
    const references = await seedRejectedCreationContext(t, fixture);
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

    const disputeId = await createDispute(t, fixture, {
      evidenceAttachmentIds: [references.attachmentId],
      relatedWorkSubmissionIds: [references.submissionId],
      relatedRevisionRequestIds: [references.revisionRequestId],
      relatedMessageIds: [references.messageId],
      relatedDeadlineEventIds: [references.deadlineEventId],
    });
    expect(disputeId).toBeDefined();
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.freelancerWallet,
    });
    expect(eligibility.allowed).toBe(false);
    const before = await snapshotCreationDocuments(t);
    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          openedByWallet: fixture.freelancerWallet,
          title: "Duplicate after closed history",
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(/already disputed|already has an active dispute/);
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it("allows otherwise eligible work when its history contains only terminal disputes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "terminal-history-only" });
    await t.run(async (ctx) => {
      for (const [index, status] of (
        ["resolved_client", "resolved_freelancer", "split_resolution", "cancelled"] as const
      ).entries()) {
        await ctx.db.insert(
          "disputes",
          makeDisputeFields(fixture, {
            disputeNumber: `DSP-C05-TERMINAL-${index}`,
            status,
          }),
        );
      }
    });
    const eligibility = await t.query(api.disputes.canOpenDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.clientWallet,
    });
    expect(eligibility.allowed).toBe(true);
    await expect(createDispute(t, fixture)).resolves.toBeDefined();
  });

  it("rejects unrelated wallets and administrators who are not participants", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "nonparticipant-admin" });
    const references = await seedRejectedCreationContext(t, fixture);
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", fixture.adminWallet);
    const before = await snapshotCreationDocuments(t);

    await expect(
      t.mutation(
        api.disputes.createDispute,
        withReferenceArgs(fixture, references, CREATION_ENTRIES[0], fixture.unrelatedWallet),
      ),
    ).rejects.toThrow(/Only the client or assigned freelancer/);
    await expect(
      t.mutation(
        api.disputes.createDispute,
        withReferenceArgs(fixture, references, CREATION_ENTRIES[0], fixture.adminWallet),
      ),
    ).rejects.toThrow(/Only the client or assigned freelancer/);
    expect(await snapshotCreationDocuments(t)).toEqual(before);
  });

  it("leaves dispute, event, notification, and related records unchanged after duplicate rejection", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "duplicate-rollback" });
    const references = await seedRejectedCreationContext(t, fixture);
    await createDispute(t, fixture, {
      evidenceAttachmentIds: [references.attachmentId],
      relatedWorkSubmissionIds: [references.submissionId],
      relatedRevisionRequestIds: [references.revisionRequestId],
      relatedMessageIds: [references.messageId],
      relatedDeadlineEventIds: [references.deadlineEventId],
    });
    const before = await snapshotCreationDocuments(t);

    await expect(
      t.mutation(
        api.disputes.createDispute,
        getCreationArgs(fixture, {
          title: "Rejected duplicate",
          evidenceAttachmentIds: [references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(/already disputed|already has an active dispute/);
    expect(await snapshotCreationDocuments(t)).toEqual(before);
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
