/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const OWNER = `G${"A".repeat(55)}`;
const ADMIN_A = `G${"B".repeat(55)}`;
const ADMIN_B = `G${"C".repeat(55)}`;
const CLIENT = `G${"D".repeat(55)}`;
const FREELANCER = `G${"E".repeat(55)}`;
const API_SECRET = "convex-admin-test-secret";
const NETWORK = "testnet";
const CONTRACT_ID = `C${"F".repeat(55)}`;

function createTest() {
  return convexTest(schema, modules);
}

async function seedDispute(
  t: ReturnType<typeof createTest>,
  overrides: Record<string, unknown> = {},
) {
  return await t.run(async ({ db }) => {
    return await db.insert("disputes", {
      disputeNumber: "DSP-TEST-001",
      parentType: "job",
      parentId: "job-test-1",
      clientWallet: CLIENT,
      freelancerWallet: FREELANCER,
      openedByWallet: CLIENT,
      openedByWalletType: "external_wallet",
      openedByRole: "client",
      reasonCategory: "other",
      title: "Test dispute",
      description: "A seeded dispute for admin workflow tests.",
      evidenceAttachmentIds: [],
      relatedWorkSubmissionIds: [],
      relatedRevisionRequestIds: [],
      status: "open",
      onChainStatus: "not_marked",
      openedAt: 1,
      createdAt: 1,
      updatedAt: 1,
      ...overrides,
    } as never);
  });
}

async function seedMembership(
  t: ReturnType<typeof createTest>,
  wallet: string,
  accessState: "active" | "revoking" | "revoked" = "active",
) {
  return await t.run(async ({ db }) => {
    return await db.insert("disputeAdmins", {
      network: NETWORK,
      contractId: CONTRACT_ID,
      wallet,
      accessState,
      grantedByWallet: OWNER,
      grantedAt: 1,
      updatedAt: 1,
    });
  });
}

async function seedSettlementCase(t: ReturnType<typeof createTest>, assignedAdminWallet: string) {
  return await t.run(async ({ db }) => {
    const jobId = await db.insert("jobs", {
      title: "Seeded job",
      description: "Job for settlement coordination tests.",
      budget: 100,
      asset: "USDC",
      clientWallet: CLIENT,
      status: "disputed",
      jobHash: "job-hash",
      createdAt: 1,
      updatedAt: 1,
    });
    const escrowId = await db.insert("escrows", {
      jobId,
      escrowId: "18",
      clientWallet: CLIENT,
      freelancerWallet: FREELANCER,
      amount: 100,
      asset: "USDC",
      status: "disputed",
      createdAt: 1,
      updatedAt: 1,
    });
    const disputeId = await db.insert("disputes", {
      disputeNumber: "DSP-SETTLEMENT-001",
      parentType: "job",
      parentId: jobId,
      jobId,
      escrowId,
      onChainEscrowId: "18",
      escrowContractId: CONTRACT_ID,
      clientWallet: CLIENT,
      freelancerWallet: FREELANCER,
      openedByWallet: CLIENT,
      openedByWalletType: "external_wallet",
      openedByRole: "client",
      reasonCategory: "other",
      title: "Seeded settlement dispute",
      description: "A disputed escrow for settlement coordination tests.",
      evidenceAttachmentIds: [],
      relatedWorkSubmissionIds: [],
      relatedRevisionRequestIds: [],
      assignedAdminWallet,
      status: "under_review",
      onChainStatus: "marked",
      openedAt: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    return { jobId, escrowId, disputeId };
  });
}

function context(adminWallet: string) {
  return { adminWallet, adminApiSecret: API_SECRET };
}

describe("admin dispute authorization and coordination", () => {
  beforeEach(() => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", OWNER);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", API_SECRET);
    vi.stubEnv("STELLAR_NETWORK", NETWORK);
    vi.stubEnv("ESCROW_CONTRACT_ID", CONTRACT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("separates dispute capability from legacy profile roles and platform metrics", async () => {
    const t = createTest();
    await t.run(async ({ db }) => {
      await db.insert("users", { walletAddress: ADMIN_A, role: "admin", createdAt: 1 });
    });

    await expect(
      t.query(api.admin.getAdminCapabilities, { ...context(ADMIN_A) }),
    ).resolves.toMatchObject({ isOwner: false, isDisputeAdmin: false });
    await expect(
      t.query(api.admin.getAdminDashboardMetrics, { ...context(ADMIN_A) }),
    ).rejects.toThrow();
    await expect(
      t.query(api.admin.getAdminCapabilities, { adminWallet: ADMIN_A, adminApiSecret: "wrong" }),
    ).rejects.toThrow();

    await expect(
      t.query(api.admin.getAdminCapabilities, { ...context(OWNER) }),
    ).resolves.toMatchObject({ isOwner: true, isDisputeAdmin: true });
  });

  it("activates grants only on completion and disables access as soon as revocation starts", async () => {
    const t = createTest();
    await expect(
      t.mutation(api.admin.startDisputeAdminOperation, {
        ...context(ADMIN_A),
        wallet: ADMIN_B,
        action: "grant",
        operationId: "grant-from-non-owner-001",
      }),
    ).rejects.toThrow();

    const grant = await t.mutation(api.admin.startDisputeAdminOperation, {
      ...context(OWNER),
      wallet: ADMIN_A,
      action: "grant",
      operationId: "grant-admin-a-001",
    });
    await expect(
      t.query(api.admin.getAdminCapabilities, { ...context(ADMIN_A) }),
    ).resolves.toMatchObject({ isDisputeAdmin: false });

    await t.mutation(api.admin.recordDisputeAdminOperationTransaction, {
      ...context(OWNER),
      operationId: grant!.operationId,
      transactionHash: "a".repeat(64),
      transactionValidUntil: 500,
    });
    await t.mutation(api.admin.completeDisputeAdminOperation, {
      ...context(OWNER),
      operationId: grant!.operationId,
      result: "succeeded",
    });
    await expect(
      t.query(api.admin.getAdminCapabilities, { ...context(ADMIN_A) }),
    ).resolves.toMatchObject({ isDisputeAdmin: true });

    const revoke = await t.mutation(api.admin.startDisputeAdminOperation, {
      ...context(OWNER),
      wallet: ADMIN_A,
      action: "revoke",
      operationId: "revoke-admin-a-001",
    });
    await expect(
      t.query(api.admin.getAdminCapabilities, { ...context(ADMIN_A) }),
    ).resolves.toMatchObject({ isDisputeAdmin: false });

    await t.mutation(api.admin.recordDisputeAdminOperationTransaction, {
      ...context(OWNER),
      operationId: revoke!.operationId,
      transactionHash: "b".repeat(64),
      transactionValidUntil: 600,
    });
    await t.mutation(api.admin.completeDisputeAdminOperation, {
      ...context(OWNER),
      operationId: revoke!.operationId,
      result: "failed",
      errorMessage: "Chain execution failed.",
    });
    await expect(
      t.query(api.admin.getAdminCapabilities, { ...context(ADMIN_A) }),
    ).resolves.toMatchObject({ isDisputeAdmin: false });
  });

  it("allows one concurrent claim and rejects stale actions after reassignment", async () => {
    const t = createTest();
    await seedMembership(t, ADMIN_A);
    await seedMembership(t, ADMIN_B);
    const disputeId = await seedDispute(t);

    const claims = await Promise.allSettled([
      t.mutation(api.admin.claimDispute, { ...context(ADMIN_A), disputeId }),
      t.mutation(api.admin.claimDispute, { ...context(ADMIN_B), disputeId }),
    ]);
    expect(claims.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(claims.filter((result) => result.status === "rejected")).toHaveLength(1);

    const dispute = await t.run(({ db }) => db.get(disputeId));
    const previousAssignee = dispute?.assignedAdminWallet;
    const nextAssignee = previousAssignee === ADMIN_A ? ADMIN_B : ADMIN_A;
    await t.mutation(api.admin.assignDispute, {
      ...context(OWNER),
      disputeId,
      assignedAdminWallet: nextAssignee,
    });

    await expect(
      t.mutation(api.admin.addModeratorNote, {
        ...context(previousAssignee!),
        disputeId,
        message: "Stale moderator note.",
      }),
    ).rejects.toThrow();

    const assignmentEvents = await t.run(({ db }) =>
      db
        .query("disputeAssignmentEvents")
        .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
        .collect(),
    );
    expect(assignmentEvents.map((event) => event.type)).toEqual(["claimed", "owner_reassignment"]);
  });

  it("blocks owner assignment when the owner is a dispute participant", async () => {
    const t = createTest();
    await seedMembership(t, ADMIN_A);
    const disputeId = await seedDispute(t, { clientWallet: OWNER });

    await expect(
      t.mutation(api.admin.assignDispute, {
        ...context(OWNER),
        disputeId,
        assignedAdminWallet: ADMIN_A,
      }),
    ).rejects.toThrow();
  });

  it("serializes settlement attempts and locks assignment until recovery", async () => {
    const t = createTest();
    await seedMembership(t, ADMIN_A);
    const { disputeId, escrowId } = await seedSettlementCase(t, ADMIN_A);
    const input = {
      ...context(ADMIN_A),
      disputeId,
      status: "split_resolution" as const,
      freelancerShareBps: 5_000,
      resolutionNote: "Split approved.",
      operationId: "settlement-attempt-admin-a-001",
    };

    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, input),
    ).resolves.toMatchObject({
      operationId: input.operationId,
      freelancerShareBps: 5_000,
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, input),
    ).resolves.toMatchObject({
      operationId: input.operationId,
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionStarted, {
        ...input,
        operationId: "settlement-attempt-admin-a-002",
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.admin.assignDispute, {
        ...context(OWNER),
        disputeId,
        assignedAdminWallet: ADMIN_B,
      }),
    ).rejects.toThrow();

    await t.mutation(api.admin.recordDisputeResolutionSigned, {
      ...context(ADMIN_A),
      operationId: input.operationId,
      transactionHash: "c".repeat(64),
      transactionValidUntil: 700,
    });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionSigned, {
        ...context(ADMIN_A),
        operationId: input.operationId,
        transactionHash: "d".repeat(64),
        transactionValidUntil: 700,
      }),
    ).rejects.toThrow();

    const attempts = await t.run(({ db }) =>
      db
        .query("settlementAttempts")
        .withIndex("by_escrow_status", (q) =>
          q.eq("escrowDocumentId", escrowId).eq("status", "signed"),
        )
        .collect(),
    );
    expect(attempts).toHaveLength(1);
  });

  it("keeps confirmed settlement completion idempotent against later failure callbacks", async () => {
    const t = createTest();
    await seedMembership(t, ADMIN_A);
    const { disputeId, escrowId } = await seedSettlementCase(t, ADMIN_A);
    await t.run(async ({ db }) => {
      await db.insert("settlementAttempts", {
        disputeId,
        escrowDocumentId: escrowId,
        onChainEscrowId: "18",
        network: NETWORK,
        contractId: CONTRACT_ID,
        actorWallet: ADMIN_A,
        status: "succeeded",
        resolutionStatus: "split_resolution",
        freelancerShareBps: 5_000,
        operationId: "settlement-confirmed-admin-a-001",
        transactionHash: "e".repeat(64),
        transactionValidUntil: 800,
        createdAt: 1,
        updatedAt: 1,
        completedAt: 2,
      });
    });

    await expect(
      t.mutation(api.admin.recordDisputeResolutionSucceeded, {
        ...context(ADMIN_A),
        operationId: "settlement-confirmed-admin-a-001",
        transactionHash: "e".repeat(64),
        transactionValidUntil: 800,
      }),
    ).resolves.toMatchObject({ status: "split_resolution", resolutionTxHash: "e".repeat(64) });
    await expect(
      t.mutation(api.admin.recordDisputeResolutionFailed, {
        ...context(OWNER),
        operationId: "settlement-confirmed-admin-a-001",
        transactionHash: "e".repeat(64),
        errorMessage: "Late failure callback.",
      }),
    ).resolves.toBe(true);

    const attempt = await t.run(({ db }) =>
      db
        .query("settlementAttempts")
        .withIndex("by_operationId", (q) => q.eq("operationId", "settlement-confirmed-admin-a-001"))
        .unique(),
    );
    expect(attempt?.status).toBe("succeeded");
  });
});
