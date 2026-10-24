import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import { seedDisputeFixture, TEST_WALLETS, type BackendTest } from "../fixtures/disputes";

const OWNER = TEST_WALLETS.admin;
const ASSIGNED_ADMIN = "GADMINPREFLIGHTA";
const OTHER_ADMIN = "GADMINPREFLIGHTB";
const SECRET = "settlement-preflight-secret";
const NETWORK = "testnet";
const CONTRACT_ID = "settlement-preflight-contract";

function context(adminWallet: string, adminApiSecret = SECRET) {
  return { adminWallet, adminApiSecret };
}

async function seedAdmin(t: BackendTest, wallet: string) {
  await t.run(async ({ db }) => {
    await db.insert("disputeAdmins", {
      network: NETWORK,
      contractId: CONTRACT_ID,
      wallet,
      accessState: "active",
      grantedByWallet: OWNER,
      grantedAt: 1,
      updatedAt: 1,
    });
  });
}

async function seedDispute(t: BackendTest, assignedAdminWallet = ASSIGNED_ADMIN) {
  const fixture = await seedDisputeFixture(t, { label: "settlement-preflight" });
  const disputeId = await t.run(async ({ db }) => {
    const escrow = await db.get(fixture.escrowId);
    if (!escrow) {
      throw new Error("Settlement preflight escrow fixture is missing.");
    }

    const now = Date.now();
    await db.patch(fixture.escrowId, { status: "disputed", updatedAt: now });
    await db.patch(fixture.jobId, { status: "disputed", updatedAt: now });
    if (fixture.milestoneId !== undefined) {
      await db.patch(fixture.milestoneId, { status: "disputed", updatedAt: now });
    }

    return await db.insert("disputes", {
      disputeNumber: "DSP-SETTLEMENT-PREFLIGHT",
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      jobId: fixture.jobId,
      ...(fixture.parentType === "micro_gig"
        ? { microGigId: fixture.jobId }
        : { milestoneId: fixture.milestoneId! }),
      escrowId: fixture.escrowId,
      onChainEscrowId: escrow.escrowId,
      escrowContractId: CONTRACT_ID,
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
      openedByWallet: fixture.clientWallet,
      openedByWalletType: "external_wallet",
      openedByRole: "client",
      reasonCategory: "payment_release_disagreement",
      title: "Settlement preflight dispute",
      description: "Deterministic settlement preflight fixture.",
      evidenceAttachmentIds: [],
      relatedWorkSubmissionIds: [],
      relatedRevisionRequestIds: [],
      assignedAdminWallet,
      assignedAt: now,
      assignedByWallet: OWNER,
      status: "under_review",
      onChainStatus: "marked",
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { disputeId, fixture };
}

describe("getAdminSettlementPreflight", () => {
  beforeEach(() => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", OWNER);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", SECRET);
    vi.stubEnv("STELLAR_NETWORK", NETWORK);
    vi.stubEnv("ESCROW_CONTRACT_ID", CONTRACT_ID);
  });

  it("returns the persisted escrow target, backend scope, status, and participants", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, ASSIGNED_ADMIN);
    const { disputeId, fixture } = await seedDispute(t);

    await expect(
      t.query(api.admin.getAdminSettlementPreflight, {
        ...context(ASSIGNED_ADMIN),
        disputeId,
      }),
    ).resolves.toEqual({
      network: NETWORK,
      contractId: CONTRACT_ID,
      onChainEscrowId: `escrow-settlement-preflight`,
      escrowStatus: "disputed",
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
    });
  });

  it("rejects an invalid admin secret", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, ASSIGNED_ADMIN);
    const { disputeId } = await seedDispute(t);

    await expect(
      t.query(api.admin.getAdminSettlementPreflight, {
        ...context(ASSIGNED_ADMIN, "wrong-secret"),
        disputeId,
      }),
    ).rejects.toThrow(/Invalid admin API secret/);
  });

  it("rejects an active admin who is not assigned to the dispute", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, ASSIGNED_ADMIN);
    await seedAdmin(t, OTHER_ADMIN);
    const { disputeId } = await seedDispute(t);

    await expect(
      t.query(api.admin.getAdminSettlementPreflight, {
        ...context(OTHER_ADMIN),
        disputeId,
      }),
    ).rejects.toThrow(/Only the assigned dispute admin/);
  });

  it("rejects a participant even when that wallet is assigned", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, TEST_WALLETS.client);
    const { disputeId } = await seedDispute(t, TEST_WALLETS.client);

    await expect(
      t.query(api.admin.getAdminSettlementPreflight, {
        ...context(TEST_WALLETS.client),
        disputeId,
      }),
    ).rejects.toThrow(/participant cannot moderate or settle/);
  });

  it.each(["on-chain escrow ID", "contract ID", "participants", "parent"] as const)(
    "rejects mismatched persisted %s context",
    async (mismatch) => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, ASSIGNED_ADMIN);
      const { disputeId, fixture } = await seedDispute(t);
      const otherFixture =
        mismatch === "parent" ? await seedDisputeFixture(t, { label: "other-parent" }) : null;

      await t.run(async ({ db }) => {
        const patch =
          mismatch === "on-chain escrow ID"
            ? { onChainEscrowId: "different-on-chain-escrow" }
            : mismatch === "contract ID"
              ? { escrowContractId: "different-contract" }
              : mismatch === "participants"
                ? { clientWallet: fixture.unrelatedWallet }
                : { parentId: otherFixture!.jobId };
        await db.patch(disputeId, patch);
      });

      await expect(
        t.query(api.admin.getAdminSettlementPreflight, {
          ...context(ASSIGNED_ADMIN),
          disputeId,
        }),
      ).rejects.toThrow();
    },
  );
});
