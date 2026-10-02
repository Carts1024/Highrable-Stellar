import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  seedDisputeFixture,
  seedScopedDisputeAdmin,
  seedSiblingMilestoneFixture,
  TEST_WALLETS,
  type BackendTest,
  type DisputeFixture,
} from "../fixtures/disputes";

const OWNER = TEST_WALLETS.admin;
const ADMIN_A = "GADMINC21A";
const SECRET = "c21-test-admin-secret";
const NETWORK = "testnet";
const CONTRACT_ID = "c21-escrow-contract";
const MARK_HASH = "1".repeat(64);
const SETTLEMENT_HASH = "2".repeat(64);

type ParentType = "micro_gig" | "milestone";
type ResolutionCase = {
  parentType: ParentType;
  status: "resolved_client" | "resolved_freelancer" | "split_resolution";
  freelancerShareBps: number;
  escrowStatus: "cancelled" | "released";
  parentStatus: "cancelled" | "completed" | "released";
};

function adminContext(adminWallet = ADMIN_A) {
  return { adminWallet, adminApiSecret: SECRET };
}

async function getOnChainEscrowId(t: BackendTest, escrowId: Id<"escrows">): Promise<string> {
  return await t.run(async ({ db }) => {
    const escrow = await db.get(escrowId);
    if (!escrow) {
      throw new Error("C21 escrow fixture is missing.");
    }

    return escrow.escrowId;
  });
}

async function createDispute(t: BackendTest, fixture: DisputeFixture): Promise<Id<"disputes">> {
  return await t.mutation(api.disputes.createDispute, {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "payment_release_disagreement",
    title: "C21 reconciliation dispute",
    description: "Deterministic C21 reconciliation fixture.",
  });
}

async function mirrorEscrowStatus(
  t: BackendTest,
  fixture: DisputeFixture,
  status: "disputed" | "released" | "cancelled",
  transactionHash: string,
): Promise<void> {
  const escrowId = await getOnChainEscrowId(t, fixture.escrowId);
  const args = {
    escrowId,
    status,
    txHash: transactionHash,
    txType:
      status === "disputed"
        ? ("mark_disputed" as const)
        : status === "released"
          ? ("release_payment" as const)
          : ("cancel_escrow" as const),
  };

  if (fixture.parentType === "milestone" && fixture.milestoneId !== undefined) {
    await t.mutation(api.milestones.updateMilestoneEscrowStatus, {
      ...args,
      milestoneId: fixture.milestoneId,
    });
    return;
  }

  await t.mutation(api.escrows.updateEscrowStatus, args);
}

async function markDisputeAndMirror(
  t: BackendTest,
  fixture: DisputeFixture,
  disputeId: Id<"disputes">,
  markHash = MARK_HASH,
): Promise<void> {
  await t.mutation(api.disputes.markDisputeOnChainStarted, {
    disputeId,
    actorWallet: fixture.clientWallet,
    actorWalletType: "external_wallet",
  });
  await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
    disputeId,
    actorWallet: fixture.clientWallet,
    actorWalletType: "external_wallet",
    transactionHash: markHash,
  });
  await mirrorEscrowStatus(t, fixture, "disputed", markHash);
}

async function prepareSettlementCase(
  t: BackendTest,
  parentType: ParentType,
  label: string,
): Promise<{ disputeId: Id<"disputes">; fixture: DisputeFixture }> {
  const fixture = await seedDisputeFixture(t, {
    parentType,
    label,
  });
  const disputeId = await createDispute(t, fixture);
  await markDisputeAndMirror(t, fixture, disputeId, `${label}-mark`);
  await seedScopedDisputeAdmin(t, ADMIN_A, {
    contractId: CONTRACT_ID,
    network: NETWORK,
  });
  await t.mutation(api.admin.claimDispute, {
    ...adminContext(),
    disputeId,
  });

  return { disputeId, fixture };
}

async function readCaseState(t: BackendTest, disputeId: Id<"disputes">, fixture: DisputeFixture) {
  return await t.run(async ({ db }) => {
    const [
      dispute,
      escrow,
      job,
      milestone,
      events,
      attempts,
      transactions,
      notifications,
      messages,
    ] = await Promise.all([
      db.get(disputeId),
      db.get(fixture.escrowId),
      db.get(fixture.jobId),
      fixture.milestoneId === undefined ? Promise.resolve(null) : db.get(fixture.milestoneId),
      db
        .query("disputeEvents")
        .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
        .take(100),
      db.query("settlementAttempts").take(100),
      db.query("transactions").take(100),
      db.query("notifications").take(100),
      db.query("messages").take(100),
    ]);

    return {
      dispute,
      escrow,
      job,
      milestone,
      events,
      attempts,
      transactions,
      notifications,
      messages,
    };
  });
}

async function startSettlement(
  t: BackendTest,
  disputeId: Id<"disputes">,
  operationId: string,
  status: ResolutionCase["status"] = "split_resolution",
  freelancerShareBps = 5_000,
) {
  return await t.mutation(api.admin.recordDisputeResolutionStarted, {
    ...adminContext(),
    disputeId,
    status,
    freelancerShareBps,
    operationId,
  });
}

async function signSettlement(
  t: BackendTest,
  operationId: string,
  transactionHash = SETTLEMENT_HASH,
  transactionValidUntil = 600,
): Promise<void> {
  await t.mutation(api.admin.recordDisputeResolutionSigned, {
    ...adminContext(),
    operationId,
    transactionHash,
    transactionValidUntil,
  });
}

async function succeedSettlement(
  t: BackendTest,
  operationId: string,
  transactionHash = SETTLEMENT_HASH,
  transactionValidUntil = 600,
) {
  return await t.mutation(api.admin.recordDisputeResolutionSucceeded, {
    ...adminContext(),
    operationId,
    transactionHash,
    transactionValidUntil,
  });
}

describe("C21 dispute retry and reconciliation coverage", () => {
  beforeEach(() => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", OWNER);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", SECRET);
    vi.stubEnv("STELLAR_NETWORK", NETWORK);
    vi.stubEnv("ESCROW_CONTRACT_ID", CONTRACT_ID);
  });

  it.each(["micro_gig", "milestone"] as const)(
    "retries hashless marking and reconciles the %s escrow and parent mirror",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c21-mark-retry-${parentType}`,
      });
      const disputeId = await createDispute(t, fixture);

      await t.mutation(api.disputes.markDisputeOnChainStarted, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
      });
      await t.mutation(api.disputes.markDisputeOnChainFailed, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        errorMessage: "The first mark submission failed.",
      });
      await t.mutation(api.disputes.markDisputeOnChainStarted, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
      });
      await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        transactionHash: MARK_HASH,
      });
      await mirrorEscrowStatus(t, fixture, "disputed", MARK_HASH);

      const state = await readCaseState(t, disputeId, fixture);
      expect(state.dispute).toMatchObject({ onChainStatus: "marked", transactionHash: MARK_HASH });
      expect(state.escrow).toMatchObject({ status: "disputed", disputeTxHash: MARK_HASH });
      expect(state.job?.status).toBe("disputed");
      if (parentType === "milestone") {
        expect(state.milestone).toMatchObject({ status: "disputed", disputeTxHash: MARK_HASH });
      }
      expect(state.events.filter((event) => event.type === "dispute_opened")).toHaveLength(1);
      expect(state.events.filter((event) => event.type === "on_chain_mark_failed")).toHaveLength(1);
      expect(state.events.filter((event) => event.type === "on_chain_mark_started")).toHaveLength(
        2,
      );
      expect(state.events.filter((event) => event.type === "on_chain_mark_succeeded")).toHaveLength(
        1,
      );
    },
  );

  it("blocks known-hash retries, rejects conflicting callbacks, and accepts late matching success", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c21-known-hash" });
    const disputeId = await createDispute(t, fixture);
    const knownHash = "3".repeat(64);

    await t.mutation(api.disputes.markDisputeOnChainStarted, {
      disputeId,
      actorWallet: fixture.clientWallet,
      actorWalletType: "external_wallet",
    });
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      disputeId,
      actorWallet: fixture.clientWallet,
      actorWalletType: "external_wallet",
      transactionHash: knownHash,
      errorMessage: "Submission outcome is uncertain.",
    });
    const failed = await readCaseState(t, disputeId, fixture);

    await expect(
      t.mutation(api.disputes.markDisputeOnChainStarted, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
      }),
    ).rejects.toThrow(/requires reconciliation/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        transactionHash: "4".repeat(64),
      }),
    ).rejects.toThrow(/different transaction hash|recorded transaction hash/i);
    expect(await readCaseState(t, disputeId, fixture)).toEqual(failed);

    await mirrorEscrowStatus(t, fixture, "disputed", knownHash);
    await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
      disputeId,
      actorWallet: fixture.clientWallet,
      actorWalletType: "external_wallet",
      transactionHash: knownHash,
    });
    const recovered = await readCaseState(t, disputeId, fixture);
    expect(recovered.dispute).toMatchObject({
      onChainStatus: "marked",
      transactionHash: knownHash,
    });
    expect(recovered.escrow).toMatchObject({ status: "disputed", disputeTxHash: knownHash });
    expect(
      recovered.events.filter((event) => event.type === "on_chain_mark_succeeded"),
    ).toHaveLength(1);
  });

  it.each(["micro_gig", "milestone"] as const)(
    "keeps confirmed bookkeeping stable across partial-recovery callback replay for %s",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c21-partial-recovery-${parentType}`,
      });
      const disputeId = await createDispute(t, fixture);
      await t.mutation(api.disputes.markDisputeOnChainStarted, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
      });

      // Parent bookkeeping completed before the callback that confirms the dispute.
      await mirrorEscrowStatus(t, fixture, "disputed", MARK_HASH);
      await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        transactionHash: MARK_HASH,
      });
      const confirmed = await readCaseState(t, disputeId, fixture);

      await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        transactionHash: MARK_HASH,
      });
      await t.mutation(api.disputes.markDisputeOnChainFailed, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        errorMessage: "A stale failure must not downgrade confirmed bookkeeping.",
      });
      expect(await readCaseState(t, disputeId, fixture)).toEqual(confirmed);
    },
  );

  it("preserves a failed settlement attempt and transaction while retrying successfully", async () => {
    const t = convexTest(schema, modules);
    const { disputeId, fixture } = await prepareSettlementCase(
      t,
      "micro_gig",
      "c21-settlement-retry",
    );

    await startSettlement(t, disputeId, "c21-settlement-failed");
    await t.mutation(api.admin.recordDisputeResolutionFailed, {
      ...adminContext(),
      operationId: "c21-settlement-failed",
      errorMessage: "The first settlement submission failed.",
    });
    await startSettlement(t, disputeId, "c21-settlement-retry");
    await signSettlement(t, "c21-settlement-retry");
    await succeedSettlement(t, "c21-settlement-retry");

    const state = await readCaseState(t, disputeId, fixture);
    expect(state.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationId: "c21-settlement-failed", status: "failed" }),
        expect.objectContaining({
          operationId: "c21-settlement-retry",
          status: "succeeded",
          transactionHash: SETTLEMENT_HASH,
        }),
      ]),
    );
    expect(state.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clientRequestId: "c21-settlement-failed", status: "failed" }),
        expect.objectContaining({
          clientRequestId: "c21-settlement-retry",
          status: "success",
          txHash: SETTLEMENT_HASH,
        }),
      ]),
    );
    expect(state.escrow).toMatchObject({ status: "released", releaseTxHash: SETTLEMENT_HASH });
    expect(state.job).toMatchObject({ status: "completed", completedAt: expect.any(Number) });
  });

  it("keeps uncertain settlement identity and blocks competing operations until confirmation", async () => {
    const t = convexTest(schema, modules);
    const { disputeId, fixture } = await prepareSettlementCase(t, "milestone", "c21-uncertain");
    const operationId = "c21-uncertain-operation";
    const transactionHash = "5".repeat(64);

    await startSettlement(t, disputeId, operationId);
    await signSettlement(t, operationId, transactionHash, 777);
    await t.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
      ...adminContext(),
      operationId,
      errorMessage: "Submission result was not observed.",
    });
    const uncertain = await readCaseState(t, disputeId, fixture);
    expect(uncertain.attempts.find((attempt) => attempt.operationId === operationId)).toMatchObject(
      {
        status: "submission_unknown",
        transactionHash,
        transactionValidUntil: 777,
      },
    );
    expect(
      uncertain.transactions.find((transaction) => transaction.clientRequestId === operationId),
    ).toMatchObject({
      status: "pending",
      txHash: transactionHash,
    });

    await expect(startSettlement(t, disputeId, "c21-uncertain-competing")).rejects.toThrow(
      /already pending/,
    );
    await succeedSettlement(t, operationId, transactionHash, 777);
    const confirmed = await readCaseState(t, disputeId, fixture);
    const replay = await succeedSettlement(t, operationId, transactionHash, 777);
    expect(replay).toMatchObject({ status: "split_resolution", resolutionTxHash: transactionHash });
    expect(confirmed.dispute).toMatchObject({
      status: "split_resolution",
      resolutionTxHash: transactionHash,
    });
    expect(confirmed.escrow).toMatchObject({ status: "released", releaseTxHash: transactionHash });
    expect(confirmed.milestone).toMatchObject({
      status: "released",
      releaseTxHash: transactionHash,
      completedAt: expect.any(Number),
      approvedAt: expect.any(Number),
    });
  });

  it.each([
    ["micro_gig", "resolved_client", 0, "cancelled", "cancelled"],
    ["micro_gig", "resolved_freelancer", 10_000, "released", "completed"],
    ["micro_gig", "split_resolution", 5_000, "released", "completed"],
    ["milestone", "resolved_client", 0, "cancelled", "cancelled"],
    ["milestone", "resolved_freelancer", 10_000, "released", "released"],
    ["milestone", "split_resolution", 5_000, "released", "released"],
  ] as const)(
    "records %s %s parent outcomes and side effects",
    async (parentType, status, freelancerShareBps, escrowStatus, parentStatus) => {
      const t = convexTest(schema, modules);
      const { disputeId, fixture } = await prepareSettlementCase(
        t,
        parentType,
        `c21-outcome-${parentType}-${status}`,
      );
      const operationId = `c21-outcome-${parentType}-${status}`;
      const before = await readCaseState(t, disputeId, fixture);

      await startSettlement(t, disputeId, operationId, status, freelancerShareBps);
      await signSettlement(t, operationId, SETTLEMENT_HASH, 888);
      const result = await succeedSettlement(t, operationId, SETTLEMENT_HASH, 888);
      const after = await readCaseState(t, disputeId, fixture);

      expect(result).toMatchObject({
        status,
        freelancerShareBps,
        resolutionTxHash: SETTLEMENT_HASH,
      });
      expect(after.dispute).toMatchObject({
        status,
        resolutionTxHash: SETTLEMENT_HASH,
        resolvedByWallet: ADMIN_A,
        freelancerShareBps,
        resolvedAt: expect.any(Number),
      });
      expect(after.escrow).toMatchObject({
        status: escrowStatus,
        ...(escrowStatus === "released"
          ? { releaseTxHash: SETTLEMENT_HASH }
          : { cancelTxHash: SETTLEMENT_HASH }),
      });
      expect(after.job?.status).toBe(parentStatus === "released" ? "completed" : parentStatus);
      if (parentType === "micro_gig") {
        expect(after.job).toMatchObject(
          parentStatus === "completed"
            ? { completedAt: expect.any(Number), approvedAt: expect.any(Number) }
            : { status: parentStatus },
        );
      } else {
        expect(after.milestone).toMatchObject(
          parentStatus === "released"
            ? {
                status: "released",
                releaseTxHash: SETTLEMENT_HASH,
                completedAt: expect.any(Number),
                approvedAt: expect.any(Number),
              }
            : { status: "cancelled", cancelTxHash: SETTLEMENT_HASH },
        );
      }
      expect(after.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            clientRequestId: operationId,
            status: "success",
            txHash: SETTLEMENT_HASH,
            transactionHash: SETTLEMENT_HASH,
          }),
        ]),
      );
      expect(after.events.filter((event) => event.type === status)).toHaveLength(1);
      expect(after.notifications.length).toBeGreaterThan(before.notifications.length);
      expect(after.messages.length).toBeGreaterThan(before.messages.length);
    },
  );

  it.each(["funded", "disputed", "released"] as const)(
    "isolates the selected milestone when the sibling is %s",
    async (siblingState) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType: "milestone",
        label: `c21-sibling-${siblingState}`,
      });
      const sibling = await seedSiblingMilestoneFixture(t, fixture, {
        label: `c21-sibling-${siblingState}`,
      });
      const disputeId = await createDispute(t, fixture);
      await markDisputeAndMirror(t, fixture, disputeId, `6${"0".repeat(63)}`);

      const siblingFixture: DisputeFixture = {
        ...fixture,
        escrowId: sibling.escrowId,
        milestoneId: sibling.milestoneId,
        parentId: sibling.milestoneId,
      };
      if (siblingState === "disputed") {
        const siblingDisputeId = await createDispute(t, siblingFixture);
        await markDisputeAndMirror(t, siblingFixture, siblingDisputeId, `7${"0".repeat(63)}`);
      } else if (siblingState === "released") {
        await mirrorEscrowStatus(t, siblingFixture, "released", `8${"0".repeat(63)}`);
      }

      const siblingBefore = await readCaseState(t, disputeId, siblingFixture);
      await seedScopedDisputeAdmin(t, ADMIN_A, { contractId: CONTRACT_ID, network: NETWORK });
      await t.mutation(api.admin.claimDispute, { ...adminContext(), disputeId });
      await startSettlement(
        t,
        disputeId,
        `c21-sibling-operation-${siblingState}`,
        "resolved_freelancer",
        10_000,
      );
      await signSettlement(t, `c21-sibling-operation-${siblingState}`, SETTLEMENT_HASH, 999);
      await succeedSettlement(t, `c21-sibling-operation-${siblingState}`, SETTLEMENT_HASH, 999);

      const after = await readCaseState(t, disputeId, fixture);
      const siblingAfter = await readCaseState(t, disputeId, siblingFixture);
      expect(siblingAfter.escrow).toEqual(siblingBefore.escrow);
      expect(siblingAfter.milestone).toEqual(siblingBefore.milestone);
      expect(after.milestone).toMatchObject({ status: "released", releaseTxHash: SETTLEMENT_HASH });
      expect(after.job?.status).toBe(
        siblingState === "funded"
          ? "funded"
          : siblingState === "disputed"
            ? "disputed"
            : "completed",
      );
    },
  );

  it("keeps generic sync retryable without finalizing disputed escrows, then lets settlement own finalization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c21-sync-boundary" });
    const disputeId = await createDispute(t, fixture);
    const onChainEscrowId = await getOnChainEscrowId(t, fixture.escrowId);

    await t.mutation(internal.syncMutations.recordEscrowSyncFailure, {
      escrowId: onChainEscrowId,
      onChainStatus: "disputed",
      errorMessage: "Temporary sync failure.",
    });
    const recovered = await t.mutation(internal.syncMutations.applyEscrowStatusSync, {
      escrowId: onChainEscrowId,
      onChainStatus: "disputed",
    });
    expect(recovered).toMatchObject({ ok: true, changed: true, newStatus: "disputed" });
    const repeated = await t.mutation(internal.syncMutations.applyEscrowStatusSync, {
      escrowId: onChainEscrowId,
      onChainStatus: "disputed",
    });
    expect(repeated).toMatchObject({ ok: true, changed: false, reason: "already_up_to_date" });

    const beforeDowngrade = await readCaseState(t, disputeId, fixture);
    const downgrade = await t.mutation(internal.syncMutations.applyEscrowStatusSync, {
      escrowId: onChainEscrowId,
      onChainStatus: "released",
    });
    expect(downgrade).toMatchObject({ ok: false, reason: "unsafe_status_downgrade" });
    const afterDowngrade = await readCaseState(t, disputeId, fixture);
    expect(afterDowngrade.escrow?.status).toBe(beforeDowngrade.escrow?.status);
    expect(afterDowngrade.job?.status).toBe(beforeDowngrade.job?.status);

    await seedScopedDisputeAdmin(t, ADMIN_A, { contractId: CONTRACT_ID, network: NETWORK });
    await t.mutation(api.admin.claimDispute, { ...adminContext(), disputeId });
    await startSettlement(t, disputeId, "c21-sync-settlement", "resolved_freelancer", 10_000);
    await signSettlement(t, "c21-sync-settlement");
    await succeedSettlement(t, "c21-sync-settlement");
    const finalized = await readCaseState(t, disputeId, fixture);
    expect(finalized.escrow).toMatchObject({ status: "released", releaseTxHash: SETTLEMENT_HASH });
    expect(finalized.job).toMatchObject({ status: "completed" });
  });

  it("preserves records for unauthorized/conflicting callbacks and rolls back settlement writes when a parent is missing", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, {
      parentType: "milestone",
      label: "c21-integrity",
    });
    const disputeId = await createDispute(t, fixture);
    const beforeUnauthorized = await readCaseState(t, disputeId, fixture);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainStarted, {
        disputeId,
        actorWallet: fixture.unrelatedWallet,
        actorWalletType: "external_wallet",
      }),
    ).rejects.toThrow(/participants|configured admin/i);
    expect(await readCaseState(t, disputeId, fixture)).toEqual(beforeUnauthorized);

    const settlement = await prepareSettlementCase(t, "milestone", "c21-integrity-settlement");
    const operationId = "c21-integrity-conflict";
    await startSettlement(t, settlement.disputeId, operationId);
    await signSettlement(t, operationId, SETTLEMENT_HASH, 700);
    const beforeConflict = await readCaseState(t, settlement.disputeId, settlement.fixture);
    await expect(succeedSettlement(t, operationId, "9".repeat(64), 700)).rejects.toThrow(
      /does not match the persisted signed operation/,
    );
    expect(await readCaseState(t, settlement.disputeId, settlement.fixture)).toEqual(
      beforeConflict,
    );

    await t.run(async ({ db }) => {
      if (settlement.fixture.milestoneId === undefined) {
        throw new Error("C21 integrity fixture requires a milestone.");
      }
      await db.delete(settlement.fixture.milestoneId);
    });
    const beforeMissingParent = await readCaseState(t, settlement.disputeId, settlement.fixture);
    await expect(succeedSettlement(t, operationId, SETTLEMENT_HASH, 700)).rejects.toThrow(
      /Milestone not found/,
    );
    expect(await readCaseState(t, settlement.disputeId, settlement.fixture)).toEqual(
      beforeMissingParent,
    );
  });
});
