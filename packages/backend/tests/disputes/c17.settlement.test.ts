import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  seedDisputeFixture,
  TEST_WALLETS,
  type BackendTest,
  type DisputeFixture,
} from "../fixtures/disputes";

const OWNER = TEST_WALLETS.admin;
const ADMIN_A = "GADMINC17A";
const ADMIN_B = "GADMINC17B";
const CLIENT = TEST_WALLETS.client;
const SECRET = "c17-test-admin-secret";
const NETWORK = "testnet";
const CONTRACT_ID = "c17-escrow-contract";

function context(adminWallet: string) {
  return { adminWallet, adminApiSecret: SECRET };
}

async function seedMembership(
  t: BackendTest,
  wallet: string,
  accessState: "active" | "revoking" | "revoked" = "active",
  network = NETWORK,
  contractId = CONTRACT_ID,
) {
  return await t.run(
    async ({ db }) =>
      await db.insert("disputeAdmins", {
        network,
        contractId,
        wallet,
        accessState,
        grantedByWallet: OWNER,
        grantedAt: 1,
        updatedAt: 1,
      }),
  );
}

describe("C17 expanded settlement identity and locking coverage", () => {
  beforeEach(() => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", OWNER);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", SECRET);
    vi.stubEnv("STELLAR_NETWORK", NETWORK);
    vi.stubEnv("ESCROW_CONTRACT_ID", CONTRACT_ID);
  });

  it("normalizes operation identity, replays matching starts, and rejects conflicting terms", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    await seedMembership(t, ADMIN_B);
    const { disputeId } = await createSettlementCase(t, "micro_gig", ADMIN_A, "c17-identity-a");
    const operationId = "c17-identity-001";

    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(ADMIN_A),
        disputeId,
        status: "split_resolution",
        freelancerShareBps: 5_000,
        resolutionNote: "  Keep this note.  ",
        operationId: ` ${operationId} `,
      }),
    ).resolves.toEqual({ operationId, freelancerShareBps: 5_000 });
    const started = await readSettlementState(t, disputeId);

    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(ADMIN_A),
        disputeId,
        status: "split_resolution",
        freelancerShareBps: 5_000,
        resolutionNote: "Keep this note.",
        operationId,
      }),
    ).resolves.toEqual({ operationId, freelancerShareBps: 5_000 });
    expect(await readSettlementState(t, disputeId)).toEqual(started);

    for (const conflictingArgs of [
      {
        status: "resolved_client" as const,
        freelancerShareBps: 0,
        resolutionNote: "Keep this note.",
      },
      {
        status: "split_resolution" as const,
        freelancerShareBps: 4_000,
        resolutionNote: "Keep this note.",
      },
      {
        status: "split_resolution" as const,
        freelancerShareBps: 5_000,
        resolutionNote: "Different note.",
      },
    ]) {
      tick();
      await expect(
        t.mutation(api.admin.recordDisputeResolutionStarted, {
          ...context(ADMIN_A),
          disputeId,
          operationId,
          ...conflictingArgs,
        }),
      ).rejects.toThrow(/already bound to a different attempt/);
      expect(await readSettlementState(t, disputeId)).toEqual(started);
    }

    const { disputeId: otherDisputeId } = await createSettlementCase(
      t,
      "micro_gig",
      ADMIN_A,
      "c17-identity-b",
    );
    const otherBefore = await readSettlementState(t, otherDisputeId);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(ADMIN_A),
        disputeId: otherDisputeId,
        status: "split_resolution",
        freelancerShareBps: 5_000,
        operationId,
      }),
    ).rejects.toThrow(/does not match the dispute escrow|already bound/);
    expect(await readSettlementState(t, otherDisputeId)).toEqual(otherBefore);

    await t.run(async ({ db }) => {
      await db.patch(disputeId, {
        assignedAdminWallet: ADMIN_B,
        assignedAt: Date.now(),
        assignedByWallet: OWNER,
        updatedAt: Date.now(),
      });
    });
    const actorConflict = await readSettlementState(t, disputeId);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(ADMIN_B),
        disputeId,
        status: "split_resolution",
        freelancerShareBps: 5_000,
        operationId,
      }),
    ).rejects.toThrow(/already bound to a different attempt/);
    expect(await readSettlementState(t, disputeId)).toEqual(actorConflict);
  });

  it("requires a new operation ID after definitive failure", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t, "micro_gig", ADMIN_A, "c17-failed-id");
    const failedOperationId = "c17-failed-id-001";

    await t.mutation(api.admin.recordDisputeResolutionStarted, {
      ...startArgs(disputeId, failedOperationId),
    });
    await t.mutation(api.admin.recordDisputeResolutionFailed, {
      ...context(ADMIN_A),
      operationId: failedOperationId,
      errorMessage: "Definitive submission failure.",
    });
    const failed = await readSettlementState(t, disputeId);

    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...startArgs(disputeId, ` ${failedOperationId} `),
      }),
    ).rejects.toThrow(/new operation ID/);
    expect(await readSettlementState(t, disputeId)).toEqual(failed);

    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...startArgs(disputeId, "c17-failed-id-002"),
      }),
    ).resolves.toEqual({ operationId: "c17-failed-id-002", freelancerShareBps: 5_000 });
  });

  it.each(["started", "signed", "submission_unknown", "submitted"] as const)(
    "allows only one active attempt while the first attempt is %s",
    async (phase) => {
      const t = convexTest(schema, modules);
      await seedMembership(t, ADMIN_A);
      const { disputeId } = await createSettlementCase(
        t,
        "micro_gig",
        ADMIN_A,
        `c17-active-${phase}`,
      );
      const operationId = `c17-active-${phase}-001`;
      await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
      if (phase === "signed" || phase === "submission_unknown" || phase === "submitted") {
        await t.mutation(api.admin.recordDisputeResolutionSigned, {
          ...context(ADMIN_A),
          operationId,
          transactionHash: "1".repeat(64),
          transactionValidUntil: 500,
        });
      }
      if (phase === "submission_unknown") {
        await t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
          ...context(ADMIN_A),
          operationId,
          errorMessage: "C17 active-attempt uncertainty.",
        });
      }
      if (phase === "submitted") {
        await t.run(async ({ db }) => {
          const attempt = await db
            .query("settlementAttempts")
            .withIndex("by_operationId", (q) => q.eq("operationId", operationId))
            .unique();
          if (!attempt) throw new Error("C17 active attempt is missing.");
          await db.patch(attempt._id, { status: "submitted" });
        });
      }

      const before = await readSettlementState(t, disputeId);
      tick();
      await expect(
        t.mutation(api.admin.recordDisputeResolutionStarted, {
          ...startArgs(disputeId, `c17-active-${phase}-002`),
        }),
      ).rejects.toThrow(/already pending/);
      expect(await readSettlementState(t, disputeId)).toEqual(before);
    },
  );

  it("locks competing disputes that reference the same escrow while independent escrows proceed", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    await seedMembership(t, ADMIN_B);
    const first = await createSettlementCase(t, "milestone", ADMIN_A, "c17-shared-escrow");
    const secondDisputeId = await cloneSettlementDispute(
      t,
      first.disputeId,
      ADMIN_B,
      "DSP-C17-SHARED-SECOND",
    );

    await t.mutation(
      api.admin.recordDisputeResolutionStarted,
      startArgs(first.disputeId, "c17-shared-001"),
    );
    const secondBefore = await readSettlementState(t, secondDisputeId);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(ADMIN_B),
        disputeId: secondDisputeId,
        status: "resolved_freelancer",
        freelancerShareBps: 10_000,
        operationId: "c17-shared-002",
      }),
    ).rejects.toThrow(/does not match the dispute escrow|already pending/);
    expect(await readSettlementState(t, secondDisputeId)).toEqual(secondBefore);

    const independent = await createSettlementCase(t, "milestone", ADMIN_A, "c17-independent");
    await expect(
      t.mutation(
        api.admin.recordDisputeResolutionStarted,
        startArgs(independent.disputeId, "c17-independent-001"),
      ),
    ).resolves.toEqual({ operationId: "c17-independent-001", freelancerShareBps: 5_000 });
    const independentState = await readSettlementState(t, independent.disputeId);
    expect(independentState.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationId: "c17-shared-001", status: "started" }),
        expect.objectContaining({ operationId: "c17-independent-001", status: "started" }),
      ]),
    );
    expect(first.fixture.escrowId).not.toBe(independent.fixture.escrowId);
  });
});

async function createSettlementCase(
  t: BackendTest,
  parentType: "micro_gig" | "milestone" = "micro_gig",
  assignedAdminWallet = ADMIN_A,
  label = `c17-${parentType}`,
): Promise<{ disputeId: Id<"disputes">; fixture: DisputeFixture }> {
  const fixture = await seedDisputeFixture(t, {
    parentType,
    label,
  });
  const disputeId = await t.mutation(api.disputes.createDispute, {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "payment_release_disagreement",
    title: "C17 settlement dispute",
    description: "Deterministic C17 settlement fixture.",
  });

  await t.run(async ({ db }) => {
    await db.patch(fixture.escrowId, { status: "disputed", updatedAt: 2 });
    await db.patch(fixture.jobId, { status: "disputed", updatedAt: 2 });
    if (fixture.milestoneId !== undefined) {
      await db.patch(fixture.milestoneId, { status: "disputed", updatedAt: 2 });
    }
    await db.patch(disputeId, {
      assignedAdminWallet,
      assignedAt: 2,
      assignedByWallet: OWNER,
      updatedAt: 2,
    });
  });

  return { disputeId, fixture };
}

async function readSettlementState(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async ({ db }) => {
    const dispute = await db.get(disputeId);
    const [
      escrow,
      job,
      milestone,
      escrows,
      jobs,
      milestones,
      disputes,
      attempts,
      transactions,
      events,
      notifications,
      conversations,
      messages,
    ] = await Promise.all([
      dispute?.escrowId ? db.get(dispute.escrowId) : Promise.resolve(null),
      dispute?.jobId ? db.get(dispute.jobId) : Promise.resolve(null),
      dispute?.milestoneId ? db.get(dispute.milestoneId) : Promise.resolve(null),
      db.query("escrows").take(100),
      db.query("jobs").take(100),
      db.query("milestones").take(100),
      db.query("disputes").take(100),
      db.query("settlementAttempts").take(100),
      db.query("transactions").take(100),
      db
        .query("disputeEvents")
        .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
        .take(100),
      db.query("notifications").take(100),
      db.query("conversations").take(100),
      db.query("messages").take(100),
    ]);
    return {
      dispute,
      disputes,
      escrow,
      escrows,
      job,
      milestone,
      jobs,
      milestones,
      attempts,
      transactions,
      events,
      notifications,
      conversations,
      messages,
    };
  });
}

function tick() {
  vi.setSystemTime(Date.now() + 1_000);
}

async function cloneSettlementDispute(
  t: BackendTest,
  sourceDisputeId: Id<"disputes">,
  assignedAdminWallet: string,
  disputeNumber: string,
): Promise<Id<"disputes">> {
  return await t.run(async ({ db }) => {
    const source = await db.get(sourceDisputeId);
    if (!source) {
      throw new Error("C17 source dispute is missing.");
    }

    const { _id: _sourceId, _creationTime: _sourceCreationTime, ...fields } = source;
    return await db.insert("disputes", {
      ...fields,
      disputeNumber,
      assignedAdminWallet,
      assignedAt: Date.now(),
      assignedByWallet: OWNER,
      updatedAt: Date.now(),
    });
  });
}

function startArgs(disputeId: Id<"disputes">, operationId = " c17-operation-001 ") {
  return {
    ...context(ADMIN_A),
    disputeId,
    status: "split_resolution" as const,
    freelancerShareBps: 5_000,
    operationId,
  };
}

describe("C17 administrator settlement records", () => {
  beforeEach(() => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", OWNER);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", SECRET);
    vi.stubEnv("STELLAR_NETWORK", NETWORK);
    vi.stubEnv("ESCROW_CONTRACT_ID", CONTRACT_ID);
  });

  it.each([
    ["micro_gig", "resolved_client", 0, "cancelled", "cancelled"],
    ["micro_gig", "resolved_freelancer", 10_000, "released", "completed"],
    ["micro_gig", "split_resolution", 5_000, "released", "completed"],
    ["milestone", "resolved_client", 0, "cancelled", "cancelled"],
    ["milestone", "resolved_freelancer", 10_000, "released", "released"],
    ["milestone", "split_resolution", 5_000, "released", "released"],
  ] as const)(
    "applies the %s %s mapping atomically",
    async (parentType, status, freelancerShareBps, escrowStatus, parentStatus) => {
      const t = convexTest(schema, modules);
      await seedMembership(t, ADMIN_A);
      const { disputeId, fixture } = await createSettlementCase(t, parentType);
      const operationId = `c17-${parentType}-${status}`;
      const hash = "a".repeat(64);

      await t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(ADMIN_A),
        disputeId,
        status,
        freelancerShareBps,
        operationId,
      });
      await t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash,
        transactionValidUntil: 100,
      });
      const result = await t.mutation(api.admin.recordDisputeResolutionSucceeded, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash,
        transactionValidUntil: 100,
      });

      expect(result).toMatchObject({
        status,
        freelancerShareBps,
        freelancerPayoutAmount: freelancerShareBps === 5_000 ? 250 : freelancerShareBps / 20,
        clientRefundAmount: freelancerShareBps === 5_000 ? 250 : 500 - freelancerShareBps / 20,
      });
      const state = await readSettlementState(t, disputeId);
      expect(state.dispute).toMatchObject({
        status,
        resolutionTxHash: hash,
        resolvedByWallet: ADMIN_A,
        freelancerShareBps,
      });
      expect(state.escrows.find((escrow) => escrow._id === fixture.escrowId)).toMatchObject({
        status: escrowStatus,
        ...(escrowStatus === "released" ? { releaseTxHash: hash } : { cancelTxHash: hash }),
      });
      if (parentType === "micro_gig") {
        expect(state.jobs.find((job) => job._id === fixture.jobId)?.status).toBe(parentStatus);
      } else {
        expect(
          state.milestones.find((milestone) => milestone._id === fixture.milestoneId)?.status,
        ).toBe(parentStatus);
      }
      expect(state.events.filter((event) => event.type === "resolution_proposed")).toHaveLength(1);
      expect(state.events.find((event) => event.type === status)).toMatchObject({
        transactionHash: hash,
        metadata: { operationId },
      });
      expect(state.attempts.find((attempt) => attempt.operationId === operationId)).toMatchObject({
        status: "succeeded",
        transactionHash: hash,
      });

      const terminal = state;
      tick();
      await expect(
        t.mutation(api.admin.recordDisputeResolutionSucceeded, {
          ...context(ADMIN_A),
          operationId: ` ${operationId} `,
          transactionHash: hash.toUpperCase(),
          transactionValidUntil: 100,
        }),
      ).resolves.toMatchObject({ status });
      expect(await readSettlementState(t, disputeId)).toEqual(terminal);
    },
  );

  it("keeps signed and uncertain replays at their first persisted phase and error", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t);
    const operationId = "c17-uncertain-001";
    const hash = "b".repeat(64);

    await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 200,
    });
    await t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
      ...context(ADMIN_A),
      operationId,
      errorMessage: "The first uncertainty.",
    });
    const first = await readSettlementState(t, disputeId);

    tick();
    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash.toUpperCase(),
      transactionValidUntil: 200,
    });
    tick();
    await t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
      ...context(ADMIN_A),
      operationId,
      errorMessage: "A later uncertainty must not replace the first.",
    });
    const replay = await readSettlementState(t, disputeId);

    expect(replay).toEqual(first);
    expect(replay.attempts.find((attempt) => attempt.operationId === operationId)).toMatchObject({
      status: "submission_unknown",
      errorMessage: "The first uncertainty.",
      transactionHash: hash,
      transactionValidUntil: 200,
    });
  });

  it("allows owner recovery and makes terminal success/failure callbacks harmless", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t);
    const operationId = "c17-owner-recovery-001";
    const hash = "c".repeat(64);

    await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 300,
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
        ...context(OWNER),
        operationId,
        errorMessage: "Owner recovered pending submission.",
      }),
    ).resolves.toEqual({ status: "submission_unknown" });
    const beforeSuccess = await readSettlementState(t, disputeId);

    await t.mutation(api.admin.recordDisputeResolutionSucceeded, {
      ...context(OWNER),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 300,
    });
    const afterSuccess = await readSettlementState(t, disputeId);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSucceeded, {
        ...context(OWNER),
        operationId: ` ${operationId} `,
        transactionHash: hash,
        transactionValidUntil: 300,
      }),
    ).resolves.toMatchObject({ status: "split_resolution" });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(OWNER),
        operationId,
        transactionHash: hash,
        errorMessage: "Stale failure.",
      }),
    ).resolves.toBe(true);
    expect(await readSettlementState(t, disputeId)).toEqual(afterSuccess);
    expect(
      beforeSuccess.attempts.find((attempt) => attempt.operationId === operationId)?.status,
    ).toBe("submission_unknown");
  });

  it("preserves the first failure, known hash, audit identity, and retryability", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t);
    const operationId = "c17-failure-001";
    const hash = "d".repeat(64);

    await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 350,
    });
    await t.mutation(api.admin.recordDisputeResolutionFailed, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      errorMessage: "First failure.",
    });
    const first = await readSettlementState(t, disputeId);
    tick();
    await t.mutation(api.admin.recordDisputeResolutionFailed, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      errorMessage: "A later failure must not replace the first.",
    });
    expect(await readSettlementState(t, disputeId)).toEqual(first);
    expect(first.events.find((event) => event.type === "moderator_note_added")).toMatchObject({
      transactionHash: hash,
      metadata: { operationId, transactionHash: hash },
    });

    await t.mutation(api.admin.recordDisputeResolutionStarted, {
      ...startArgs(disputeId, "c17-unsigned-001"),
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(ADMIN_A),
        operationId: "c17-unsigned-001",
        errorMessage: "Unsigned failure.",
      }),
    ).resolves.toBe(true);

    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...startArgs(disputeId, "c17-failure-002"),
      }),
    ).resolves.toMatchObject({ operationId: "c17-failure-002" });
  });

  it("rejects malformed terms and signed identities without writes", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t);
    const before = await readSettlementState(t, disputeId);

    for (const [status, freelancerShareBps] of [
      ["resolved_client", 1],
      ["resolved_freelancer", 9_999],
      ["split_resolution", 0],
      ["split_resolution", 10_000],
      ["split_resolution", 1.5],
    ] as const) {
      await expect(
        t.mutation(api.admin.recordDisputeResolutionStarted, {
          ...context(ADMIN_A),
          disputeId,
          status,
          freelancerShareBps,
          operationId: `c17-invalid-${String(freelancerShareBps)}`,
        }),
      ).rejects.toThrow();
    }
    expect(await readSettlementState(t, disputeId)).toEqual(before);

    const started = await t.mutation(
      api.admin.recordDisputeResolutionStarted,
      startArgs(disputeId),
    );
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId: started.operationId,
        transactionHash: "not-a-stellar-hash",
        transactionValidUntil: 1,
      }),
    ).rejects.toThrow(/64-character hexadecimal/);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId: started.operationId,
        transactionHash: "e".repeat(64),
        transactionValidUntil: 0,
      }),
    ).rejects.toThrow(/positive safe integer/);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(ADMIN_A),
        operationId: started.operationId,
        errorMessage: "   ",
      }),
    ).rejects.toThrow(/message is required/);
  });

  it("accepts legacy records without optional references but rejects populated conflicts", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t);
    await t.run(async ({ db }) => {
      await db.patch(disputeId, { onChainEscrowId: undefined, escrowContractId: undefined });
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, "c17-legacy-001")),
    ).resolves.toMatchObject({ operationId: "c17-legacy-001" });

    const t2 = convexTest(schema, modules);
    await seedMembership(t2, ADMIN_A);
    const { disputeId: conflictingDisputeId, fixture: conflictingFixture } =
      await createSettlementCase(t2);
    await t2.run(async ({ db }) => {
      await db.patch(conflictingDisputeId, {
        onChainEscrowId: "999999",
        escrowContractId: "different-contract",
      });
      expect(await db.get(conflictingFixture.escrowId)).toBeTruthy();
    });
    await expect(
      t2.mutation(
        api.admin.recordDisputeResolutionStarted,
        startArgs(conflictingDisputeId, "c17-conflicting-001"),
      ),
    ).rejects.toThrow(/does not match/);
  });

  it("checks scope, assignment, ownership, and authorization on replay paths", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    await seedMembership(t, ADMIN_B);
    const { disputeId } = await createSettlementCase(t);
    const operationId = "c17-auth-001";

    await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_B),
        operationId,
        transactionHash: "f".repeat(64),
        transactionValidUntil: 400,
      }),
    ).rejects.toThrow(/assigned|initiating/);

    await t.run(async ({ db }) => {
      await db.patch(disputeId, { assignedAdminWallet: ADMIN_B });
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
        ...context(ADMIN_A),
        operationId,
        errorMessage: "Stale unassigned callback.",
      }),
    ).rejects.toThrow();

    await t.run(async ({ db }) => {
      const membership = await db
        .query("disputeAdmins")
        .withIndex("by_scope_wallet", (q) =>
          q.eq("network", NETWORK).eq("contractId", CONTRACT_ID).eq("wallet", ADMIN_B),
        )
        .unique();
      await db.patch(membership!._id, { accessState: "revoked" });
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(ADMIN_B),
        disputeId,
        status: "split_resolution",
        freelancerShareBps: 5_000,
        operationId: "c17-auth-002",
      }),
    ).rejects.toThrow(/Active dispute admin access/);
  });

  it("rejects terminal and competing attempts without changing records", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t);
    const first = startArgs(disputeId, "c17-competing-001");
    await t.mutation(api.admin.recordDisputeResolutionStarted, first);
    const before = await readSettlementState(t, disputeId);

    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...first,
        operationId: "c17-competing-002",
        freelancerShareBps: 4_000,
      }),
    ).rejects.toThrow(/already pending/);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...first,
        operationId: "c17-competing-003",
        status: "resolved_client",
        freelancerShareBps: 0,
      }),
    ).rejects.toThrow(/already pending/);
    expect(await readSettlementState(t, disputeId)).toEqual(before);

    await t.run(async ({ db }) => {
      await db.patch(disputeId, { status: "resolved_client" });
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...first,
        operationId: "c17-terminal-001",
      }),
    ).rejects.toThrow(/already resolved/);
  });

  it("rejects participant administrators and preserves records on every rejection", async () => {
    const t = convexTest(schema, modules);
    const { disputeId } = await createSettlementCase(t, "micro_gig", CLIENT);
    await t.run(async ({ db }) => {
      await db.insert("disputeAdmins", {
        network: NETWORK,
        contractId: CONTRACT_ID,
        wallet: CLIENT,
        accessState: "active",
        grantedByWallet: OWNER,
        grantedAt: 1,
        updatedAt: 1,
      });
    });
    const before = await readSettlementState(t, disputeId);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...context(CLIENT),
        disputeId,
        status: "resolved_client",
        freelancerShareBps: 0,
        operationId: "c17-participant-001",
      }),
    ).rejects.toThrow(/participant/);
    expect(await readSettlementState(t, disputeId)).toEqual(before);
  });

  it("fixes signed identity once and rejects missing or malformed callback identities", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t, "milestone", ADMIN_A, "c17-signed");
    const operationId = "c17-signed-001";
    const hash = "AB".repeat(32);

    await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId: ` ${operationId} `,
        transactionHash: ` ${hash} `,
        transactionValidUntil: 777,
      }),
    ).resolves.toEqual({ operationId, transactionHash: hash.toLowerCase() });
    const signed = await readSettlementState(t, disputeId);

    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash.toLowerCase(),
        transactionValidUntil: 777,
      }),
    ).resolves.toEqual({ operationId, transactionHash: hash.toLowerCase() });
    expect(await readSettlementState(t, disputeId)).toEqual(signed);

    for (const identity of [
      {
        transactionHash: "c".repeat(64),
        transactionValidUntil: 777,
        error: /identity is already fixed/,
      },
      { transactionHash: hash, transactionValidUntil: 778, error: /expiry is already fixed/ },
      {
        transactionHash: "not-a-hash",
        transactionValidUntil: 778,
        error: /64-character hexadecimal/,
      },
      {
        transactionHash: "d".repeat(64),
        transactionValidUntil: Number.MAX_SAFE_INTEGER + 1,
        error: /positive safe integer/,
      },
    ]) {
      tick();
      await expect(
        t.mutation(api.admin.recordDisputeResolutionSigned, {
          ...context(ADMIN_A),
          operationId,
          transactionHash: identity.transactionHash,
          transactionValidUntil: identity.transactionValidUntil,
        }),
      ).rejects.toThrow(identity.error);
      expect(await readSettlementState(t, disputeId)).toEqual(signed);
    }

    const missingBefore = await readSettlementState(t, disputeId);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId: "c17-missing-signed",
        transactionHash: "e".repeat(64),
        transactionValidUntil: 1,
      }),
    ).rejects.toThrow(/not found/);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
        ...context(ADMIN_A),
        operationId: "c17-missing-unknown",
        errorMessage: "Missing operation.",
      }),
    ).rejects.toThrow(/not found/);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSucceeded, {
        ...context(ADMIN_A),
        operationId: "c17-missing-success",
        transactionHash: "f".repeat(64),
        transactionValidUntil: 1,
      }),
    ).rejects.toThrow(/not found/);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(ADMIN_A),
        operationId: "c17-missing-failure",
        errorMessage: "Missing operation.",
      }),
    ).rejects.toThrow(/not found/);
    expect(await readSettlementState(t, disputeId)).toEqual(missingBefore);
  });

  it("guards unsigned success and uncertainty, unverified signed failure, and failed success", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(t, "micro_gig", ADMIN_A, "c17-phases");
    const operationId = "c17-phases-001";
    const hash = "1".repeat(64);

    await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
    const unsigned = await readSettlementState(t, disputeId);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSucceeded, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash,
        transactionValidUntil: 500,
      }),
    ).rejects.toThrow(/persisted signed transaction/);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
        ...context(ADMIN_A),
        operationId,
        errorMessage: "Unsigned uncertainty.",
      }),
    ).rejects.toThrow(/requires a persisted transaction hash/);
    expect(await readSettlementState(t, disputeId)).toEqual(unsigned);

    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 500,
    });
    const signed = await readSettlementState(t, disputeId);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(ADMIN_A),
        operationId,
        errorMessage: "Missing reconciliation hash.",
      }),
    ).rejects.toThrow(/reconciled with Stellar/);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: "2".repeat(64),
        errorMessage: "Conflicting reconciliation hash.",
      }),
    ).rejects.toThrow(/reconciled with Stellar/);
    expect(await readSettlementState(t, disputeId)).toEqual(signed);

    await t.mutation(api.admin.recordDisputeResolutionFailed, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      errorMessage: "Definitive failure.",
    });
    const failed = await readSettlementState(t, disputeId);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSucceeded, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash,
        transactionValidUntil: 500,
      }),
    ).rejects.toThrow(/definitively failed/);
    expect(await readSettlementState(t, disputeId)).toEqual(failed);
  });

  it("checks secret and scoped membership before replay paths or writes", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A, "active", NETWORK, "other-contract");
    const { disputeId } = await createSettlementCase(t, "micro_gig", ADMIN_A, "c17-auth-scope");
    const before = await readSettlementState(t, disputeId);

    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...startArgs(disputeId, "c17-auth-secret"),
        adminApiSecret: "wrong-secret",
      }),
    ).rejects.toThrow(/Invalid admin API secret/);
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, "c17-auth-scope")),
    ).rejects.toThrow(/Active dispute admin access/);
    expect(await readSettlementState(t, disputeId)).toEqual(before);

    await seedMembership(t, ADMIN_A);
    await t.mutation(
      api.admin.recordDisputeResolutionStarted,
      startArgs(disputeId, "c17-auth-valid"),
    );
    const started = await readSettlementState(t, disputeId);
    for (const callback of [
      () =>
        t.mutation(api.admin.recordDisputeResolutionSigned, {
          ...context(ADMIN_A),
          adminApiSecret: "wrong-secret",
          operationId: "c17-auth-valid",
          transactionHash: "3".repeat(64),
          transactionValidUntil: 600,
        }),
      () =>
        t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
          ...context(ADMIN_A),
          adminApiSecret: "wrong-secret",
          operationId: "c17-auth-valid",
          errorMessage: "Wrong secret.",
        }),
      () =>
        t.mutation(api.admin.recordDisputeResolutionSucceeded, {
          ...context(ADMIN_A),
          adminApiSecret: "wrong-secret",
          operationId: "c17-auth-valid",
          transactionHash: "3".repeat(64),
          transactionValidUntil: 600,
        }),
      () =>
        t.mutation(api.admin.recordDisputeResolutionFailed, {
          ...context(ADMIN_A),
          adminApiSecret: "wrong-secret",
          operationId: "c17-auth-valid",
          errorMessage: "Wrong secret.",
        }),
    ]) {
      tick();
      await expect(callback()).rejects.toThrow(/Invalid admin API secret/);
      expect(await readSettlementState(t, disputeId)).toEqual(started);
    }
  });

  it.each([CLIENT, TEST_WALLETS.freelancer] as const)(
    "rejects %s as a participant on start and every callback replay path",
    async (participantWallet) => {
      const t = convexTest(schema, modules);
      await seedMembership(t, ADMIN_A);
      await seedMembership(t, participantWallet);
      const { disputeId } = await createSettlementCase(
        t,
        "milestone",
        ADMIN_A,
        `c17-participant-${participantWallet}`,
      );
      const operationId = `c17-participant-${participantWallet}`;
      await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
      const before = await readSettlementState(t, disputeId);

      await expect(
        t.mutation(api.admin.recordDisputeResolutionStarted, {
          ...context(participantWallet),
          disputeId,
          status: "split_resolution",
          freelancerShareBps: 5_000,
          operationId: `${operationId}-new`,
        }),
      ).rejects.toThrow(/participant/);
      for (const callback of [
        () =>
          t.mutation(api.admin.recordDisputeResolutionSigned, {
            ...context(participantWallet),
            operationId,
            transactionHash: "4".repeat(64),
            transactionValidUntil: 600,
          }),
        () =>
          t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
            ...context(participantWallet),
            operationId,
            errorMessage: "Participant replay.",
          }),
        () =>
          t.mutation(api.admin.recordDisputeResolutionSucceeded, {
            ...context(participantWallet),
            operationId,
            transactionHash: "4".repeat(64),
            transactionValidUntil: 600,
          }),
        () =>
          t.mutation(api.admin.recordDisputeResolutionFailed, {
            ...context(participantWallet),
            operationId,
            errorMessage: "Participant replay.",
          }),
      ]) {
        tick();
        await expect(callback()).rejects.toThrow(/participant/);
        expect(await readSettlementState(t, disputeId)).toEqual(before);
      }
    },
  );

  it.each(["resolved_client", "resolved_freelancer", "split_resolution", "cancelled"] as const)(
    "rejects new settlement starts for terminal dispute status %s",
    async (status) => {
      const t = convexTest(schema, modules);
      await seedMembership(t, ADMIN_A);
      const { disputeId } = await createSettlementCase(
        t,
        "micro_gig",
        ADMIN_A,
        `c17-terminal-${status}`,
      );
      await t.run(async ({ db }) => db.patch(disputeId, { status }));
      const before = await readSettlementState(t, disputeId);

      tick();
      await expect(
        t.mutation(
          api.admin.recordDisputeResolutionStarted,
          startArgs(disputeId, `c17-${status}-001`),
        ),
      ).rejects.toThrow(status === "cancelled" ? /Cancelled/ : /already resolved/);
      expect(await readSettlementState(t, disputeId)).toEqual(before);
    },
  );

  it("rejects state-changing callbacks for a non-disputed escrow, including replay paths", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const initial = await createSettlementCase(t, "micro_gig", ADMIN_A, "c17-not-disputed-start");
    await t.run(async ({ db }) => db.patch(initial.fixture.escrowId, { status: "funded" }));
    const initialBefore = await readSettlementState(t, initial.disputeId);
    tick();
    await expect(
      t.mutation(
        api.admin.recordDisputeResolutionStarted,
        startArgs(initial.disputeId, "c17-not-disputed-001"),
      ),
    ).rejects.toThrow(/Escrow must be disputed/);
    expect(await readSettlementState(t, initial.disputeId)).toEqual(initialBefore);

    const active = await createSettlementCase(t, "micro_gig", ADMIN_A, "c17-not-disputed-replay");
    const operationId = "c17-not-disputed-002";
    const hash = "5".repeat(64);
    await t.mutation(
      api.admin.recordDisputeResolutionStarted,
      startArgs(active.disputeId, operationId),
    );
    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 700,
    });
    await t.run(async ({ db }) => db.patch(active.fixture.escrowId, { status: "funded" }));
    const replayBefore = await readSettlementState(t, active.disputeId);
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash.toUpperCase(),
        transactionValidUntil: 700,
      }),
    ).resolves.toEqual({ operationId, transactionHash: hash });
    expect(await readSettlementState(t, active.disputeId)).toEqual(replayBefore);
    for (const callback of [
      () =>
        t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
          ...context(ADMIN_A),
          operationId,
          errorMessage: "Non-disputed uncertainty.",
        }),
      () =>
        t.mutation(api.admin.recordDisputeResolutionSucceeded, {
          ...context(ADMIN_A),
          operationId,
          transactionHash: hash,
          transactionValidUntil: 700,
        }),
      () =>
        t.mutation(api.admin.recordDisputeResolutionFailed, {
          ...context(ADMIN_A),
          operationId,
          transactionHash: hash,
          errorMessage: "Non-disputed failure.",
        }),
    ]) {
      tick();
      await expect(callback()).rejects.toThrow(/Escrow must be disputed/);
      expect(await readSettlementState(t, active.disputeId)).toEqual(replayBefore);
    }
  });

  it("keeps terminal success side effects stable across signed, uncertain, success, and failure replays", async () => {
    const t = convexTest(schema, modules);
    await seedMembership(t, ADMIN_A);
    const { disputeId } = await createSettlementCase(
      t,
      "milestone",
      ADMIN_A,
      "c17-terminal-replays",
    );
    const operationId = "c17-terminal-replays-001";
    const hash = "6".repeat(64);
    await t.mutation(api.admin.recordDisputeResolutionStarted, startArgs(disputeId, operationId));
    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 800,
    });
    await t.mutation(api.admin.recordDisputeResolutionSucceeded, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash,
      transactionValidUntil: 800,
    });
    const terminal = await readSettlementState(t, disputeId);

    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash.toUpperCase(),
        transactionValidUntil: 800,
      }),
    ).resolves.toEqual({ operationId, transactionHash: hash });
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
        ...context(ADMIN_A),
        operationId,
        errorMessage: "Stale terminal uncertainty.",
      }),
    ).resolves.toEqual({ status: "succeeded" });
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSucceeded, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash,
        transactionValidUntil: 800,
      }),
    ).resolves.toMatchObject({ status: "split_resolution" });
    tick();
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(ADMIN_A),
        operationId,
        transactionHash: hash,
        errorMessage: "Stale terminal failure.",
      }),
    ).resolves.toBe(true);
    expect(await readSettlementState(t, disputeId)).toEqual(terminal);
  });
});
