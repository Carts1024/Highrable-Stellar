import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  seedDisputeFixture,
  seedDisputeReferences,
  seedSiblingMilestoneFixture,
  snapshotDisputeCreationState,
  type BackendTest,
  type DisputeFixture,
} from "../fixtures/disputes";

const PARENT_TYPES = ["micro_gig", "milestone"] as const;
const PARTICIPANT_ROLES = ["client", "freelancer"] as const;
const WALLET_TYPES = ["external_wallet", "passkey_smart_account"] as const;
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
const C22_NOW = 1_768_481_000_000;

type ParentType = (typeof PARENT_TYPES)[number];
type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
type WalletType = (typeof WALLET_TYPES)[number];
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

type AuthorizedJourney = {
  status: ActiveStatus;
  parentType: ParentType;
  actorRole: ParticipantRole;
  walletType: WalletType;
};

const AUTHORIZED_JOURNEYS: AuthorizedJourney[] = [
  { status: "open", parentType: "micro_gig", actorRole: "client", walletType: "external_wallet" },
  {
    status: "open",
    parentType: "milestone",
    actorRole: "freelancer",
    walletType: "passkey_smart_account",
  },
  {
    status: "under_review",
    parentType: "micro_gig",
    actorRole: "freelancer",
    walletType: "external_wallet",
  },
  {
    status: "under_review",
    parentType: "milestone",
    actorRole: "client",
    walletType: "passkey_smart_account",
  },
  {
    status: "awaiting_client_response",
    parentType: "micro_gig",
    actorRole: "client",
    walletType: "passkey_smart_account",
  },
  {
    status: "awaiting_client_response",
    parentType: "milestone",
    actorRole: "freelancer",
    walletType: "external_wallet",
  },
  {
    status: "awaiting_freelancer_response",
    parentType: "micro_gig",
    actorRole: "freelancer",
    walletType: "passkey_smart_account",
  },
  {
    status: "awaiting_freelancer_response",
    parentType: "milestone",
    actorRole: "client",
    walletType: "external_wallet",
  },
];

type CreateDisputeOverrides = Partial<{
  parentType: "micro_gig" | "milestone" | "escrow" | "job";
  parentId: string;
  openedByWallet: string;
  openedByWalletType: WalletType;
  evidenceAttachmentIds: Id<"attachments">[];
  relatedWorkSubmissionIds: Id<"workSubmissions">[];
  relatedRevisionRequestIds: Id<"revisionRequests">[];
  relatedMessageIds: Id<"messages">[];
  relatedDeadlineEventIds: Id<"deadlineAuditEvents">[];
}>;

function walletForRole(fixture: DisputeFixture, role: ParticipantRole) {
  return role === "client" ? fixture.clientWallet : fixture.freelancerWallet;
}

function oppositeWallet(fixture: DisputeFixture, role: ParticipantRole) {
  return role === "client" ? fixture.freelancerWallet : fixture.clientWallet;
}

async function createDispute(
  t: BackendTest,
  fixture: DisputeFixture,
  overrides: CreateDisputeOverrides = {},
) {
  return await t.mutation(api.disputes.createDispute, {
    parentType: overrides.parentType ?? fixture.parentType,
    parentId: overrides.parentId ?? fixture.parentId,
    openedByWallet: overrides.openedByWallet ?? fixture.clientWallet,
    openedByWalletType: overrides.openedByWalletType ?? "external_wallet",
    reasonCategory: "work_not_delivered",
    title: "C22 participant acceptance case",
    description: "C22 connected journey fixture.",
    ...(overrides.evidenceAttachmentIds !== undefined
      ? { evidenceAttachmentIds: overrides.evidenceAttachmentIds }
      : {}),
    ...(overrides.relatedWorkSubmissionIds !== undefined
      ? { relatedWorkSubmissionIds: overrides.relatedWorkSubmissionIds }
      : {}),
    ...(overrides.relatedRevisionRequestIds !== undefined
      ? { relatedRevisionRequestIds: overrides.relatedRevisionRequestIds }
      : {}),
    ...(overrides.relatedMessageIds !== undefined
      ? { relatedMessageIds: overrides.relatedMessageIds }
      : {}),
    ...(overrides.relatedDeadlineEventIds !== undefined
      ? { relatedDeadlineEventIds: overrides.relatedDeadlineEventIds }
      : {}),
  });
}

async function insertParticipantAttachment(
  t: BackendTest,
  fixture: DisputeFixture,
  role: ParticipantRole,
  label: string,
  walletType: WalletType = "external_wallet",
  protectedPreview = false,
) {
  return await t.run(async (ctx) => {
    const uploadedByWallet = walletForRole(fixture, role);
    return await ctx.db.insert("attachments", {
      type: "file",
      name: `${label}.txt`,
      size: 10,
      mimeType: "text/plain",
      uploadedByWallet,
      uploadedByWalletType: walletType,
      ownerRole: role,
      parentType: "unknown",
      visibility: "private",
      status: "active",
      ...(protectedPreview
        ? {
            protectionMode: "protected_preview" as const,
            downloadAllowed: false,
            previewAllowed: true,
            watermarkEnabled: true,
            accessLoggingEnabled: true,
          }
        : {}),
      createdAt: C22_NOW,
      updatedAt: C22_NOW,
    });
  });
}

async function caseEvents(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(
    async (ctx) =>
      await ctx.db
        .query("disputeEvents")
        .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
        .order("asc")
        .collect(),
  );
}

async function caseNotifications(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("notifications").collect()).filter((notification) => {
      const metadata = notification.metadata;
      return (
        typeof metadata === "object" &&
        metadata !== null &&
        (metadata as { disputeId?: Id<"disputes"> }).disputeId === disputeId
      );
    }),
  );
}

async function snapshotCase(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async (ctx) => ({
    dispute: await ctx.db.get(disputeId),
    events: await ctx.db
      .query("disputeEvents")
      .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
      .collect(),
    attachments: await ctx.db
      .query("attachments")
      .withIndex("by_parent", (q) => q.eq("parentType", "dispute").eq("parentId", disputeId))
      .collect(),
    notifications: (await ctx.db.query("notifications").collect()).filter((notification) => {
      const metadata = notification.metadata;
      return (
        typeof metadata === "object" &&
        metadata !== null &&
        (metadata as { disputeId?: Id<"disputes"> }).disputeId === disputeId
      );
    }),
  }));
}

async function expectCurrentParticipantReads(
  t: BackendTest,
  fixture: DisputeFixture,
  disputeId: Id<"disputes">,
) {
  for (const [role, wallet] of [
    ["client", fixture.clientWallet],
    ["freelancer", fixture.freelancerWallet],
  ] as const) {
    await expect(
      t.query(api.disputes.getDispute, { disputeId, viewerWallet: wallet }),
    ).resolves.toMatchObject({
      _id: disputeId,
    });
    await expect(
      t.query(api.disputes.canViewDispute, { disputeId, viewerWallet: wallet }),
    ).resolves.toMatchObject({ allowed: true, role });
    await expect(
      t.query(api.disputes.canRespondToDispute, { disputeId, walletAddress: wallet }),
    ).resolves.toMatchObject({ allowed: true, role });
  }
}

async function expectStaleParticipantAccess(
  t: BackendTest,
  fixture: DisputeFixture,
  disputeId: Id<"disputes">,
  attachmentId: Id<"attachments">,
  wallets: string[],
) {
  for (const wallet of wallets) {
    await expect(
      t.query(api.disputes.getDispute, { disputeId, viewerWallet: wallet }),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDisputeByParent, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        viewerWallet: wallet,
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.disputes.getActiveDisputeForEscrow, {
        escrowId: fixture.escrowId,
        viewerWallet: wallet,
      }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.disputes.getDisputesForWallet, { walletAddress: wallet }),
    ).resolves.toEqual([]);
    await expect(
      t.query(api.disputes.getDisputeTimeline, { disputeId, viewerWallet: wallet }),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDisputeEvidence, { disputeId, viewerWallet: wallet }),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.canViewDispute, { disputeId, viewerWallet: wallet }),
    ).resolves.toMatchObject({ allowed: false, role: null });
    await expect(
      t.query(api.disputes.canRespondToDispute, { disputeId, walletAddress: wallet }),
    ).resolves.toMatchObject({ allowed: false, role: null });
    await expect(
      t.query(api.attachments.listByParent, {
        parentType: "dispute",
        parentId: disputeId,
        viewerWallet: wallet,
      }),
    ).resolves.toEqual([]);
    await expect(
      t.query(api.attachments.getById, { attachmentId, viewerWallet: wallet }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getManyByIds, {
        attachmentIds: [attachmentId],
        viewerWallet: wallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getProtectedAttachment, { attachmentId, viewerWallet: wallet }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getAttachmentProtectionSettings, {
        attachmentId,
        viewerWallet: wallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getAttachmentAccessLogs, { attachmentId, viewerWallet: wallet }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getAttachmentAccessPolicy, { attachmentId, viewerWallet: wallet }),
    ).resolves.toMatchObject({ canView: false, canPreview: false, canDownload: false });
    await expect(
      t.query(api.attachments.canPreviewAttachment, { attachmentId, viewerWallet: wallet }),
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      t.query(api.attachments.canDownloadAttachment, { attachmentId, viewerWallet: wallet }),
    ).resolves.toMatchObject({ allowed: false });
  }
}

describe("C22 participant backend acceptance matrix", () => {
  it.each(AUTHORIZED_JOURNEYS)(
    "completes a connected $actorRole/$parentType/$status journey with $walletType bookkeeping",
    async ({ status, parentType, actorRole, walletType }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c22-authorized-${status}-${parentType}-${actorRole}-${walletType}`,
      });
      const disputeId = await createDispute(t, fixture);
      const actorWallet = walletForRole(fixture, actorRole);
      const recipientWallet = oppositeWallet(fixture, actorRole);
      const evidenceAttachmentId = await insertParticipantAttachment(
        t,
        fixture,
        actorRole,
        "c22-authorized-evidence",
        walletType,
      );
      const responseAttachmentId = await insertParticipantAttachment(
        t,
        fixture,
        actorRole,
        "c22-authorized-response",
        walletType,
      );

      await t.run(async (ctx) => ctx.db.patch(disputeId, { status }));
      await expectCurrentParticipantReads(t, fixture, disputeId);

      await expect(
        t.mutation(api.disputes.addDisputeEvidence, {
          disputeId,
          actorWallet,
          actorWalletType: walletType,
          attachmentIds: [evidenceAttachmentId],
          message: `${actorRole} evidence for ${status}.`,
        }),
      ).resolves.toBe(true);
      await expect(
        t.mutation(api.disputes.addDisputeResponse, {
          disputeId,
          responderWallet: actorWallet,
          responderWalletType: walletType,
          attachmentIds: [responseAttachmentId],
          message: `${actorRole} response for ${status}.`,
          requestId: `c22-${status}-${parentType}-${actorRole}-${walletType}`,
        }),
      ).resolves.toBe(true);

      const events = await caseEvents(t, disputeId);
      expect(events.map((event) => event.type)).toEqual([
        "dispute_opened",
        "evidence_added",
        actorRole === "client" ? "client_response_added" : "freelancer_response_added",
      ]);
      expect(events[1]).toMatchObject({
        actorWallet,
        actorWalletType: walletType,
        actorRole,
        attachmentIds: [evidenceAttachmentId],
      });
      expect(events[2]).toMatchObject({
        actorWallet,
        actorWalletType: walletType,
        actorRole,
        attachmentIds: [responseAttachmentId],
      });

      const notifications = await caseNotifications(t, disputeId);
      expect(
        notifications.map((notification) => [notification.type, notification.recipientWallet]),
      ).toEqual([
        ["dispute_opened", fixture.freelancerWallet],
        ["dispute_evidence_added", recipientWallet],
        ["dispute_response_added", recipientWallet],
      ]);

      const evidence = await t.query(api.disputes.getDisputeEvidence, {
        disputeId,
        viewerWallet: fixture.clientWallet,
      });
      expect(evidence.map((attachment) => attachment._id)).toEqual([
        evidenceAttachmentId,
        responseAttachmentId,
      ]);
      const timeline = await t.query(api.disputes.getDisputeTimeline, {
        disputeId,
        viewerWallet: fixture.freelancerWallet,
      });
      expect(timeline.map((event) => event.type)).toEqual(events.map((event) => event.type));
      expect(timeline[1]?.attachments.map((attachment) => attachment._id)).toEqual([
        evidenceAttachmentId,
      ]);
      expect(timeline[2]?.attachments.map((attachment) => attachment._id)).toEqual([
        responseAttachmentId,
      ]);
      await expect(
        t.query(api.disputes.getDisputeByParent, {
          parentType,
          parentId: fixture.parentId,
          viewerWallet: actorWallet,
        }),
      ).resolves.toMatchObject({ _id: disputeId, status });
      await expect(
        t.query(api.disputes.getActiveDisputeForEscrow, {
          escrowId: fixture.escrowId,
          viewerWallet: actorWallet,
        }),
      ).resolves.toMatchObject({ _id: disputeId, status });
      expect(
        await t.query(api.disputes.getDisputesForWallet, { walletAddress: actorWallet }),
      ).toEqual([expect.objectContaining({ _id: disputeId, status })]);
    },
  );

  it.each(["reassignment", "deleted_parent", "conflicting_link"] as const)(
    "denies all stale participant and attachment reads after %s",
    async (staleCondition) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `c22-stale-${staleCondition}` });
      const disputeId = await createDispute(t, fixture);
      const attachmentId = await insertParticipantAttachment(
        t,
        fixture,
        "client",
        `c22-stale-${staleCondition}`,
        "external_wallet",
        true,
      );
      await t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [attachmentId],
      });
      await expect(
        t.query(api.disputes.getDispute, { disputeId, viewerWallet: fixture.clientWallet }),
      ).resolves.toMatchObject({
        _id: disputeId,
      });
      await expect(
        t.mutation(api.attachments.recordProtectedPreviewOpened, {
          attachmentId,
          viewerWallet: fixture.clientWallet,
          viewerWalletType: "external_wallet",
          sessionId: `c22-${staleCondition}`,
        }),
      ).resolves.toMatchObject({ attachment: { _id: attachmentId } });

      const replacementWallet = "GREPLACEDC22";
      if (staleCondition === "reassignment") {
        await t.run(async (ctx) => {
          await ctx.db.patch(fixture.jobId, {
            selectedFreelancerWallet: replacementWallet,
          });
          await ctx.db.patch(fixture.escrowId, {
            freelancerWallet: replacementWallet,
          });
        });
      } else if (staleCondition === "deleted_parent") {
        await t.run(async (ctx) => ctx.db.delete(fixture.jobId));
      } else {
        const conflictingFixture = await seedDisputeFixture(t, {
          label: "c22-stale-conflicting-parent",
        });
        await t.run(async (ctx) => ctx.db.patch(disputeId, { jobId: conflictingFixture.jobId }));
      }

      const wallets = [
        fixture.clientWallet,
        fixture.freelancerWallet,
        fixture.unrelatedWallet,
        ...(staleCondition === "reassignment" ? [replacementWallet] : []),
      ];
      await expectStaleParticipantAccess(t, fixture, disputeId, attachmentId, wallets);
      await expect(
        t.mutation(api.disputes.addDisputeEvidence, {
          disputeId,
          actorWallet: fixture.clientWallet,
          actorWalletType: "external_wallet",
          attachmentIds: [attachmentId],
        }),
      ).rejects.toThrow();
      await expect(
        t.mutation(api.disputes.addDisputeResponse, {
          disputeId,
          responderWallet: fixture.freelancerWallet,
          responderWalletType: "passkey_smart_account",
          message: "Stale C22 response.",
          requestId: `c22-stale-${staleCondition}`,
        }),
      ).rejects.toThrow();
    },
  );

  it("rejects foreign and revoked attachment mixtures atomically with a complete graph snapshot", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c22-atomic" });
    const disputeId = await createDispute(t, fixture);
    const validAttachmentId = await insertParticipantAttachment(
      t,
      fixture,
      "client",
      "c22-atomic-valid",
      "external_wallet",
      true,
    );
    const foreignAttachmentId = await insertParticipantAttachment(
      t,
      fixture,
      "freelancer",
      "c22-atomic-foreign",
    );
    await expect(
      t.mutation(api.attachments.recordProtectedPreviewOpened, {
        attachmentId: validAttachmentId,
        viewerWallet: fixture.clientWallet,
        viewerWalletType: "external_wallet",
        sessionId: "c22-atomic-before",
      }),
    ).resolves.toMatchObject({ attachment: { _id: validAttachmentId } });

    const beforeForeignEvidence = await snapshotDisputeCreationState(t);
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [validAttachmentId, foreignAttachmentId],
        message: "This mixed evidence must be rejected.",
      }),
    ).rejects.toThrow("owned by another wallet");
    expect(await snapshotDisputeCreationState(t)).toEqual(beforeForeignEvidence);

    const revokedAttachmentId = await insertParticipantAttachment(
      t,
      fixture,
      "client",
      "c22-atomic-revoked",
    );
    await t.run(async (ctx) => ctx.db.patch(revokedAttachmentId, { status: "deleted" }));
    const beforeRevokedResponse = await snapshotDisputeCreationState(t);
    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "passkey_smart_account",
        attachmentIds: [validAttachmentId, revokedAttachmentId],
        message: "This mixed response must be rejected.",
        requestId: "c22-atomic-revoked-response",
      }),
    ).rejects.toThrow("Attachment not found");
    expect(await snapshotDisputeCreationState(t)).toEqual(beforeRevokedResponse);
  });

  it("isolates independent cases and sibling milestones, including related-record references", async () => {
    const t = convexTest(schema, modules);
    const microFixture = await seedDisputeFixture(t, { label: "c22-parent-micro" });
    const secondMicroFixture = await seedDisputeFixture(t, { label: "c22-parent-second-micro" });
    const milestoneFixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "c22-parent-milestone",
    });
    const sibling = await seedSiblingMilestoneFixture(t, milestoneFixture, {
      label: "c22-parent-sibling",
    });
    const microReferences = await seedDisputeReferences(t, microFixture);

    const beforeInvalidReference = await snapshotDisputeCreationState(t);
    await expect(
      createDispute(t, milestoneFixture, {
        relatedWorkSubmissionIds: [microReferences.submissionId],
      }),
    ).rejects.toThrow("does not identify the selected milestone");
    expect(await snapshotDisputeCreationState(t)).toEqual(beforeInvalidReference);

    const microDisputeId = await createDispute(t, microFixture);
    const secondMicroDisputeId = await createDispute(t, secondMicroFixture);
    const milestoneDisputeId = await createDispute(t, milestoneFixture);
    const siblingDisputeId = await createDispute(t, milestoneFixture, {
      parentType: "milestone",
      parentId: sibling.milestoneId,
    });
    const mainAttachmentId = await insertParticipantAttachment(
      t,
      microFixture,
      "client",
      "c22-parent-main",
    );
    await t.mutation(api.disputes.addDisputeEvidence, {
      disputeId: microDisputeId,
      actorWallet: microFixture.clientWallet,
      actorWalletType: "external_wallet",
      attachmentIds: [mainAttachmentId],
    });

    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId: secondMicroDisputeId,
        actorWallet: secondMicroFixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [mainAttachmentId],
      }),
    ).rejects.toThrow("already linked to another record");
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId: milestoneDisputeId,
        actorWallet: milestoneFixture.clientWallet,
        actorWalletType: "passkey_smart_account",
        attachmentIds: [mainAttachmentId],
      }),
    ).rejects.toThrow("already linked to another record");

    const siblingBefore = await snapshotCase(t, siblingDisputeId);
    const siblingCrossCaseBefore = await snapshotCase(t, siblingDisputeId);
    const milestoneEvidenceId = await insertParticipantAttachment(
      t,
      milestoneFixture,
      "freelancer",
      "c22-parent-milestone-evidence",
      "passkey_smart_account",
    );
    const milestoneResponseId = await insertParticipantAttachment(
      t,
      milestoneFixture,
      "freelancer",
      "c22-parent-milestone-response",
      "passkey_smart_account",
    );
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId: milestoneDisputeId,
        actorWallet: milestoneFixture.freelancerWallet,
        actorWalletType: "passkey_smart_account",
        attachmentIds: [milestoneEvidenceId],
      }),
    ).resolves.toBe(true);
    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId: milestoneDisputeId,
        responderWallet: milestoneFixture.freelancerWallet,
        responderWalletType: "passkey_smart_account",
        attachmentIds: [milestoneResponseId],
        message: "Main milestone response.",
        requestId: "c22-parent-main-response",
      }),
    ).resolves.toBe(true);
    expect(await snapshotCase(t, siblingDisputeId)).toEqual(siblingBefore);

    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId: siblingDisputeId,
        actorWallet: milestoneFixture.freelancerWallet,
        actorWalletType: "passkey_smart_account",
        attachmentIds: [milestoneEvidenceId],
      }),
    ).rejects.toThrow("already linked to another record");
    expect(await snapshotCase(t, siblingDisputeId)).toEqual(siblingCrossCaseBefore);
    expect(
      await t.query(api.disputes.getDisputeEvidence, {
        disputeId: siblingDisputeId,
        viewerWallet: milestoneFixture.clientWallet,
      }),
    ).toEqual([]);
    expect(
      await t.query(api.disputes.getDisputeTimeline, {
        disputeId: siblingDisputeId,
        viewerWallet: milestoneFixture.clientWallet,
      }),
    ).toHaveLength(1);
  });

  it("keeps wallet and case responses isolated across independent cases", async () => {
    const t = convexTest(schema, modules);
    const firstFixture = await seedDisputeFixture(t, { label: "c22-isolation-first" });
    const secondFixture = await seedDisputeFixture(t, { label: "c22-isolation-second" });
    const firstDisputeId = await createDispute(t, firstFixture);
    const secondDisputeId = await createDispute(t, secondFixture);
    const firstAttachmentId = await insertParticipantAttachment(
      t,
      firstFixture,
      "client",
      "c22-isolation-first",
    );
    const secondAttachmentId = await insertParticipantAttachment(
      t,
      secondFixture,
      "freelancer",
      "c22-isolation-second",
      "passkey_smart_account",
    );

    await t.mutation(api.disputes.addDisputeEvidence, {
      disputeId: firstDisputeId,
      actorWallet: firstFixture.clientWallet,
      actorWalletType: "external_wallet",
      attachmentIds: [firstAttachmentId],
    });
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId: firstDisputeId,
      responderWallet: firstFixture.clientWallet,
      responderWalletType: "external_wallet",
      message: "First case response.",
      requestId: "c22-isolation-first-response",
    });
    await t.mutation(api.disputes.addDisputeEvidence, {
      disputeId: secondDisputeId,
      actorWallet: secondFixture.freelancerWallet,
      actorWalletType: "passkey_smart_account",
      attachmentIds: [secondAttachmentId],
    });
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId: secondDisputeId,
      responderWallet: secondFixture.freelancerWallet,
      responderWalletType: "passkey_smart_account",
      message: "Second case response.",
      requestId: "c22-isolation-second-response",
    });

    for (const [
      fixture,
      disputeId,
      ownAttachmentId,
      otherAttachmentId,
      ownMessage,
      otherMessage,
    ] of [
      [
        firstFixture,
        firstDisputeId,
        firstAttachmentId,
        secondAttachmentId,
        "First case response.",
        "Second case response.",
      ],
      [
        secondFixture,
        secondDisputeId,
        secondAttachmentId,
        firstAttachmentId,
        "Second case response.",
        "First case response.",
      ],
    ] as const) {
      for (const wallet of [fixture.clientWallet, fixture.freelancerWallet]) {
        await expect(
          t.query(api.disputes.getDispute, { disputeId, viewerWallet: wallet }),
        ).resolves.toMatchObject({ _id: disputeId });
        const evidence = await t.query(api.disputes.getDisputeEvidence, {
          disputeId,
          viewerWallet: wallet,
        });
        expect(evidence.map((attachment) => attachment._id)).toEqual([ownAttachmentId]);
        expect(evidence.map((attachment) => attachment._id)).not.toContain(otherAttachmentId);
        const timeline = await t.query(api.disputes.getDisputeTimeline, {
          disputeId,
          viewerWallet: wallet,
        });
        expect(timeline.every((event) => event.disputeId === disputeId)).toBe(true);
        expect(timeline.map((event) => event.message)).toContain(ownMessage);
        expect(timeline.map((event) => event.message)).not.toContain(otherMessage);
      }
      await expect(
        t.query(api.disputes.getDispute, {
          disputeId,
          viewerWallet: fixture.unrelatedWallet,
        }),
      ).rejects.toThrow();
      await expect(
        t.query(api.disputes.getDisputeTimeline, {
          disputeId,
          viewerWallet: fixture.unrelatedWallet,
        }),
      ).rejects.toThrow();
      await expect(
        t.query(api.disputes.getDisputeEvidence, {
          disputeId,
          viewerWallet: fixture.unrelatedWallet,
        }),
      ).rejects.toThrow();
    }

    expect(
      (
        await t.query(api.disputes.getDisputesForWallet, {
          walletAddress: firstFixture.clientWallet,
        })
      ).map((dispute) => dispute._id),
    ).toEqual(expect.arrayContaining([firstDisputeId, secondDisputeId]));
    await expect(
      t.query(api.disputes.getDisputeByParent, {
        parentType: firstFixture.parentType,
        parentId: firstFixture.parentId,
        viewerWallet: firstFixture.clientWallet,
      }),
    ).resolves.toMatchObject({ _id: firstDisputeId });
    await expect(
      t.query(api.disputes.getDisputeByParent, {
        parentType: secondFixture.parentType,
        parentId: secondFixture.parentId,
        viewerWallet: firstFixture.clientWallet,
      }),
    ).resolves.toMatchObject({ _id: secondDisputeId });
  });

  it.each(TERMINAL_STATUSES)(
    "preserves readable history but rejects writes and active lookups in terminal %s",
    async (status: TerminalStatus) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `c22-terminal-${status}` });
      const disputeId = await createDispute(t, fixture);
      const responseAttachmentId = await insertParticipantAttachment(
        t,
        fixture,
        "client",
        `c22-terminal-response-${status}`,
      );
      const acceptedResponse = {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet" as const,
        attachmentIds: [responseAttachmentId],
        message: `Accepted before ${status}.`,
        requestId: `c22-terminal-replay-${status}`,
      };
      await t.mutation(api.disputes.addDisputeResponse, acceptedResponse);
      await t.run(async (ctx) => ctx.db.patch(disputeId, { status }));

      await expect(
        t.query(api.disputes.getDispute, { disputeId, viewerWallet: fixture.clientWallet }),
      ).resolves.toMatchObject({ _id: disputeId, status });
      await expect(
        t.query(api.disputes.getDisputeTimeline, {
          disputeId,
          viewerWallet: fixture.freelancerWallet,
        }),
      ).resolves.toHaveLength(2);
      await expect(
        t.query(api.disputes.getDisputeEvidence, {
          disputeId,
          viewerWallet: fixture.clientWallet,
        }),
      ).resolves.toHaveLength(1);
      await expect(
        t.query(api.disputes.canViewDispute, {
          disputeId,
          viewerWallet: fixture.freelancerWallet,
        }),
      ).resolves.toMatchObject({ allowed: true, role: "freelancer" });
      await expect(
        t.query(api.disputes.canRespondToDispute, {
          disputeId,
          walletAddress: fixture.clientWallet,
        }),
      ).resolves.toMatchObject({ allowed: false, role: null });
      await expect(
        t.query(api.disputes.getDisputeByParent, {
          parentType: fixture.parentType,
          parentId: fixture.parentId,
          viewerWallet: fixture.clientWallet,
        }),
      ).resolves.toBeNull();
      await expect(
        t.query(api.disputes.getActiveDisputeForEscrow, {
          escrowId: fixture.escrowId,
          viewerWallet: fixture.clientWallet,
        }),
      ).resolves.toBeNull();
      expect(
        await t.query(api.disputes.getDisputesForWallet, {
          walletAddress: fixture.clientWallet,
        }),
      ).toEqual([expect.objectContaining({ _id: disputeId, status })]);

      const evidenceAttachmentId = await insertParticipantAttachment(
        t,
        fixture,
        "client",
        `c22-terminal-evidence-${status}`,
      );
      const beforeTerminalRejections = await snapshotDisputeCreationState(t);
      await expect(
        t.mutation(api.disputes.addDisputeEvidence, {
          disputeId,
          actorWallet: fixture.clientWallet,
          actorWalletType: "passkey_smart_account",
          attachmentIds: [evidenceAttachmentId],
        }),
      ).rejects.toThrow("not accepting new responses");
      await expect(t.mutation(api.disputes.addDisputeResponse, acceptedResponse)).rejects.toThrow(
        "not accepting new responses",
      );
      expect(await snapshotDisputeCreationState(t)).toEqual(beforeTerminalRejections);

      const replacementWallet = `GTERMINALREPLACED${status.replaceAll("_", "").toUpperCase()}`;
      await t.run(async (ctx) => {
        await ctx.db.patch(fixture.jobId, {
          selectedFreelancerWallet: replacementWallet,
        });
        await ctx.db.patch(fixture.escrowId, {
          freelancerWallet: replacementWallet,
        });
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
    },
  );
});
