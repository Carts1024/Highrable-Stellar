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

type ParticipantRole = "client" | "freelancer";

function createArgs(fixture: DisputeFixture, overrides: Record<string, unknown> = {}) {
  return {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet" as const,
    reasonCategory: "work_not_delivered" as const,
    title: "C08 evidence dispute",
    description: "C08 evidence validation fixture.",
    ...overrides,
  };
}

async function createDispute(t: BackendTest, fixture: DisputeFixture, overrides = {}) {
  return await t.mutation(api.disputes.createDispute, createArgs(fixture, overrides));
}

function walletForRole(fixture: DisputeFixture, role: ParticipantRole) {
  return role === "client" ? fixture.clientWallet : fixture.freelancerWallet;
}

async function insertAttachment(
  t: BackendTest,
  fixture: DisputeFixture,
  input: {
    label: string;
    owner?: ParticipantRole;
    parentType?: "job" | "unknown";
    status?: "active" | "deleted";
  },
) {
  const owner = input.owner ?? "client";
  const ownerWallet = walletForRole(fixture, owner);
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("attachments", {
      type: "file",
      name: `c08-${input.label}.txt`,
      size: 10,
      mimeType: "text/plain",
      uploadedByWallet: ownerWallet,
      uploadedByWalletType: owner === "client" ? "external_wallet" : "passkey_smart_account",
      ownerRole: owner,
      parentType: input.parentType ?? "unknown",
      ...(input.parentType === "job" ? { parentId: fixture.jobId } : {}),
      visibility: "private",
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function snapshotState(t: BackendTest) {
  return await t.run(async (ctx) => ({
    attachments: await ctx.db.query("attachments").collect(),
    conversations: await ctx.db.query("conversations").collect(),
    disputeEvents: await ctx.db.query("disputeEvents").collect(),
    disputes: await ctx.db.query("disputes").collect(),
    deadlineAuditEvents: await ctx.db.query("deadlineAuditEvents").collect(),
    messages: await ctx.db.query("messages").collect(),
    milestones: await ctx.db.query("milestones").collect(),
    notifications: await ctx.db.query("notifications").collect(),
    revisionRequests: await ctx.db.query("revisionRequests").collect(),
    workAgreements: await ctx.db.query("workAgreements").collect(),
    workAgreementEvents: await ctx.db.query("workAgreementEvents").collect(),
    workAgreementVersions: await ctx.db.query("workAgreementVersions").collect(),
    workSubmissions: await ctx.db.query("workSubmissions").collect(),
  }));
}

describe("C08 dispute evidence association and validation", () => {
  it.each([
    {
      parentType: "micro_gig" as const,
      role: "client" as const,
      walletType: "external_wallet" as const,
    },
    {
      parentType: "micro_gig" as const,
      role: "freelancer" as const,
      walletType: "passkey_smart_account" as const,
    },
    {
      parentType: "milestone" as const,
      role: "client" as const,
      walletType: "external_wallet" as const,
    },
    {
      parentType: "milestone" as const,
      role: "freelancer" as const,
      walletType: "passkey_smart_account" as const,
    },
  ])(
    "accepts $parentType evidence and responses for the $role participant with $walletType",
    async ({ parentType, role, walletType }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c08-accepted-${parentType}-${role}`,
      });
      const openerWallet = walletForRole(fixture, role);
      const responderRole: ParticipantRole = role === "client" ? "freelancer" : "client";
      const responderWallet = walletForRole(fixture, responderRole);
      const openingAttachmentId = await insertAttachment(t, fixture, {
        label: `opening-${role}`,
        owner: role,
      });
      const evidenceAttachmentId = await insertAttachment(t, fixture, {
        label: `evidence-${role}`,
        owner: role,
      });
      const responseAttachmentId = await insertAttachment(t, fixture, {
        label: `response-${responderRole}`,
        owner: responderRole,
      });

      const disputeId = await createDispute(t, fixture, {
        openedByWallet: openerWallet,
        openedByWalletType: walletType,
        evidenceAttachmentIds: [openingAttachmentId, openingAttachmentId],
      });

      await t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: openerWallet,
        actorWalletType: walletType,
        attachmentIds: [evidenceAttachmentId, evidenceAttachmentId],
        message: "  Evidence  message\n ",
      });
      await t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet,
        responderWalletType:
          responderRole === "client" ? "external_wallet" : "passkey_smart_account",
        message: "  Response  message\n ",
        attachmentIds: [responseAttachmentId, responseAttachmentId],
      });

      const records = await t.run(async (ctx) => ({
        attachments: await ctx.db.query("attachments").collect(),
        dispute: await ctx.db.get(disputeId),
        events: (await ctx.db.query("disputeEvents").collect()).filter(
          (event) => event.disputeId === disputeId,
        ),
        notifications: await ctx.db.query("notifications").collect(),
        conversations: await ctx.db.query("conversations").collect(),
        messages: await ctx.db.query("messages").collect(),
      }));

      expect(records.dispute?.evidenceAttachmentIds).toEqual([
        openingAttachmentId,
        evidenceAttachmentId,
        responseAttachmentId,
      ]);
      expect(records.events.map((event) => event.attachmentIds)).toEqual([
        [openingAttachmentId],
        [evidenceAttachmentId],
        [responseAttachmentId],
      ]);
      expect(records.events[1]?.message).toBe("Evidence  message");
      expect(records.events[2]?.message).toBe("Response  message");
      expect(
        records.attachments.filter((attachment) => attachment.parentType === "dispute"),
      ).toHaveLength(3);
      expect(records.notifications).toEqual([
        expect.objectContaining({
          recipientWallet: responderWallet,
          type: "dispute_opened",
        }),
        expect.objectContaining({
          recipientWallet: responderWallet,
          type: "dispute_evidence_added",
        }),
        expect.objectContaining({
          recipientWallet: openerWallet,
          type: "dispute_response_added",
        }),
      ]);
      expect(records.conversations).toHaveLength(1);
      expect(records.messages.map((message) => message.eventType)).toEqual([
        "dispute_opened",
        "dispute_evidence_added",
      ]);
    },
  );

  it("accepts exactly 25 attachments and deduplicates all three mutation paths", async () => {
    const createTest = convexTest(schema, modules);
    const createFixture = await seedDisputeFixture(createTest, { label: "c08-25-create" });
    const createAttachmentId = await insertAttachment(createTest, createFixture, {
      label: "create-25",
    });
    const createDisputeId = await createDispute(createTest, createFixture, {
      evidenceAttachmentIds: Array.from({ length: 25 }, () => createAttachmentId),
    });
    const createRecords = await createTest.run(async (ctx) => ({
      dispute: await ctx.db.get(createDisputeId),
      events: await ctx.db.query("disputeEvents").collect(),
    }));
    expect(createRecords.dispute?.evidenceAttachmentIds).toEqual([createAttachmentId]);
    expect(createRecords.events[0]?.attachmentIds).toEqual([createAttachmentId]);

    const evidenceTest = convexTest(schema, modules);
    const evidenceFixture = await seedDisputeFixture(evidenceTest, { label: "c08-25-evidence" });
    const evidenceDisputeId = await createDispute(evidenceTest, evidenceFixture);
    const evidenceAttachmentId = await insertAttachment(evidenceTest, evidenceFixture, {
      label: "evidence-25",
    });
    await evidenceTest.mutation(api.disputes.addDisputeEvidence, {
      disputeId: evidenceDisputeId,
      actorWallet: evidenceFixture.clientWallet,
      actorWalletType: "external_wallet",
      attachmentIds: Array.from({ length: 25 }, () => evidenceAttachmentId),
    });

    const responseAttachmentId = await insertAttachment(evidenceTest, evidenceFixture, {
      label: "response-25",
    });
    await evidenceTest.mutation(api.disputes.addDisputeResponse, {
      disputeId: evidenceDisputeId,
      responderWallet: evidenceFixture.clientWallet,
      responderWalletType: "external_wallet",
      message: "C08 response",
      attachmentIds: Array.from({ length: 25 }, () => responseAttachmentId),
    });
    const participantRecords = await evidenceTest.run(async (ctx) => ({
      dispute: await ctx.db.get(evidenceDisputeId),
      events: (await ctx.db.query("disputeEvents").collect()).filter(
        (event) => event.disputeId === evidenceDisputeId,
      ),
    }));
    expect(participantRecords.dispute?.evidenceAttachmentIds).toEqual([
      evidenceAttachmentId,
      responseAttachmentId,
    ]);
    expect(participantRecords.events.slice(1).map((event) => event.attachmentIds)).toEqual([
      [evidenceAttachmentId],
      [responseAttachmentId],
    ]);
  });

  it.each([
    { mutation: "create", label: "create" },
    { mutation: "evidence", label: "evidence" },
    { mutation: "response", label: "response" },
  ] as const)("rejects 26 raw repeated attachments for $mutation", async ({ mutation, label }) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: `c08-26-${label}` });
    const attachmentId = await insertAttachment(t, fixture, { label: `26-${label}` });

    if (mutation === "create") {
      await expect(
        createDispute(t, fixture, {
          evidenceAttachmentIds: Array.from({ length: 26 }, () => attachmentId),
        }),
      ).rejects.toThrow(/25 files or fewer/);
      return;
    }

    const disputeId = await createDispute(t, fixture);
    if (mutation === "evidence") {
      await expect(
        t.mutation(api.disputes.addDisputeEvidence, {
          disputeId,
          actorWallet: fixture.clientWallet,
          actorWalletType: "external_wallet",
          attachmentIds: Array.from({ length: 26 }, () => attachmentId),
        }),
      ).rejects.toThrow(/25 files or fewer/);
      return;
    }

    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "C08 response",
        attachmentIds: Array.from({ length: 26 }, () => attachmentId),
      }),
    ).rejects.toThrow(/25 files or fewer/);
  });

  it("accepts exactly 20 repeated IDs in every related-reference array and persists each once", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c08-20-related" });
    const references = await seedDisputeReferences(t, fixture);
    const disputeId = await createDispute(t, fixture, {
      evidenceAttachmentIds: Array.from({ length: 25 }, () => references.attachmentId),
      relatedWorkSubmissionIds: Array.from({ length: 20 }, () => references.submissionId),
      relatedRevisionRequestIds: Array.from({ length: 20 }, () => references.revisionRequestId),
      relatedMessageIds: Array.from({ length: 20 }, () => references.messageId),
      relatedDeadlineEventIds: Array.from({ length: 20 }, () => references.deadlineEventId),
    });
    const dispute = await t.run(async (ctx) => ctx.db.get(disputeId));
    expect(dispute).toMatchObject({
      evidenceAttachmentIds: [references.attachmentId],
      relatedWorkSubmissionIds: [references.submissionId],
      relatedRevisionRequestIds: [references.revisionRequestId],
      relatedMessageIds: [references.messageId],
      relatedDeadlineEventIds: [references.deadlineEventId],
    });
  });

  it.each([
    "relatedWorkSubmissionIds",
    "relatedRevisionRequestIds",
    "relatedMessageIds",
    "relatedDeadlineEventIds",
  ] as const)("rejects 21 repeated IDs in %s before writing", async (field) => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: `c08-21-${field}` });
    const references = await seedDisputeReferences(t, fixture);
    const referenceByField = {
      relatedWorkSubmissionIds: references.submissionId,
      relatedRevisionRequestIds: references.revisionRequestId,
      relatedMessageIds: references.messageId,
      relatedDeadlineEventIds: references.deadlineEventId,
    };
    const before = await snapshotState(t);

    await expect(
      createDispute(t, fixture, {
        [field]: Array.from({ length: 21 }, () => referenceByField[field]),
      }),
    ).rejects.toThrow(/20 records or fewer/);
    expect(await snapshotState(t)).toEqual(before);
  });

  it.each([
    {
      label: "missing",
      prepare: async (t: BackendTest, fixture: DisputeFixture) => {
        const id = await insertAttachment(t, fixture, { label: "missing" });
        await t.run(async (ctx) => ctx.db.delete(id));
        return id;
      },
    },
    {
      label: "wrong-table",
      prepare: async (_t: BackendTest, fixture: DisputeFixture) => {
        return fixture.jobId as unknown as Id<"attachments">;
      },
    },
    {
      label: "inactive",
      prepare: async (t: BackendTest, fixture: DisputeFixture) => {
        return await insertAttachment(t, fixture, { label: "inactive", status: "deleted" });
      },
    },
    {
      label: "foreign-owned",
      prepare: async (t: BackendTest, fixture: DisputeFixture) => {
        return await insertAttachment(t, fixture, { label: "foreign-owned", owner: "client" });
      },
    },
    {
      label: "other-case",
      prepare: async (t: BackendTest, fixture: DisputeFixture) => {
        return await insertAttachment(t, fixture, { label: "other-case", parentType: "job" });
      },
    },
  ])(
    "rejects $label attachment references without changing the case",
    async ({ label, prepare }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `c08-attachment-${label}` });
      const disputeId = await createDispute(t, fixture);
      const attachmentId = await prepare(t, fixture);
      const before = await snapshotState(t);

      await expect(
        t.mutation(api.disputes.addDisputeEvidence, {
          disputeId,
          actorWallet: fixture.freelancerWallet,
          actorWalletType: "passkey_smart_account",
          attachmentIds: [attachmentId],
        }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.disputes.addDisputeResponse, {
          disputeId,
          responderWallet: fixture.freelancerWallet,
          responderWalletType: "passkey_smart_account",
          message: "Rejected attachment response",
          attachmentIds: [attachmentId],
        }),
      ).rejects.toThrow();
      expect(await snapshotState(t)).toEqual(before);
    },
  );

  it("allows a participant to reuse their own attachment already linked to the same dispute", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c08-reuse-same-case" });
    const attachmentId = await insertAttachment(t, fixture, { label: "reuse" });
    const disputeId = await createDispute(t, fixture, {
      evidenceAttachmentIds: [attachmentId],
    });

    await t.mutation(api.disputes.addDisputeEvidence, {
      disputeId,
      actorWallet: fixture.clientWallet,
      actorWalletType: "external_wallet",
      attachmentIds: [attachmentId, attachmentId],
    });
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet",
      message: "Reusing the same evidence.",
      attachmentIds: [attachmentId, attachmentId],
    });

    const records = await t.run(async (ctx) => ({
      dispute: await ctx.db.get(disputeId),
      events: (await ctx.db.query("disputeEvents").collect()).filter(
        (event) => event.disputeId === disputeId,
      ),
    }));
    expect(records.dispute?.evidenceAttachmentIds).toEqual([attachmentId]);
    expect(records.events.slice(1).map((event) => event.attachmentIds)).toEqual([
      [attachmentId],
      [attachmentId],
    ]);
  });

  it("rejects participant/link conflicts, including invalid submissions referenced by revisions", async () => {
    const participantTest = convexTest(schema, modules);
    const participantFixture = await seedDisputeFixture(participantTest, {
      label: "c08-submission-participant",
    });
    const participantReferences = await seedDisputeReferences(participantTest, participantFixture);
    await participantTest.run(async (ctx) =>
      ctx.db.patch(participantReferences.submissionId, {
        clientWallet: participantFixture.unrelatedWallet,
      }),
    );
    await expect(
      createDispute(participantTest, participantFixture, {
        relatedWorkSubmissionIds: [participantReferences.submissionId],
      }),
    ).rejects.toThrow(/participants do not match/);

    const linkTest = convexTest(schema, modules);
    const linkFixture = await seedDisputeFixture(linkTest, { label: "c08-submission-link" });
    const otherFixture = await seedDisputeFixture(linkTest, { label: "c08-other-work" });
    const linkReferences = await seedDisputeReferences(linkTest, linkFixture);
    await linkTest.run(async (ctx) =>
      ctx.db.patch(linkReferences.submissionId, { escrowId: otherFixture.escrowId }),
    );
    await expect(
      createDispute(linkTest, linkFixture, {
        relatedWorkSubmissionIds: [linkReferences.submissionId],
      }),
    ).rejects.toThrow(/escrow link/);

    const revisionTest = convexTest(schema, modules);
    const revisionFixture = await seedDisputeFixture(revisionTest, { label: "c08-revision" });
    const revisionReferences = await seedDisputeReferences(revisionTest, revisionFixture);
    await revisionTest.run(async (ctx) =>
      ctx.db.patch(revisionReferences.revisionRequestId, {
        freelancerWallet: revisionFixture.unrelatedWallet,
      }),
    );
    await expect(
      createDispute(revisionTest, revisionFixture, {
        relatedRevisionRequestIds: [revisionReferences.revisionRequestId],
      }),
    ).rejects.toThrow(/Revision request participants do not match/);
    await revisionTest.run(async (ctx) => {
      await ctx.db.patch(revisionReferences.revisionRequestId, {
        freelancerWallet: revisionFixture.freelancerWallet,
      });
      await ctx.db.delete(revisionReferences.submissionId);
    });
    await expect(
      createDispute(revisionTest, revisionFixture, {
        relatedRevisionRequestIds: [revisionReferences.revisionRequestId],
      }),
    ).rejects.toThrow(/Work submission not found/);
  });

  it("requires available messages, matching conversation/work links, both participants, and exact deadline parents", async () => {
    const hiddenTest = convexTest(schema, modules);
    const hiddenFixture = await seedDisputeFixture(hiddenTest, { label: "c08-hidden-message" });
    const hiddenReferences = await seedDisputeReferences(hiddenTest, hiddenFixture);
    await hiddenTest.run(async (ctx) =>
      ctx.db.patch(hiddenReferences.messageId, { status: "hidden" }),
    );
    await expect(
      createDispute(hiddenTest, hiddenFixture, {
        relatedMessageIds: [hiddenReferences.messageId],
      }),
    ).rejects.toThrow(/Message not found/);

    const parentLinkTest = convexTest(schema, modules);
    const parentLinkFixture = await seedDisputeFixture(parentLinkTest, {
      label: "c08-message-parent-link",
    });
    const parentLinkReferences = await seedDisputeReferences(parentLinkTest, parentLinkFixture);
    await parentLinkTest.run(async (ctx) =>
      ctx.db.patch(parentLinkReferences.messageId, { parentId: parentLinkFixture.jobId }),
    );
    await expect(
      createDispute(parentLinkTest, parentLinkFixture, {
        relatedMessageIds: [parentLinkReferences.messageId],
      }),
    ).rejects.toThrow(/parent links do not match/);

    const workLinkTest = convexTest(schema, modules);
    const workLinkFixture = await seedDisputeFixture(workLinkTest, {
      label: "c08-message-work-link",
    });
    const otherWorkLinkFixture = await seedDisputeFixture(workLinkTest, {
      label: "c08-message-other-work",
    });
    const workLinkReferences = await seedDisputeReferences(workLinkTest, workLinkFixture);
    await workLinkTest.run(async (ctx) => {
      await ctx.db.patch(workLinkReferences.conversationId, {
        parentType: "job",
        parentId: otherWorkLinkFixture.jobId,
      });
      await ctx.db.patch(workLinkReferences.messageId, {
        parentType: "job",
        parentId: otherWorkLinkFixture.jobId,
      });
    });
    await expect(
      createDispute(workLinkTest, workLinkFixture, {
        relatedMessageIds: [workLinkReferences.messageId],
      }),
    ).rejects.toThrow(/Conversation is linked to a different job/);

    const participantsTest = convexTest(schema, modules);
    const participantsFixture = await seedDisputeFixture(participantsTest, {
      label: "c08-message-participants",
    });
    const participantsReferences = await seedDisputeReferences(
      participantsTest,
      participantsFixture,
    );
    await participantsTest.run(async (ctx) =>
      ctx.db.patch(participantsReferences.conversationId, {
        participantWallets: [participantsFixture.clientWallet],
      }),
    );
    await expect(
      createDispute(participantsTest, participantsFixture, {
        relatedMessageIds: [participantsReferences.messageId],
      }),
    ).rejects.toThrow(/both dispute participants/);

    const deadlineTest = convexTest(schema, modules);
    const deadlineFixture = await seedDisputeFixture(deadlineTest, {
      parentType: "milestone",
      label: "c08-deadline-parent",
    });
    const deadlineReferences = await seedDisputeReferences(deadlineTest, deadlineFixture);
    const siblingMilestoneId = await deadlineTest.run(async (ctx) =>
      ctx.db.insert("milestones", {
        jobId: deadlineFixture.jobId,
        order: 2,
        title: "C08 sibling milestone",
        amount: 500,
        asset: "USDC",
        status: "funded",
        assignedFreelancerWallet: deadlineFixture.freelancerWallet,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    await deadlineTest.run(async (ctx) =>
      ctx.db.patch(deadlineReferences.deadlineEventId, { parentId: siblingMilestoneId }),
    );
    await expect(
      createDispute(deadlineTest, deadlineFixture, {
        relatedDeadlineEventIds: [deadlineReferences.deadlineEventId],
      }),
    ).rejects.toThrow(/different work parent/);
  });

  it("rejects unrelated actors and terminal-case evidence or response writes", async () => {
    const unrelatedTest = convexTest(schema, modules);
    const unrelatedFixture = await seedDisputeFixture(unrelatedTest, { label: "c08-unrelated" });
    const unrelatedDisputeId = await createDispute(unrelatedTest, unrelatedFixture);
    const unrelatedBefore = await snapshotState(unrelatedTest);
    await expect(
      unrelatedTest.mutation(api.disputes.addDisputeEvidence, {
        disputeId: unrelatedDisputeId,
        actorWallet: unrelatedFixture.unrelatedWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [],
      }),
    ).rejects.toThrow(/Only the client or assigned freelancer/);
    await expect(
      unrelatedTest.mutation(api.disputes.addDisputeResponse, {
        disputeId: unrelatedDisputeId,
        responderWallet: unrelatedFixture.unrelatedWallet,
        responderWalletType: "external_wallet",
        message: "Unauthorized response",
      }),
    ).rejects.toThrow(/Only the client or assigned freelancer/);
    expect(await snapshotState(unrelatedTest)).toEqual(unrelatedBefore);

    const terminalTest = convexTest(schema, modules);
    const terminalFixture = await seedDisputeFixture(terminalTest, { label: "c08-terminal" });
    const terminalDisputeId = await createDispute(terminalTest, terminalFixture);
    await terminalTest.run(async (ctx) => ctx.db.patch(terminalDisputeId, { status: "cancelled" }));
    const terminalAttachmentId = await insertAttachment(terminalTest, terminalFixture, {
      label: "terminal",
    });
    const terminalBefore = await snapshotState(terminalTest);
    await expect(
      terminalTest.mutation(api.disputes.addDisputeEvidence, {
        disputeId: terminalDisputeId,
        actorWallet: terminalFixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [terminalAttachmentId],
      }),
    ).rejects.toThrow(/not accepting new responses/);
    await expect(
      terminalTest.mutation(api.disputes.addDisputeResponse, {
        disputeId: terminalDisputeId,
        responderWallet: terminalFixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "Terminal response",
      }),
    ).rejects.toThrow(/not accepting new responses/);
    expect(await snapshotState(terminalTest)).toEqual(terminalBefore);
  });

  it("leaves the complete document graph unchanged when creation or participant writes mix valid and invalid inputs", async () => {
    const creationTest = convexTest(schema, modules);
    const creationFixture = await seedDisputeFixture(creationTest, { label: "c08-atomic-create" });
    const creationReferences = await seedDisputeReferences(creationTest, creationFixture);
    await seedAcceptedDisputeAgreement(creationTest, creationFixture);
    const creationBefore = await snapshotState(creationTest);
    await expect(
      createDispute(creationTest, creationFixture, {
        evidenceAttachmentIds: [creationReferences.attachmentId],
        relatedWorkSubmissionIds: [
          creationReferences.submissionId,
          creationFixture.jobId as unknown as Id<"workSubmissions">,
        ],
        relatedRevisionRequestIds: [creationReferences.revisionRequestId],
        relatedMessageIds: [creationReferences.messageId],
        relatedDeadlineEventIds: [creationReferences.deadlineEventId],
      }),
    ).rejects.toThrow();
    expect(await snapshotState(creationTest)).toEqual(creationBefore);

    const participantTest = convexTest(schema, modules);
    const participantFixture = await seedDisputeFixture(participantTest, {
      label: "c08-atomic-participant",
    });
    const participantDisputeId = await createDispute(participantTest, participantFixture);
    const validAttachmentId = await insertAttachment(participantTest, participantFixture, {
      label: "atomic-valid",
    });
    const invalidAttachmentId = await insertAttachment(participantTest, participantFixture, {
      label: "atomic-invalid",
      status: "deleted",
    });
    const participantBefore = await snapshotState(participantTest);
    await expect(
      participantTest.mutation(api.disputes.addDisputeEvidence, {
        disputeId: participantDisputeId,
        actorWallet: participantFixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [validAttachmentId],
        message: "   ",
      }),
    ).rejects.toThrow(/message/i);
    await expect(
      participantTest.mutation(api.disputes.addDisputeResponse, {
        disputeId: participantDisputeId,
        responderWallet: participantFixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "\n",
        attachmentIds: [validAttachmentId],
      }),
    ).rejects.toThrow(/message/i);
    expect(await snapshotState(participantTest)).toEqual(participantBefore);
    await expect(
      participantTest.mutation(api.disputes.addDisputeEvidence, {
        disputeId: participantDisputeId,
        actorWallet: participantFixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [validAttachmentId, invalidAttachmentId],
        message: "Mixed evidence",
      }),
    ).rejects.toThrow();
    await expect(
      participantTest.mutation(api.disputes.addDisputeResponse, {
        disputeId: participantDisputeId,
        responderWallet: participantFixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "Mixed response",
        attachmentIds: [validAttachmentId, invalidAttachmentId],
      }),
    ).rejects.toThrow();
    expect(await snapshotState(participantTest)).toEqual(participantBefore);
  });
});
