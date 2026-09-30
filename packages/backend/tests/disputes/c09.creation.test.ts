import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  seedAcceptedDisputeAgreement,
  seedDisputeFixture,
  seedDisputeReferences,
  type BackendTest,
  type DisputeFixture,
} from "../fixtures/disputes";

function createArgs(fixture: DisputeFixture, overrides: Record<string, unknown> = {}) {
  return {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet" as const,
    reasonCategory: "work_not_delivered" as const,
    title: "  C09   dispute title  ",
    description: "  First line\r\nsecond line  ",
    ...overrides,
  };
}

async function countCreationSideEffects(t: BackendTest) {
  return await t.run(async (ctx) => ({
    attachments: (await ctx.db.query("attachments").collect()).length,
    conversations: (await ctx.db.query("conversations").collect()).length,
    disputeEvents: (await ctx.db.query("disputeEvents").collect()).length,
    disputes: (await ctx.db.query("disputes").collect()).length,
    messages: (await ctx.db.query("messages").collect()).length,
    notifications: (await ctx.db.query("notifications").collect()).length,
    revisionRequests: (await ctx.db.query("revisionRequests").collect()).length,
    workAgreementVersions: (await ctx.db.query("workAgreementVersions").collect()).length,
    workSubmissions: (await ctx.db.query("workSubmissions").collect()).length,
  }));
}

async function insertMessageForParent(
  t: BackendTest,
  fixture: DisputeFixture,
  input: {
    parentType: "job" | "direct" | "milestone" | "escrow" | "work_submission" | "dispute";
    parentId: string;
    participants?: string[];
  },
) {
  return await t.run(async (ctx) => {
    const now = 1_768_480_801_000;
    const conversationId = await ctx.db.insert("conversations", {
      parentType: input.parentType,
      parentId: input.parentId,
      ...(input.parentType !== "direct" ? { jobId: fixture.jobId } : {}),
      ...(input.parentType === "milestone" && fixture.milestoneId !== undefined
        ? { milestoneId: fixture.milestoneId }
        : {}),
      ...(input.parentType === "escrow" ? { escrowId: fixture.escrowId } : {}),
      ...(input.parentType === "work_submission"
        ? { workSubmissionId: input.parentId as Id<"workSubmissions"> }
        : {}),
      participantWallets: input.participants ?? [fixture.clientWallet, fixture.freelancerWallet],
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
      status: "active",
      createdByWallet: fixture.clientWallet,
      createdAt: now,
      updatedAt: now,
    });
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      parentType: input.parentType,
      parentId: input.parentId,
      senderWallet: fixture.clientWallet,
      senderWalletType: "external_wallet",
      senderRole: "client",
      kind: "user",
      body: "C09 message reference.",
      attachmentIds: [],
      status: "sent",
      createdAt: now,
      updatedAt: now,
    });
    return { conversationId, messageId };
  });
}

describe("C09 dispute creation references and opening audit", () => {
  it.each([
    {
      escrowStatus: "funded" as const,
      parentType: "micro_gig" as const,
      opener: "client" as const,
    },
    {
      escrowStatus: "submitted" as const,
      parentType: "micro_gig" as const,
      opener: "freelancer" as const,
    },
    {
      escrowStatus: "funded" as const,
      parentType: "milestone" as const,
      opener: "client" as const,
    },
    {
      escrowStatus: "submitted" as const,
      parentType: "milestone" as const,
      opener: "freelancer" as const,
    },
  ])(
    "accepts valid $escrowStatus $parentType creation through the escrow alias for a $opener",
    async ({ escrowStatus, parentType, opener }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        escrowStatus,
        parentType,
        label: `c09-valid-${escrowStatus}-${parentType}-${opener}`,
      });
      const agreementId =
        escrowStatus === "funded" && parentType === "micro_gig"
          ? await seedAcceptedDisputeAgreement(t, fixture)
          : undefined;
      const references = await seedDisputeReferences(t, fixture);
      const openedByWallet = opener === "client" ? fixture.clientWallet : fixture.freelancerWallet;
      if (opener === "freelancer") {
        await t.run(async (ctx) =>
          ctx.db.patch(references.attachmentId, {
            uploadedByWallet: fixture.freelancerWallet,
            ownerRole: "freelancer",
          }),
        );
      }
      const disputeId = await t.mutation(
        api.disputes.createDispute,
        createArgs(fixture, {
          parentType: "escrow",
          parentId: fixture.escrowId,
          openedByWallet,
          openedByWalletType: opener === "client" ? "external_wallet" : "passkey_smart_account",
          evidenceAttachmentIds: [references.attachmentId, references.attachmentId],
          relatedWorkSubmissionIds: [references.submissionId, references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId, references.revisionRequestId],
          relatedMessageIds: [references.messageId, references.messageId],
          relatedDeadlineEventIds: [references.deadlineEventId, references.deadlineEventId],
        }),
      );

      const dispute = await t.run(async (ctx) => ctx.db.get(disputeId));
      const openingEvents = await t.run(async (ctx) =>
        (await ctx.db.query("disputeEvents").collect()).filter(
          (event) => event.disputeId === disputeId && event.type === "dispute_opened",
        ),
      );
      const attachment = await t.run(async (ctx) => ctx.db.get(references.attachmentId));
      const notifications = await t.run(async (ctx) => ctx.db.query("notifications").collect());
      const agreementEvents = await t.run(async (ctx) =>
        (await ctx.db.query("workAgreementEvents").collect()).filter(
          (event) => event.type === "agreement_referenced_in_dispute",
        ),
      );

      expect(dispute).toMatchObject({
        _id: disputeId,
        parentType: parentType === "milestone" ? "milestone" : "escrow",
        escrowId: fixture.escrowId,
        openedByWallet,
        openedByRole: opener,
        openedByWalletType: opener === "client" ? "external_wallet" : "passkey_smart_account",
        status: "open",
        onChainStatus: "not_marked",
        title: "C09 dispute title",
        description: "First line\nsecond line",
        evidenceAttachmentIds: [references.attachmentId],
        relatedWorkSubmissionIds: [references.submissionId],
        relatedRevisionRequestIds: [references.revisionRequestId],
        relatedMessageIds: [references.messageId],
        relatedDeadlineEventIds: [references.deadlineEventId],
      });
      if (agreementId !== undefined) {
        expect(dispute).toMatchObject({
          agreementId,
        });
        expect(dispute?.agreementVersionId).toBeDefined();
        expect(agreementEvents).toEqual([
          expect.objectContaining({
            agreementId,
            relatedEntityType: "dispute",
            relatedEntityId: disputeId,
          }),
        ]);
      }
      expect(openingEvents).toHaveLength(1);
      expect(openingEvents[0]).toMatchObject({
        actorWallet: openedByWallet,
        actorRole: opener,
        attachmentIds: [references.attachmentId],
        newStatus: "open",
        metadata: { description: "First line\nsecond line" },
        createdAt: dispute?.openedAt,
      });
      expect(attachment).toMatchObject({
        parentType: "dispute",
        parentId: disputeId,
      });
      expect(notifications).toEqual([
        expect.objectContaining({
          recipientWallet: opener === "client" ? fixture.freelancerWallet : fixture.clientWallet,
          type: "dispute_opened",
        }),
      ]);
    },
  );

  it("accepts a shared parent-job conversation and rejects a direct conversation", async () => {
    const validTest = convexTest(schema, modules);
    const validFixture = await seedDisputeFixture(validTest, { label: "c09-shared-job" });
    const validMessage = await insertMessageForParent(validTest, validFixture, {
      parentType: "job",
      parentId: validFixture.jobId,
    });

    await expect(
      validTest.mutation(
        api.disputes.createDispute,
        createArgs(validFixture, { relatedMessageIds: [validMessage.messageId] }),
      ),
    ).resolves.toBeDefined();

    const submissionTest = convexTest(schema, modules);
    const submissionFixture = await seedDisputeFixture(submissionTest, {
      label: "c09-submission-chat",
    });
    const submissionReferences = await seedDisputeReferences(submissionTest, submissionFixture);
    const submissionMessage = await insertMessageForParent(submissionTest, submissionFixture, {
      parentType: "work_submission",
      parentId: submissionReferences.submissionId,
    });
    await expect(
      submissionTest.mutation(
        api.disputes.createDispute,
        createArgs(submissionFixture, {
          relatedWorkSubmissionIds: [submissionReferences.submissionId],
          relatedMessageIds: [submissionMessage.messageId],
        }),
      ),
    ).resolves.toBeDefined();

    const directTest = convexTest(schema, modules);
    const directFixture = await seedDisputeFixture(directTest, { label: "c09-direct-chat" });
    const directMessage = await insertMessageForParent(directTest, directFixture, {
      parentType: "direct",
      parentId: "client-freelancer",
    });
    const before = await countCreationSideEffects(directTest);

    await expect(
      directTest.mutation(
        api.disputes.createDispute,
        createArgs(directFixture, { relatedMessageIds: [directMessage.messageId] }),
      ),
    ).rejects.toThrow(/Direct conversations/);
    expect(await countCreationSideEffects(directTest)).toEqual(before);
  });

  it("accepts legacy records with omitted optional links and same-work previous disputes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c09-legacy-links" });
    const references = await seedDisputeReferences(t, fixture);
    const previousContext = await t.run(async (ctx) => {
      const previousId = await ctx.db.insert("disputes", {
        disputeNumber: "DSP-C09-PREVIOUS",
        parentType: "micro_gig",
        parentId: fixture.jobId,
        jobId: fixture.jobId,
        microGigId: fixture.jobId,
        clientWallet: fixture.clientWallet,
        freelancerWallet: fixture.freelancerWallet,
        openedByWallet: fixture.clientWallet,
        openedByWalletType: "external_wallet",
        openedByRole: "client",
        reasonCategory: "other",
        title: "Previous dispute",
        description: "Previous dispute fixture.",
        evidenceAttachmentIds: [],
        relatedWorkSubmissionIds: [],
        relatedRevisionRequestIds: [],
        status: "cancelled",
        onChainStatus: "not_marked",
        openedAt: 1_768_480_800_600,
        createdAt: 1_768_480_800_600,
        updatedAt: 1_768_480_800_600,
      });
      const conversationId = await ctx.db.insert("conversations", {
        parentType: "dispute",
        parentId: previousId,
        participantWallets: [fixture.clientWallet, fixture.freelancerWallet],
        clientWallet: fixture.clientWallet,
        freelancerWallet: fixture.freelancerWallet,
        status: "active",
        createdByWallet: fixture.clientWallet,
        createdAt: 1_768_480_800_600,
        updatedAt: 1_768_480_800_600,
      });
      const previousMessageId = await ctx.db.insert("messages", {
        conversationId,
        parentType: "dispute",
        parentId: previousId,
        senderWallet: fixture.freelancerWallet,
        senderWalletType: "external_wallet",
        senderRole: "freelancer",
        kind: "user",
        body: "Previous dispute context.",
        attachmentIds: [],
        status: "sent",
        createdAt: 1_768_480_800_600,
        updatedAt: 1_768_480_800_600,
      });
      return { previousDisputeId: previousId, previousMessageId };
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(references.submissionId, {
        jobId: undefined,
        milestoneId: undefined,
        escrowId: undefined,
        onChainEscrowId: undefined,
      });
      await ctx.db.patch(references.revisionRequestId, {
        jobId: undefined,
        milestoneId: undefined,
        escrowId: undefined,
      });
    });

    await expect(
      t.mutation(
        api.disputes.createDispute,
        createArgs(fixture, {
          relatedWorkSubmissionIds: [references.submissionId],
          relatedRevisionRequestIds: [references.revisionRequestId],
          relatedMessageIds: [previousContext.previousMessageId],
        }),
      ),
    ).resolves.toBeDefined();
  });

  it("rejects missing, wrong-table, participant-mismatched, and conflicting references atomically", async () => {
    const missingTest = convexTest(schema, modules);
    const missingFixture = await seedDisputeFixture(missingTest, { label: "c09-missing" });
    const missingReferences = await seedDisputeReferences(missingTest, missingFixture);
    await missingTest.run(async (ctx) => ctx.db.delete(missingReferences.submissionId));
    const missingBefore = await countCreationSideEffects(missingTest);

    await expect(
      missingTest.mutation(
        api.disputes.createDispute,
        createArgs(missingFixture, { relatedWorkSubmissionIds: [missingReferences.submissionId] }),
      ),
    ).rejects.toThrow(/Work submission not found/);
    expect(await countCreationSideEffects(missingTest)).toEqual(missingBefore);

    const wrongTableTest = convexTest(schema, modules);
    const wrongTableFixture = await seedDisputeFixture(wrongTableTest, {
      label: "c09-wrong-table",
    });
    const wrongTableId = wrongTableFixture.jobId as unknown as Id<"workSubmissions">;
    await expect(
      wrongTableTest.mutation(
        api.disputes.createDispute,
        createArgs(wrongTableFixture, { relatedWorkSubmissionIds: [wrongTableId] }),
      ),
    ).rejects.toThrow(/workSubmissions|Expected ID/i);

    const mismatchTest = convexTest(schema, modules);
    const mismatchFixture = await seedDisputeFixture(mismatchTest, { label: "c09-mismatch" });
    const mismatchReferences = await seedDisputeReferences(mismatchTest, mismatchFixture);
    await mismatchTest.run(async (ctx) =>
      ctx.db.patch(mismatchReferences.submissionId, {
        clientWallet: mismatchFixture.unrelatedWallet,
      }),
    );
    await expect(
      mismatchTest.mutation(
        api.disputes.createDispute,
        createArgs(mismatchFixture, {
          relatedWorkSubmissionIds: [mismatchReferences.submissionId],
        }),
      ),
    ).rejects.toThrow(/participants do not match/);

    const conflictTest = convexTest(schema, modules);
    const conflictFixture = await seedDisputeFixture(conflictTest, { label: "c09-conflict" });
    const conflictReferences = await seedDisputeReferences(conflictTest, conflictFixture);
    const unrelatedFixture = await seedDisputeFixture(conflictTest, {
      label: "c09-conflicting-work",
    });
    await conflictTest.run(async (ctx) =>
      ctx.db.patch(conflictReferences.submissionId, {
        escrowId: unrelatedFixture.escrowId,
      }),
    );
    await expect(
      conflictTest.mutation(
        api.disputes.createDispute,
        createArgs(conflictFixture, {
          relatedWorkSubmissionIds: [conflictReferences.submissionId],
        }),
      ),
    ).rejects.toThrow(/escrow link|valid escrow/i);
  });

  it("checks raw count limits before deduplicating evidence and related records", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c09-limits" });
    const references = await seedDisputeReferences(t, fixture);
    const before = await countCreationSideEffects(t);

    await expect(
      t.mutation(
        api.disputes.createDispute,
        createArgs(fixture, {
          relatedWorkSubmissionIds: Array.from({ length: 21 }, () => references.submissionId),
        }),
      ),
    ).rejects.toThrow(/20 records or fewer/);
    expect(await countCreationSideEffects(t)).toEqual(before);

    await expect(
      t.mutation(
        api.disputes.createDispute,
        createArgs(fixture, {
          evidenceAttachmentIds: Array.from({ length: 26 }, () => references.attachmentId),
        }),
      ),
    ).rejects.toThrow(/25 files or fewer/);
    expect(await countCreationSideEffects(t)).toEqual(before);
  });

  it("rejects hidden messages and exact-parent deadline mismatches without opening a dispute", async () => {
    const messageTest = convexTest(schema, modules);
    const messageFixture = await seedDisputeFixture(messageTest, { label: "c09-hidden-message" });
    const messageReferences = await seedDisputeReferences(messageTest, messageFixture);
    await messageTest.run(async (ctx) =>
      ctx.db.patch(messageReferences.messageId, { status: "hidden" }),
    );
    await expect(
      messageTest.mutation(
        api.disputes.createDispute,
        createArgs(messageFixture, { relatedMessageIds: [messageReferences.messageId] }),
      ),
    ).rejects.toThrow(/Message not found/);

    const deadlineTest = convexTest(schema, modules);
    const deadlineFixture = await seedDisputeFixture(deadlineTest, {
      parentType: "milestone",
      label: "c09-sibling-milestone",
    });
    const deadlineReferences = await seedDisputeReferences(deadlineTest, deadlineFixture);
    const siblingMilestoneId = await deadlineTest.run(async (ctx) =>
      ctx.db.insert("milestones", {
        jobId: deadlineFixture.jobId,
        order: 2,
        title: "Sibling milestone",
        amount: 500,
        asset: "USDC",
        status: "funded",
        assignedFreelancerWallet: deadlineFixture.freelancerWallet,
        createdAt: 1_768_480_800_900,
        updatedAt: 1_768_480_800_900,
      }),
    );
    await deadlineTest.run(async (ctx) =>
      ctx.db.patch(deadlineReferences.deadlineEventId, {
        parentId: siblingMilestoneId,
      }),
    );
    const before = await countCreationSideEffects(deadlineTest);
    await expect(
      deadlineTest.mutation(
        api.disputes.createDispute,
        createArgs(deadlineFixture, {
          relatedDeadlineEventIds: [deadlineReferences.deadlineEventId],
        }),
      ),
    ).rejects.toThrow(/different work parent/);
    expect(await countCreationSideEffects(deadlineTest)).toEqual(before);
  });
});
