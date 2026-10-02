import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import { seedDisputeFixture, seedDisputeReferences } from "../fixtures/disputes";

describe("C19 participant evidence and responses", () => {
  it("accepts participant-owned evidence and responses and exposes attached files only to participants", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c19-participants" });
    const references = await seedDisputeReferences(t, fixture);
    const disputeId = await t.mutation(api.disputes.createDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.clientWallet,
      openedByWalletType: "external_wallet",
      reasonCategory: "work_not_delivered",
      title: "Delivery disputed",
      description: "The contracted delivery is missing.",
    });

    await t.mutation(api.disputes.addDisputeEvidence, {
      disputeId,
      actorWallet: fixture.clientWallet,
      actorWalletType: "external_wallet",
      attachmentIds: [references.attachmentId],
      message: "Client evidence",
    });
    await t.run(async (ctx) =>
      ctx.db.patch(references.attachmentId, {
        protectionMode: "protected_preview",
        previewAllowed: true,
        downloadAllowed: false,
        watermarkEnabled: true,
        accessLoggingEnabled: true,
      }),
    );
    const freelancerAttachmentId = await t.run(async (ctx) =>
      ctx.db.insert("attachments", {
        type: "file",
        name: "freelancer-proof.txt",
        uploadedByWallet: fixture.freelancerWallet,
        ownerRole: "freelancer",
        parentType: "unknown",
        visibility: "private",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    await t.mutation(api.disputes.addDisputeResponse, {
      disputeId,
      responderWallet: fixture.freelancerWallet,
      responderWalletType: "passkey_smart_account",
      message: "Here is the delivery proof.",
      attachmentIds: [freelancerAttachmentId],
    });

    const evidence = await t.query(api.disputes.getDisputeEvidence, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    expect(evidence.map((attachment) => attachment._id)).toEqual([
      references.attachmentId,
      freelancerAttachmentId,
    ]);
    expect(evidence[0]).toMatchObject({
      url: null,
      protection: { isProtected: true },
    });
    expect(
      await t.query(api.disputes.getDisputeEvidence, {
        disputeId,
        viewerWallet: fixture.freelancerWallet,
      }),
    ).toHaveLength(2);
    await expect(
      t.query(api.disputes.getDisputeEvidence, {
        disputeId,
        viewerWallet: fixture.unrelatedWallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getById, {
        attachmentId: references.attachmentId,
        viewerWallet: fixture.unrelatedWallet,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(api.attachments.getProtectedAttachment, {
        attachmentId: references.attachmentId,
        viewerWallet: fixture.unrelatedWallet,
      }),
    ).rejects.toThrow();

    const events = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    expect(events.map((event) => event.type)).toEqual([
      "dispute_opened",
      "evidence_added",
      "freelancer_response_added",
    ]);
    expect(events[1]?.attachments.map((attachment) => attachment._id)).toEqual([
      references.attachmentId,
    ]);
    expect(events[2]?.attachments.map((attachment) => attachment._id)).toEqual([
      freelancerAttachmentId,
    ]);
  }, 20_000);

  it("rejects unrelated actors and evidence owned by another wallet without changing the case", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c19-rejection" });
    const references = await seedDisputeReferences(t, fixture);
    const disputeId = await t.mutation(api.disputes.createDispute, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      openedByWallet: fixture.clientWallet,
      openedByWalletType: "external_wallet",
      reasonCategory: "work_not_delivered",
      title: "Delivery disputed",
      description: "The contracted delivery is missing.",
    });

    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.freelancerWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [references.attachmentId],
      }),
    ).rejects.toThrow("owned by another wallet");
    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.unrelatedWallet,
        responderWalletType: "external_wallet",
        message: "Unauthorized response",
      }),
    ).rejects.toThrow("Only the client or assigned freelancer");
    const dispute = await t.run(async (ctx) => ctx.db.get(disputeId));
    const attachment = await t.run(async (ctx) => ctx.db.get(references.attachmentId));
    expect(dispute?.evidenceAttachmentIds).toEqual([]);
    expect(attachment?.parentType).toBe("unknown");
    expect(
      await t.query(api.disputes.getDisputeTimeline, {
        disputeId,
        viewerWallet: fixture.clientWallet,
      }),
    ).toHaveLength(1);
  });
});
