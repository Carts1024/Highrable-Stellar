import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  seedDisputeFixture,
  seedDisputeReferences,
  snapshotDisputeCreationState,
  type BackendTest,
  type DisputeFixture,
} from "../fixtures/disputes";

const NOW = 1_768_480_900_000;
const ADMIN_SECRET = "c10-admin-secret";

async function createDispute(
  t: BackendTest,
  fixture: DisputeFixture,
  input: Partial<{
    openedByWallet: string;
    openedByWalletType: "external_wallet" | "passkey_smart_account";
    parentType: "micro_gig" | "milestone" | "escrow" | "job";
    parentId: string;
    evidenceAttachmentIds: Id<"attachments">[];
  }> = {},
) {
  return await t.mutation(api.disputes.createDispute, {
    parentType: input.parentType ?? fixture.parentType,
    parentId: input.parentId ?? fixture.parentId,
    openedByWallet: input.openedByWallet ?? fixture.clientWallet,
    openedByWalletType: input.openedByWalletType ?? "external_wallet",
    reasonCategory: "work_not_delivered",
    title: "C10 protected case",
    description: "C10 protected-read regression fixture.",
    ...(input.evidenceAttachmentIds !== undefined
      ? { evidenceAttachmentIds: input.evidenceAttachmentIds }
      : {}),
  });
}

async function insertAttachment(
  t: BackendTest,
  fixture: DisputeFixture,
  options: {
    label: string;
    owner?: "client" | "freelancer";
    parentType?: Doc<"attachments">["parentType"];
    parentId?: string;
    status?: Doc<"attachments">["status"];
    protectionMode?: "protected_preview" | "download_restricted";
    expiresAt?: number;
  },
) {
  const owner = options.owner ?? "client";
  const uploadedByWallet = owner === "client" ? fixture.clientWallet : fixture.freelancerWallet;
  return await t.run(async (ctx) =>
    ctx.db.insert("attachments", {
      type: "file",
      name: `${options.label}.txt`,
      uploadedByWallet,
      uploadedByWalletType: owner === "client" ? "external_wallet" : "passkey_smart_account",
      ownerRole: owner,
      parentType: options.parentType ?? "unknown",
      ...(options.parentId !== undefined ? { parentId: options.parentId } : {}),
      visibility: "participants",
      status: options.status ?? "active",
      ...(options.protectionMode !== undefined
        ? {
            protectionMode: options.protectionMode,
            downloadAllowed: false,
            previewAllowed: true,
            watermarkEnabled: true,
            accessLoggingEnabled: true,
          }
        : {}),
      ...(options.expiresAt !== undefined ? { expiresAt: options.expiresAt } : {}),
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}

async function insertAttachments(
  t: BackendTest,
  fixture: DisputeFixture,
  count: number,
  label: string,
) {
  return await t.run(async (ctx) => {
    const ids: Id<"attachments">[] = [];
    for (let index = 0; index < count; index += 1) {
      ids.push(
        await ctx.db.insert("attachments", {
          type: "file",
          name: `${label}-${index}.txt`,
          uploadedByWallet: fixture.clientWallet,
          uploadedByWalletType: "external_wallet",
          ownerRole: "client",
          parentType: "unknown",
          visibility: "private",
          status: "active",
          createdAt: NOW + index,
          updatedAt: NOW + index,
        }),
      );
    }
    return ids;
  });
}

async function seedSecondMicroGigCase(
  t: BackendTest,
  fixture: DisputeFixture,
): Promise<DisputeFixture> {
  return await t.run(async (ctx) => {
    const jobId = await ctx.db.insert("jobs", {
      title: "C10 shared-wallet job",
      description: "A second work item using the same participant wallets.",
      budget: 500,
      asset: "USDC",
      jobType: "micro_gig",
      totalBudget: 500,
      clientWallet: fixture.clientWallet,
      selectedFreelancerWallet: fixture.freelancerWallet,
      status: "funded",
      jobHash: "c10-shared-wallet-job",
      createdAt: NOW,
      updatedAt: NOW,
    });
    const escrowId = await ctx.db.insert("escrows", {
      jobId,
      escrowId: "c10-shared-wallet-escrow",
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
      amount: 500,
      asset: "USDC",
      status: "funded",
      createdAt: NOW,
      updatedAt: NOW,
    });
    return {
      ...fixture,
      jobId,
      escrowId,
      parentId: jobId,
      parentType: "micro_gig" as const,
    };
  });
}

describe("C10 evidence association and protected reads", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["micro_gig", "client", "external_wallet"],
    ["micro_gig", "freelancer", "passkey_smart_account"],
    ["milestone", "client", "external_wallet"],
    ["milestone", "freelancer", "passkey_smart_account"],
    ["job", "client", "external_wallet"],
    ["escrow", "freelancer", "passkey_smart_account"],
  ] as const)(
    "authorizes current %s %s reads with %s identity",
    async (parentType, role, walletType) => {
      const t = convexTest(schema, modules);
      const fixtureParentType = parentType === "milestone" ? "milestone" : "micro_gig";
      const fixture = await seedDisputeFixture(t, {
        parentType: fixtureParentType,
        label: `c10-read-${parentType}-${role}`,
      });
      const viewerWallet = role === "client" ? fixture.clientWallet : fixture.freelancerWallet;
      const storedParentType = parentType === "escrow" ? "escrow" : fixture.parentType;
      const storedParentId = parentType === "escrow" ? fixture.escrowId : fixture.parentId;
      const disputeId = await createDispute(t, fixture, {
        openedByWallet: viewerWallet,
        openedByWalletType: walletType,
        parentType,
        parentId: parentType === "escrow" ? fixture.escrowId : fixture.parentId,
      });

      await expect(
        t.query(api.disputes.getDispute, { disputeId, viewerWallet }),
      ).resolves.toMatchObject({ _id: disputeId });
      await expect(
        t.query(api.disputes.getDisputeByParent, {
          parentType: storedParentType,
          parentId: storedParentId,
          viewerWallet,
        }),
      ).resolves.toMatchObject({ _id: disputeId });
      await expect(
        t.query(api.disputes.getActiveDisputeForEscrow, {
          escrowId: fixture.escrowId,
          viewerWallet,
        }),
      ).resolves.toMatchObject({ _id: disputeId });
      await expect(
        t.query(api.disputes.getDisputesForWallet, { walletAddress: viewerWallet }),
      ).resolves.toEqual([expect.objectContaining({ _id: disputeId })]);
      await expect(
        t.query(api.disputes.getDisputeEvidence, { disputeId, viewerWallet }),
      ).resolves.toEqual([]);
      await expect(
        t.query(api.disputes.getDisputeTimeline, { disputeId, viewerWallet }),
      ).resolves.toHaveLength(1);
      await expect(
        t.query(api.disputes.getDisputeContextByParent, {
          parentType: storedParentType,
          parentId: storedParentId,
          viewerWallet,
        }),
      ).resolves.toMatchObject({ parent: { parentId: storedParentId } });
      await expect(
        t.query(api.disputes.canViewDispute, { disputeId, viewerWallet }),
      ).resolves.toMatchObject({ allowed: true, role });
      await expect(
        t.query(api.disputes.canRespondToDispute, { disputeId, walletAddress: viewerWallet }),
      ).resolves.toMatchObject({ allowed: true, role });
    },
  );

  it("keeps terminal history readable until reassignment, then denies both old and replacement wallets", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c10-reassignment" });
    const disputeId = await createDispute(t, fixture);
    await t.run(async (ctx) => {
      await ctx.db.patch(disputeId, { status: "resolved_client" });
      await ctx.db.patch(fixture.escrowId, { status: "released" });
      await ctx.db.patch(fixture.jobId, { status: "completed" });
    });

    await expect(
      t.query(api.disputes.getDispute, { disputeId, viewerWallet: fixture.clientWallet }),
    ).resolves.toMatchObject({ status: "resolved_client" });

    const replacementWallet = "GREASSIGNEDC10";
    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.jobId, {
        selectedFreelancerWallet: replacementWallet,
        status: "funded",
      });
      await ctx.db.patch(fixture.escrowId, {
        freelancerWallet: replacementWallet,
        status: "funded",
      });
      await ctx.db.patch(disputeId, { status: "open" });
    });

    for (const wallet of [fixture.clientWallet, fixture.freelancerWallet, replacementWallet]) {
      await expect(
        t.query(api.disputes.getDispute, { disputeId, viewerWallet: wallet }),
      ).rejects.toThrow();
      await expect(
        t.query(api.disputes.canViewDispute, { disputeId, viewerWallet: wallet }),
      ).resolves.toMatchObject({ allowed: false, role: null });
      await expect(
        t.query(api.disputes.getDisputesForWallet, { walletAddress: wallet }),
      ).resolves.toEqual([]);
    }

    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.freelancerWallet,
        responderWalletType: "external_wallet",
        message: "Stale participant response.",
      }),
    ).rejects.toThrow();
  });

  it("fails closed when a parent is deleted or a saved link conflicts", async () => {
    const deletedParentTest = convexTest(schema, modules);
    const deletedFixture = await seedDisputeFixture(deletedParentTest, {
      label: "c10-deleted-parent",
    });
    const deletedDisputeId = await createDispute(deletedParentTest, deletedFixture);
    await deletedParentTest.run(async (ctx) => ctx.db.delete(deletedFixture.jobId));
    await expect(
      deletedParentTest.query(api.disputes.getDispute, {
        disputeId: deletedDisputeId,
        viewerWallet: deletedFixture.clientWallet,
      }),
    ).rejects.toThrow();

    const conflictTest = convexTest(schema, modules);
    const conflictFixture = await seedDisputeFixture(conflictTest, {
      label: "c10-conflicting-link",
    });
    const conflictDisputeId = await createDispute(conflictTest, conflictFixture);
    const siblingJobId = await conflictTest.run(async (ctx) =>
      ctx.db.insert("jobs", {
        title: "Conflicting C10 job",
        description: "Conflicting link fixture.",
        budget: 500,
        asset: "USDC",
        jobType: "micro_gig",
        clientWallet: conflictFixture.clientWallet,
        selectedFreelancerWallet: conflictFixture.freelancerWallet,
        status: "funded",
        jobHash: "c10-conflicting-job",
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    await conflictTest.run(async (ctx) => ctx.db.patch(conflictDisputeId, { jobId: siblingJobId }));
    await expect(
      conflictTest.query(api.disputes.canViewDispute, {
        disputeId: conflictDisputeId,
        viewerWallet: conflictFixture.clientWallet,
      }),
    ).resolves.toMatchObject({ allowed: false, role: null });
  });

  it("returns null for anonymous context reads and omits invalid submissions, linked revisions, and deadlines", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c10-context" });
    const references = await seedDisputeReferences(t, fixture);

    await expect(
      t.query(api.disputes.getDisputeContextByParent, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.disputes.getDisputeContextByParent, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        viewerWallet: "  ",
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.disputes.getDisputeContextByParent, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        viewerWallet: fixture.unrelatedWallet,
      }),
    ).resolves.toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.patch(references.submissionId, { freelancerWallet: "GCONFLICTEDC10" });
      await ctx.db.patch(references.deadlineEventId, { parentId: "missing-parent" });
    });
    await expect(
      t.query(api.disputes.getDisputeContextByParent, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        viewerWallet: fixture.clientWallet,
      }),
    ).resolves.toMatchObject({
      parent: expect.objectContaining({ parentId: fixture.parentId }),
      submissions: [],
      revisions: [],
      deadlineEvents: [],
    });
  });

  it("shows only active same-case participant-owned evidence and protects direct access after revocation", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c10-association" });
    const otherFixture = await seedSecondMicroGigCase(t, fixture);
    const disputeId = await createDispute(t, fixture);
    const otherDisputeId = await createDispute(t, otherFixture);

    const sameCaseId = await insertAttachment(t, fixture, {
      label: "same-case",
      parentType: "dispute",
      parentId: disputeId,
    });
    const crossCaseId = await insertAttachment(t, fixture, {
      label: "cross-case",
      parentType: "dispute",
      parentId: otherDisputeId,
    });
    const protectedId = await insertAttachment(t, fixture, {
      label: "protected",
      owner: "freelancer",
      parentType: "dispute",
      parentId: disputeId,
      protectionMode: "protected_preview",
    });
    const expiredId = await insertAttachment(t, fixture, {
      label: "expired",
      parentType: "dispute",
      parentId: disputeId,
      protectionMode: "protected_preview",
      expiresAt: 1,
    });
    const deletedId = await insertAttachment(t, fixture, {
      label: "deleted",
      parentType: "dispute",
      parentId: disputeId,
      status: "deleted",
    });
    const missingId = await insertAttachment(t, fixture, {
      label: "missing",
      parentType: "dispute",
      parentId: disputeId,
    });
    await t.run(async (ctx) => {
      await ctx.db.delete(missingId);
      const event = await ctx.db
        .query("disputeEvents")
        .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
        .first();
      if (!event) throw new Error("C10 dispute event is missing.");
      await ctx.db.patch(disputeId, {
        evidenceAttachmentIds: [
          sameCaseId,
          crossCaseId,
          protectedId,
          expiredId,
          deletedId,
          missingId,
        ],
      });
      await ctx.db.patch(event._id, { attachmentIds: [sameCaseId, crossCaseId] });
    });

    const evidence = await t.query(api.disputes.getDisputeEvidence, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    expect(evidence.map((attachment) => attachment._id)).toEqual([sameCaseId, protectedId]);
    expect(
      (
        await t.query(api.disputes.getDisputeTimeline, {
          disputeId,
          viewerWallet: fixture.clientWallet,
        })
      )[0]?.attachments.map((attachment) => attachment._id),
    ).toEqual([sameCaseId]);

    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.jobId, { selectedFreelancerWallet: "GREVOKEDC10" });
      await ctx.db.patch(fixture.escrowId, { freelancerWallet: "GREVOKEDC10" });
    });
    await expect(
      t.query(api.attachments.getById, {
        attachmentId: protectedId,
        viewerWallet: fixture.clientWallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getProtectedAttachment, {
        attachmentId: protectedId,
        viewerWallet: fixture.clientWallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.attachments.recordProtectedPreviewOpened, {
        attachmentId: protectedId,
        viewerWallet: fixture.clientWallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.attachments.recordDownloadAttempt, {
        attachmentId: protectedId,
        viewerWallet: fixture.clientWallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.attachments.createExternalAttachment, {
        externalUrl: "https://example.com/revoked-c10",
        uploadedByWallet: fixture.clientWallet,
        ownerRole: "client",
        parentType: "dispute",
        parentId: disputeId,
        type: "link",
      }),
    ).rejects.toThrow();
  });

  it("checks raw attachment limits before deduplication and permits repeated requests beyond 25 cumulative files", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c10-limits" });
    const firstBatch = await insertAttachments(t, fixture, 25, "c10-first");
    const limitPlusOne = await insertAttachment(t, fixture, { label: "c10-limit-plus-one" });
    const beforeRejectedCreate = await snapshotDisputeCreationState(t);
    await expect(
      createDispute(t, fixture, {
        evidenceAttachmentIds: [...firstBatch, limitPlusOne],
      }),
    ).rejects.toThrow(/Attach 25 files or fewer\./);
    expect(await snapshotDisputeCreationState(t)).toEqual(beforeRejectedCreate);

    const disputeId = await createDispute(t, fixture, {
      evidenceAttachmentIds: Array.from({ length: 25 }, () => firstBatch[0]!),
    });
    const secondBatch = await insertAttachments(t, fixture, 25, "c10-second");
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: secondBatch,
      }),
    ).resolves.toBe(true);

    const repeatedBefore = await snapshotDisputeCreationState(t);
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: Array.from({ length: 26 }, () => secondBatch[0]!),
      }),
    ).rejects.toThrow(/Attach 25 files or fewer\./);
    expect(await snapshotDisputeCreationState(t)).toEqual(repeatedBefore);
  });

  it("keeps mixed invalid evidence and response writes atomic, including access logs", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c10-atomic" });
    const disputeId = await createDispute(t, fixture);
    const validId = await insertAttachment(t, fixture, { label: "c10-valid" });
    const deletedId = await insertAttachment(t, fixture, {
      label: "c10-invalid",
      status: "deleted",
    });
    const before = await snapshotDisputeCreationState(t);

    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [validId, deletedId],
        message: "Mixed invalid evidence.",
      }),
    ).rejects.toThrow(/Attachment not found\./);
    expect(await snapshotDisputeCreationState(t)).toEqual(before);

    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet",
        attachmentIds: [validId, deletedId],
        message: "Mixed invalid response.",
      }),
    ).rejects.toThrow(/Attachment not found\./);
    expect(await snapshotDisputeCreationState(t)).toEqual(before);
  });

  it("preserves administrator historical review while omitting invalid case attachments", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c10-admin" });
    const otherFixture = await seedSecondMicroGigCase(t, fixture);
    const disputeId = await createDispute(t, fixture);
    const otherDisputeId = await createDispute(t, otherFixture);
    const validId = await insertAttachment(t, fixture, {
      label: "c10-admin-valid",
      parentType: "dispute",
      parentId: disputeId,
    });
    const crossCaseId = await insertAttachment(t, fixture, {
      label: "c10-admin-cross",
      parentType: "dispute",
      parentId: otherDisputeId,
    });
    const invalidOwnerId = await insertAttachment(t, fixture, {
      label: "c10-admin-owner",
      parentType: "dispute",
      parentId: disputeId,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(invalidOwnerId, { ownerRole: "admin" });
      await ctx.db.patch(disputeId, {
        evidenceAttachmentIds: [validId, crossCaseId, invalidOwnerId],
        status: "cancelled",
      });
      await ctx.db.patch(fixture.escrowId, { status: "released" });
      await ctx.db.patch(fixture.jobId, { status: "completed" });
    });

    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", fixture.adminWallet);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", ADMIN_SECRET);
    vi.stubEnv("STELLAR_NETWORK", "testnet");
    vi.stubEnv("ESCROW_CONTRACT_ID", "c10-admin-contract");
    const result = await t.query(api.admin.getAdminDispute, {
      adminWallet: fixture.adminWallet,
      adminApiSecret: ADMIN_SECRET,
      disputeId,
    });
    expect(result.dispute.status).toBe("cancelled");
    expect(result.dispute.attachments.map((attachment) => attachment._id)).toEqual([validId]);
  });
});
