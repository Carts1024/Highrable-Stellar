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

async function createSettlementCase(
  t: BackendTest,
  parentType: "micro_gig" | "milestone" = "micro_gig",
  assignedAdminWallet = ADMIN_A,
): Promise<{ disputeId: Id<"disputes">; fixture: DisputeFixture }> {
  const fixture = await seedDisputeFixture(t, {
    parentType,
    label: `c17-${parentType}`,
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
    const [escrows, jobs, milestones, attempts, transactions, events, notifications] =
      await Promise.all([
        db.query("escrows").take(20),
        db.query("jobs").take(20),
        db.query("milestones").take(20),
        db.query("settlementAttempts").take(20),
        db.query("transactions").take(20),
        db.query("disputeEvents").take(100),
        db.query("notifications").take(100),
      ]);
    return { dispute, escrows, jobs, milestones, attempts, transactions, events, notifications };
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

    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId,
      transactionHash: hash.toUpperCase(),
      transactionValidUntil: 200,
    });
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
    const { disputeId, fixture } = await createSettlementCase(t);
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
});
