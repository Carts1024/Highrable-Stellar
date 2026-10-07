import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  assignDisputeFixture,
  type BackendTest,
  countRecords,
  seedDisputeFixture,
  TEST_ADMIN_SECRET,
  TEST_WALLETS,
} from "../fixtures/disputes";

const PUBLIC_DISPUTE_API_REFERENCES = [
  api.disputes.createDispute,
  api.disputes.markDisputeOnChainStarted,
  api.disputes.markDisputeOnChainSucceeded,
  api.disputes.markDisputeOnChainFailed,
  api.disputes.addDisputeEvidence,
  api.disputes.addDisputeResponse,
  api.disputes.changeDisputeStatus,
  api.disputes.cancelDispute,
  api.disputes.addModeratorNote,
  api.disputes.recordDisputeResolution,
  api.disputes.getDispute,
  api.disputes.getDisputeByParent,
  api.disputes.getActiveDisputeForEscrow,
  api.disputes.getDisputesForWallet,
  api.disputes.getDisputeTimeline,
  api.disputes.getDisputeEvidence,
  api.disputes.canOpenDispute,
  api.disputes.canViewDispute,
  api.disputes.canRespondToDispute,
  api.disputes.getDisputeContextByParent,
] as const;

function createDisputeArgs(fixture: Awaited<ReturnType<typeof seedDisputeFixture>>) {
  return {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_not_delivered",
    title: "API contract dispute",
    description: "API contract fixture dispute.",
  } as const;
}

async function createDispute(
  t: BackendTest,
  fixture: Awaited<ReturnType<typeof seedDisputeFixture>>,
) {
  return await t.mutation(api.disputes.createDispute, createDisputeArgs(fixture));
}

async function readDisputeState(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async (ctx) => ({
    dispute: await ctx.db.get(disputeId),
    events: await ctx.db
      .query("disputeEvents")
      .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
      .collect(),
  }));
}

describe("dispute API contracts", () => {
  it("keeps every public dispute export addressable through generated API references", () => {
    expect(PUBLIC_DISPUTE_API_REFERENCES).toHaveLength(20);
  });

  it("rejects malformed mutation arguments without changing stored records", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-validation" });
    const beforeCreation = {
      disputes: await countRecords(t, "disputes"),
      events: await countRecords(t, "disputeEvents"),
    };
    const { title: _title, ...missingTitle } = createDisputeArgs(fixture);

    await expect(t.mutation(api.disputes.createDispute, missingTitle as never)).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.createDispute, {
        ...createDisputeArgs(fixture),
        reasonCategory: "invalid_reason",
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.createDispute, {
        ...createDisputeArgs(fixture),
        openedByWalletType: 42,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.createDispute, {
        ...createDisputeArgs(fixture),
        evidenceAttachmentIds: [fixture.jobId as unknown as Id<"attachments">],
      } as never),
    ).rejects.toThrow();

    expect(await countRecords(t, "disputes")).toBe(beforeCreation.disputes);
    expect(await countRecords(t, "disputeEvents")).toBe(beforeCreation.events);

    const disputeId = await createDispute(t, fixture);
    const before = await readDisputeState(t, disputeId);

    const { message: _message, ...missingResponseMessage } = {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet",
      message: "A response that will not be submitted.",
    };
    await expect(
      t.mutation(api.disputes.addDisputeResponse, missingResponseMessage as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.changeDisputeStatus, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        status: "invalid_status",
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.markDisputeOnChainStarted, {
        disputeId,
        actorWallet: fixture.clientWallet,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: "not-an-array",
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [fixture.jobId as unknown as Id<"attachments">],
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "Another response that will not be submitted.",
        attachmentIds: [fixture.jobId as unknown as Id<"attachments">],
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDispute, {
        disputeId: fixture.jobId as unknown as Id<"disputes">,
        viewerWallet: fixture.clientWallet,
      } as never),
    ).rejects.toThrow();

    expect(await readDisputeState(t, disputeId)).toEqual(before);
  });

  it("locks present, denied, and missing participant result shapes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-shapes" });
    const disputeId = await createDispute(t, fixture);

    const present = await t.query(api.disputes.getDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentByParent = await t.query(api.disputes.getDisputeByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.clientWallet,
    });
    const presentByEscrow = await t.query(api.disputes.getActiveDisputeForEscrow, {
      escrowId: fixture.escrowId,
      viewerWallet: fixture.clientWallet,
    });
    const presentTimeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentEvidence = await t.query(api.disputes.getDisputeEvidence, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentContext = await t.query(api.disputes.getDisputeContextByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.clientWallet,
    });
    const presentViewPermission = await t.query(api.disputes.canViewDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentResponsePermission = await t.query(api.disputes.canRespondToDispute, {
      disputeId,
      walletAddress: fixture.clientWallet,
    });
    const deniedViewPermission = await t.query(api.disputes.canViewDispute, {
      disputeId,
      viewerWallet: fixture.unrelatedWallet,
    });
    const deniedResponsePermission = await t.query(api.disputes.canRespondToDispute, {
      disputeId,
      walletAddress: fixture.unrelatedWallet,
    });
    const deniedContext = await t.query(api.disputes.getDisputeContextByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.unrelatedWallet,
    });
    const deniedWalletDisputes = await t.query(api.disputes.getDisputesForWallet, {
      walletAddress: fixture.unrelatedWallet,
    });

    expect(present).toMatchObject({ _id: disputeId, attachments: [] });
    expect(presentByParent).toMatchObject({ _id: disputeId, attachments: [] });
    expect(presentByEscrow).toMatchObject({ _id: disputeId, attachments: [] });
    expect(presentTimeline).toHaveLength(1);
    expect(presentTimeline[0]).toMatchObject({ disputeId, attachments: [] });
    expect(presentEvidence).toEqual([]);
    expect(presentContext).toMatchObject({
      parent: expect.objectContaining({ parentId: fixture.parentId }),
      submissions: [],
      revisions: [],
      deadlineEvents: [],
    });
    expect(presentViewPermission).toEqual({ allowed: true, reason: null, role: "client" });
    expect(presentResponsePermission).toEqual({ allowed: true, reason: null, role: "client" });
    expect(deniedViewPermission).toEqual({
      allowed: false,
      reason: expect.any(String),
      role: null,
    });
    expect(deniedResponsePermission).toEqual({
      allowed: false,
      reason: expect.any(String),
      role: null,
    });
    expect(deniedContext).toBeNull();
    expect(deniedWalletDisputes).toEqual([]);
    await expect(
      t.query(api.disputes.getDispute, {
        disputeId,
        viewerWallet: fixture.unrelatedWallet,
      }),
    ).rejects.toThrow();

    await t.run(async (ctx) => ctx.db.delete(disputeId));

    const missing = await t.query(api.disputes.getDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingTimeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingEvidence = await t.query(api.disputes.getDisputeEvidence, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingByParent = await t.query(api.disputes.getDisputeByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.clientWallet,
    });
    const missingByEscrow = await t.query(api.disputes.getActiveDisputeForEscrow, {
      escrowId: fixture.escrowId,
      viewerWallet: fixture.clientWallet,
    });
    const missingViewPermission = await t.query(api.disputes.canViewDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingResponsePermission = await t.query(api.disputes.canRespondToDispute, {
      disputeId,
      walletAddress: fixture.clientWallet,
    });

    expect(missing).toBeNull();
    expect(missingTimeline).toEqual([]);
    expect(missingEvidence).toEqual([]);
    expect(missingByParent).toBeNull();
    expect(missingByEscrow).toBeNull();
    expect(missingViewPermission).toEqual({ allowed: false, reason: "Dispute not found." });
    expect(missingViewPermission).not.toHaveProperty("role");
    expect(missingResponsePermission).toEqual({
      allowed: false,
      reason: "Dispute not found.",
      role: null,
    });
  });

  it("keeps legacy dispute moderator and resolution exports rejecting", async () => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", TEST_WALLETS.admin);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", TEST_ADMIN_SECRET);

    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-legacy-exports" });
    const disputeId = await createDispute(t, fixture);
    await assignDisputeFixture(t, disputeId, TEST_WALLETS.admin);

    await expect(
      t.mutation(api.disputes.addModeratorNote, {
        disputeId,
        moderatorWallet: TEST_WALLETS.admin,
        moderatorWalletType: "external_wallet",
        message: "Legacy note export should reject.",
      }),
    ).rejects.toThrow("Manual review tools will be added in a future phase.");
    await expect(
      t.mutation(api.disputes.recordDisputeResolution, {
        disputeId,
        moderatorWallet: TEST_WALLETS.admin,
        moderatorWalletType: "external_wallet",
        status: "resolved_client",
        message: "Legacy resolution export should reject.",
      }),
    ).rejects.toThrow("Resolution recorded in Highrable review workflow is not automated");

    await expect(
      t.mutation(api.admin.addModeratorNote, {
        adminWallet: TEST_WALLETS.admin,
        adminApiSecret: TEST_ADMIN_SECRET,
        disputeId,
        message: "Working administrator note export.",
      }),
    ).resolves.toBe(true);
  });
});
