import { Account, nativeToScVal, rpc, StrKey } from "@stellar/stellar-sdk";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  seedDisputeFixture,
  seedSiblingMilestoneFixture,
  type BackendTest,
  type DisputeFixture,
} from "../fixtures/disputes";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const CONFIRMATION_URL = "https://stellar.expert/explorer/testnet/tx/c18-confirmed";
const ORIGINAL_METADATA = {
  preserved: true,
  nested: { source: "c18", values: ["keep", "all"] },
};
const RPC_CLIENT = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 11));
const RPC_FREELANCER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 12));
const RPC_CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 13));
const RPC_CONFIG = {
  rpcUrl: "https://rpc.example.test",
  readSourceAccount: RPC_CLIENT,
};
const SYNC_SCOPE = {
  expectedEscrowContractId: RPC_CONTRACT,
  expectedNetworkPassphrase: "Test SDF Network ; September 2015",
};

type ParentType = "micro_gig" | "milestone";
type WalletType = "external_wallet" | "passkey_smart_account";
type ActorCase = {
  actorRole: "client" | "freelancer";
  actorWalletType: WalletType;
  parentType: ParentType;
};

const ACTOR_CASES: ActorCase[] = [
  { actorRole: "client", actorWalletType: "external_wallet", parentType: "micro_gig" },
  { actorRole: "client", actorWalletType: "passkey_smart_account", parentType: "micro_gig" },
  { actorRole: "freelancer", actorWalletType: "external_wallet", parentType: "micro_gig" },
  { actorRole: "freelancer", actorWalletType: "passkey_smart_account", parentType: "micro_gig" },
  { actorRole: "client", actorWalletType: "external_wallet", parentType: "milestone" },
  { actorRole: "client", actorWalletType: "passkey_smart_account", parentType: "milestone" },
  { actorRole: "freelancer", actorWalletType: "external_wallet", parentType: "milestone" },
  { actorRole: "freelancer", actorWalletType: "passkey_smart_account", parentType: "milestone" },
];

function rpcResult(value: unknown) {
  return { result: { retval: nativeToScVal(value) } } as never;
}

function rpcEscrow(status: "Disputed" | "Funded" = "Disputed", escrowId = 42n) {
  return {
    escrow_id: escrowId,
    client: RPC_CLIENT,
    freelancer: RPC_FREELANCER,
    asset: RPC_CONTRACT,
    amount: 500n,
    job_hash: new Uint8Array(32),
    status: [status],
    created_at: 1n,
    funded_at: 2n,
    submitted_at: 0n,
    released_at: 0n,
  };
}

function actorWallet(fixture: DisputeFixture, actorRole: ActorCase["actorRole"]): string {
  return actorRole === "client" ? fixture.clientWallet : fixture.freelancerWallet;
}

async function createDispute(
  t: BackendTest,
  fixture: DisputeFixture,
  actorRole: ActorCase["actorRole"],
  actorWalletType: WalletType,
): Promise<Id<"disputes">> {
  return await t.mutation(api.disputes.createDispute, {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: actorWallet(fixture, actorRole),
    openedByWalletType: actorWalletType,
    reasonCategory: "payment_release_disagreement",
    title: "C18 marking reconciliation",
    description: "C18 keeps callback and escrow synchronization boundaries explicit.",
    metadata: ORIGINAL_METADATA,
  });
}

async function readState(t: BackendTest, disputeId: Id<"disputes">, fixture: DisputeFixture) {
  return await t.run(async ({ db }) => ({
    dispute: await db.get(disputeId),
    events: await db
      .query("disputeEvents")
      .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
      .collect(),
    messages: await db.query("messages").collect(),
    notifications: await db.query("notifications").collect(),
    conversations: await db.query("conversations").collect(),
    transactions: await db.query("transactions").collect(),
    escrow: await db.get(fixture.escrowId),
    job: await db.get(fixture.jobId),
    milestone: fixture.milestoneId === undefined ? null : await db.get(fixture.milestoneId),
  }));
}

async function readCallbackState(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async ({ db }) => ({
    dispute: await db.get(disputeId),
    events: await db
      .query("disputeEvents")
      .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
      .collect(),
    messages: await db.query("messages").collect(),
    notifications: await db.query("notifications").collect(),
    conversations: await db.query("conversations").collect(),
    transactions: await db.query("transactions").collect(),
  }));
}

async function startMark(
  t: BackendTest,
  disputeId: Id<"disputes">,
  fixture: DisputeFixture,
  actorRole: ActorCase["actorRole"],
  actorWalletType: WalletType,
) {
  return await t.mutation(api.disputes.markDisputeOnChainStarted, {
    disputeId,
    actorWallet: actorWallet(fixture, actorRole),
    actorWalletType,
  });
}

async function failMark(
  t: BackendTest,
  disputeId: Id<"disputes">,
  fixture: DisputeFixture,
  actorRole: ActorCase["actorRole"],
  actorWalletType: WalletType,
  errorMessage = "C18 mark failed.",
  transactionHash?: string,
) {
  return await t.mutation(api.disputes.markDisputeOnChainFailed, {
    disputeId,
    actorWallet: actorWallet(fixture, actorRole),
    actorWalletType,
    errorMessage,
    ...(transactionHash === undefined ? {} : { transactionHash }),
  });
}

async function succeedMark(
  t: BackendTest,
  disputeId: Id<"disputes">,
  fixture: DisputeFixture,
  actorRole: ActorCase["actorRole"],
  actorWalletType: WalletType,
  transactionHash = HASH,
  stellarExpertUrl?: string,
) {
  return await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
    disputeId,
    actorWallet: actorWallet(fixture, actorRole),
    actorWalletType,
    transactionHash,
    ...(stellarExpertUrl === undefined ? {} : { stellarExpertUrl }),
  });
}

async function prepareSyncEscrow(t: BackendTest, fixture: DisputeFixture) {
  await t.run(async ({ db }) => db.patch(fixture.escrowId, { escrowId: "42" }));
}

describe("C18 participant marking recovery and reconciliation", () => {
  beforeEach(() => {
    vi.stubEnv("STELLAR_NETWORK", "testnet");
    vi.stubEnv("STELLAR_RPC_URL", RPC_CONFIG.rpcUrl);
    vi.stubEnv("ESCROW_CONTRACT_ID", RPC_CONTRACT);
    vi.stubEnv("REPUTATION_CONTRACT_ID", RPC_CONTRACT);
    vi.stubEnv("STELLAR_READ_SOURCE_ACCOUNT", RPC_CONFIG.readSourceAccount);
    vi.spyOn(rpc.Server.prototype, "getAccount").mockResolvedValue(new Account(RPC_CLIENT, "1"));
    vi.spyOn(rpc.Server.prototype, "sendTransaction").mockRejectedValue(
      new Error("C18 reads must not submit transactions."),
    );
  });

  it.each(ACTOR_CASES)(
    "rejects stored-hash retries in not_marked/mark_failed and preserves duplicate marking in marking ($parentType $actorRole $actorWalletType)",
    async ({ parentType, actorRole, actorWalletType }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c18-phases-${parentType}-${actorRole}-${actorWalletType}`,
      });
      const disputeId = await createDispute(t, fixture, actorRole, actorWalletType);

      for (const onChainStatus of ["not_marked", "marking", "mark_failed"] as const) {
        await t.run(async ({ db }) =>
          db.patch(disputeId, {
            onChainStatus,
            transactionHash: HASH,
            stellarExpertUrl: CONFIRMATION_URL,
            markedDisputedAt: 7_777,
            updatedAt: 8_888,
            metadata: { ...ORIGINAL_METADATA, onChainMarkError: "preserve this detail" },
          }),
        );
        const before = await readState(t, disputeId, fixture);

        if (onChainStatus === "marking") {
          await expect(startMark(t, disputeId, fixture, actorRole, actorWalletType)).resolves.toBe(
            true,
          );
        } else {
          await expect(
            startMark(t, disputeId, fixture, actorRole, actorWalletType),
          ).rejects.toThrow(/requires reconciliation/);
        }

        expect(await readState(t, disputeId, fixture)).toEqual(before);
      }
    },
  );

  it.each(ACTOR_CASES)(
    "recovers hashless failure for both participants without duplicating effects ($parentType $actorRole $actorWalletType)",
    async ({ parentType, actorRole, actorWalletType }) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c18-recovery-${parentType}-${actorRole}-${actorWalletType}`,
      });
      const disputeId = await createDispute(t, fixture, actorRole, actorWalletType);

      await startMark(t, disputeId, fixture, actorRole, actorWalletType);
      await failMark(
        t,
        disputeId,
        fixture,
        actorRole,
        actorWalletType,
        "First outcome was unknown.",
      );
      const failed = await readState(t, disputeId, fixture);
      expect(failed.dispute).toMatchObject({
        onChainStatus: "mark_failed",
        metadata: { ...ORIGINAL_METADATA, onChainMarkError: "First outcome was unknown." },
      });
      expect(failed.dispute?.transactionHash).toBeUndefined();

      await startMark(t, disputeId, fixture, actorRole, actorWalletType);
      await failMark(
        t,
        disputeId,
        fixture,
        actorRole,
        actorWalletType,
        "Retry attempt outcome was unknown.",
      );
      const retried = await readState(t, disputeId, fixture);
      expect(retried.dispute).toMatchObject({
        onChainStatus: "mark_failed",
        metadata: { ...ORIGINAL_METADATA, onChainMarkError: "Retry attempt outcome was unknown." },
      });
      for (const event of failed.events) expect(retried.events).toContainEqual(event);

      await failMark(
        t,
        disputeId,
        fixture,
        actorRole,
        actorWalletType,
        "Late hash enrichment.",
        ` ${HASH} `,
      );
      const enriched = await readState(t, disputeId, fixture);
      expect(enriched.dispute).toMatchObject({ transactionHash: HASH });
      expect(enriched.events).toEqual(retried.events);
      expect(enriched.messages).toEqual(retried.messages);
      expect(enriched.notifications).toEqual(retried.notifications);
      expect(enriched.conversations).toEqual(retried.conversations);
      expect(enriched.transactions).toEqual(retried.transactions);
      expect(enriched.escrow).toEqual(retried.escrow);
      expect(enriched.job).toEqual(retried.job);
      expect(enriched.milestone).toEqual(retried.milestone);

      for (const callback of [
        () => startMark(t, disputeId, fixture, actorRole, actorWalletType),
        () =>
          failMark(
            t,
            disputeId,
            fixture,
            actorRole,
            actorWalletType,
            "Conflicting failure.",
            OTHER_HASH,
          ),
        () => succeedMark(t, disputeId, fixture, actorRole, actorWalletType, OTHER_HASH),
      ]) {
        const before = await readState(t, disputeId, fixture);
        await expect(callback()).rejects.toThrow(/reconciliation|different transaction hash/i);
        expect(await readState(t, disputeId, fixture)).toEqual(before);
      }

      await succeedMark(t, disputeId, fixture, actorRole, actorWalletType, HASH, CONFIRMATION_URL);
      const confirmed = await readState(t, disputeId, fixture);
      expect(confirmed.dispute).toMatchObject({
        onChainStatus: "marked",
        transactionHash: HASH,
        stellarExpertUrl: CONFIRMATION_URL,
        metadata: ORIGINAL_METADATA,
        markedDisputedAt: expect.any(Number),
      });
      expect(confirmed.events.filter((event) => event.type === "dispute_opened")).toHaveLength(1);
      expect(
        confirmed.events.filter((event) => event.type === "on_chain_mark_started"),
      ).toHaveLength(2);
      expect(
        confirmed.events.filter((event) => event.type === "on_chain_mark_failed"),
      ).toHaveLength(2);
      expect(
        confirmed.events.filter((event) => event.type === "on_chain_mark_succeeded"),
      ).toHaveLength(1);
      expect(confirmed.events).toHaveLength(6);
      expect(
        confirmed.messages.filter(
          (message) => message.eventType === "dispute_on_chain_mark_failed",
        ),
      ).toHaveLength(2);
      expect(
        confirmed.messages.filter((message) => message.eventType === "dispute_on_chain_marked"),
      ).toHaveLength(1);
      expect(confirmed.messages).toHaveLength(4);
      expect(
        confirmed.notifications.filter(
          (notification) => notification.type === "dispute_on_chain_mark_failed",
        ),
      ).toHaveLength(2);
      expect(
        confirmed.notifications.filter(
          (notification) => notification.type === "dispute_on_chain_marked",
        ),
      ).toHaveLength(2);
      expect(confirmed.notifications).toHaveLength(5);
      expect(confirmed.transactions).toHaveLength(0);
      expect(
        confirmed.events.find((event) => event.type === "on_chain_mark_started"),
      ).toMatchObject({
        actorWallet: actorWallet(fixture, actorRole),
        actorWalletType,
      });
      expect(confirmed.events.find((event) => event.type === "on_chain_mark_failed")).toMatchObject(
        {
          actorWallet: actorWallet(fixture, actorRole),
          actorWalletType,
        },
      );
      expect(
        confirmed.events.find((event) => event.type === "on_chain_mark_succeeded"),
      ).toMatchObject({
        actorWallet: actorWallet(fixture, actorRole),
        actorWalletType,
        transactionHash: HASH,
      });

      const failureEvents = confirmed.events.filter(
        (event) => event.type === "on_chain_mark_failed",
      );
      expect(failureEvents.map((event) => event.metadata.errorMessage)).toEqual([
        "First outcome was unknown.",
        "Retry attempt outcome was unknown.",
      ]);
      expect(failureEvents.every((event) => event.transactionHash === undefined)).toBe(true);

      const confirmationTimestamp = confirmed.dispute?.markedDisputedAt;
      for (const callback of [
        () => succeedMark(t, disputeId, fixture, actorRole, actorWalletType, HASH),
        () => failMark(t, disputeId, fixture, actorRole, actorWalletType, "Stale failure."),
        () => failMark(t, disputeId, fixture, actorRole, actorWalletType, "Stale hash.", HASH),
      ]) {
        await expect(callback()).resolves.toBe(true);
        expect(await readState(t, disputeId, fixture)).toEqual(confirmed);
      }
      expect((await readState(t, disputeId, fixture)).dispute?.markedDisputedAt).toBe(
        confirmationTimestamp,
      );
    },
  );

  it.each(["micro_gig", "milestone"] as const)(
    "checks authorization and argument validation before replay returns for %s",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c18-guards-${parentType}`,
      });
      const disputeId = await createDispute(t, fixture, "client", "external_wallet");
      await startMark(t, disputeId, fixture, "client", "external_wallet");
      await succeedMark(t, disputeId, fixture, "client", "external_wallet");
      const confirmed = await readState(t, disputeId, fixture);
      const unauthorized = {
        disputeId,
        actorWallet: fixture.unrelatedWallet,
        actorWalletType: "passkey_smart_account" as const,
      };

      await expect(
        t.mutation(api.disputes.markDisputeOnChainStarted, unauthorized),
      ).rejects.toThrow(/Only dispute participants or the configured admin wallet/);
      await expect(
        t.mutation(api.disputes.markDisputeOnChainSucceeded, {
          ...unauthorized,
          transactionHash: HASH,
        }),
      ).rejects.toThrow(/Only dispute participants or the configured admin wallet/);
      await expect(
        t.mutation(api.disputes.markDisputeOnChainFailed, {
          ...unauthorized,
          errorMessage: "Unauthorized replay.",
        }),
      ).rejects.toThrow(/Only dispute participants or the configured admin wallet/);
      expect(await readState(t, disputeId, fixture)).toEqual(confirmed);

      await expect(
        t.mutation(api.disputes.markDisputeOnChainSucceeded, {
          disputeId,
          actorWallet: fixture.clientWallet,
          actorWalletType: "external_wallet",
          transactionHash: " ",
        }),
      ).rejects.toThrow(/transactionHash/);
      await expect(
        t.mutation(api.disputes.markDisputeOnChainFailed, {
          disputeId,
          actorWallet: fixture.clientWallet,
          actorWalletType: "external_wallet",
          errorMessage: " ",
        }),
      ).rejects.toThrow(/message/);
      expect(await readState(t, disputeId, fixture)).toEqual(confirmed);

      await t.run(async ({ db }) => db.patch(disputeId, { status: "cancelled" }));
      const terminal = await readState(t, disputeId, fixture);
      await expect(
        succeedMark(t, disputeId, fixture, "client", "external_wallet", HASH),
      ).resolves.toBe(true);
      await expect(
        failMark(t, disputeId, fixture, "client", "external_wallet", "Stale terminal failure."),
      ).resolves.toBe(true);
      await expect(
        succeedMark(t, disputeId, fixture, "client", "external_wallet", OTHER_HASH),
      ).rejects.toThrow(/different transaction hash/);
      expect(await readState(t, disputeId, fixture)).toEqual(terminal);
    },
  );

  it("keeps sibling milestone bookkeeping isolated across callbacks and replay paths", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { parentType: "milestone", label: "c18-sibling" });
    const sibling = await seedSiblingMilestoneFixture(t, fixture, { label: "c18-sibling" });
    const disputeId = await createDispute(t, fixture, "freelancer", "passkey_smart_account");
    const before = await t.run(async ({ db }) => ({
      escrow: await db.get(sibling.escrowId),
      milestone: await db.get(sibling.milestoneId),
    }));

    await startMark(t, disputeId, fixture, "freelancer", "passkey_smart_account");
    await failMark(
      t,
      disputeId,
      fixture,
      "freelancer",
      "passkey_smart_account",
      "Sibling-safe failure.",
    );
    await failMark(t, disputeId, fixture, "freelancer", "passkey_smart_account", "Replay.", HASH);
    await succeedMark(t, disputeId, fixture, "freelancer", "passkey_smart_account", HASH);
    await succeedMark(t, disputeId, fixture, "freelancer", "passkey_smart_account", HASH);
    await failMark(t, disputeId, fixture, "freelancer", "passkey_smart_account", "Stale replay.");

    expect(
      await t.run(async ({ db }) => ({
        escrow: await db.get(sibling.escrowId),
        milestone: await db.get(sibling.milestoneId),
      })),
    ).toEqual(before);
  });

  it.each([
    ["micro_gig", "callback-before-sync"],
    ["micro_gig", "sync-before-callback"],
    ["milestone", "callback-before-sync"],
    ["milestone", "sync-before-callback"],
  ] as const)(
    "keeps RPC sync separate from marking confirmation for %s in %s order",
    async (parentType, order) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c18-sync-${parentType}-${order}`,
      });
      const disputeId = await createDispute(t, fixture, "client", "external_wallet");
      await prepareSyncEscrow(t, fixture);
      const simulate = vi.spyOn(rpc.Server.prototype, "simulateTransaction");
      simulate
        .mockResolvedValueOnce(rpcResult({ ...rpcEscrow(), escrow_id: 43n }))
        .mockResolvedValueOnce(rpcResult(rpcEscrow()))
        .mockResolvedValueOnce(rpcResult(rpcEscrow()));

      if (order === "callback-before-sync") {
        await startMark(t, disputeId, fixture, "client", "external_wallet");
        await failMark(t, disputeId, fixture, "client", "external_wallet", "C18 RPC is pending.");
      }

      const callbackBeforeSync = await readCallbackState(t, disputeId);
      await expect(
        t.action(api.sync.syncEscrowStatus, { escrowId: "42", ...SYNC_SCOPE }),
      ).resolves.toMatchObject({
        ok: false,
        reason: "onchain_read_failed",
      });
      expect(await readCallbackState(t, disputeId)).toEqual(callbackBeforeSync);

      const failedSyncEscrow = await readState(t, disputeId, fixture);
      expect(failedSyncEscrow.dispute?.transactionHash).toBeUndefined();
      expect(failedSyncEscrow.escrow).toMatchObject({
        status: "funded",
        lastSyncOutcome: "failed",
      });

      const beforeSuccessfulSync = await readCallbackState(t, disputeId);
      await expect(
        t.action(api.sync.syncEscrowStatus, { escrowId: "42", ...SYNC_SCOPE }),
      ).resolves.toMatchObject({
        ok: true,
        changed: true,
        newStatus: "disputed",
      });
      expect(await readCallbackState(t, disputeId)).toEqual(beforeSuccessfulSync);

      const mirrored = await readState(t, disputeId, fixture);
      expect(mirrored.dispute?.onChainStatus).toBe(
        order === "callback-before-sync" ? "mark_failed" : "not_marked",
      );
      expect(mirrored.dispute?.transactionHash).toBeUndefined();
      expect(mirrored.escrow).toMatchObject({ status: "disputed" });
      expect(mirrored.escrow?.disputeTxHash).toBeUndefined();
      expect(mirrored.job?.status).toBe("disputed");
      if (parentType === "milestone") {
        expect(mirrored.milestone).toMatchObject({ status: "disputed" });
        expect(mirrored.milestone?.disputeTxHash).toBeUndefined();
      }

      const beforeRepeatedSync = await readCallbackState(t, disputeId);
      await expect(
        t.action(api.sync.syncEscrowStatus, { escrowId: "42", ...SYNC_SCOPE }),
      ).resolves.toMatchObject({
        ok: true,
        changed: false,
        reason: "already_up_to_date",
      });
      expect(await readCallbackState(t, disputeId)).toEqual(beforeRepeatedSync);

      if (order === "sync-before-callback") {
        await startMark(t, disputeId, fixture, "client", "external_wallet");
      }
      await succeedMark(t, disputeId, fixture, "client", "external_wallet", HASH);
      const confirmed = await readState(t, disputeId, fixture);
      expect(confirmed.dispute).toMatchObject({ onChainStatus: "marked", transactionHash: HASH });
      expect(confirmed.escrow).toMatchObject({ status: "disputed" });
      expect(confirmed.escrow?.disputeTxHash).toBeUndefined();
      expect(confirmed.dispute?.stellarExpertUrl).toBeDefined();
      expect(
        confirmed.events.filter((event) => event.type === "on_chain_mark_succeeded"),
      ).toHaveLength(1);

      await expect(
        failMark(t, disputeId, fixture, "client", "external_wallet", "Stale sync failure."),
      ).resolves.toBe(true);
      expect(await readState(t, disputeId, fixture)).toEqual(confirmed);
      expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
    },
  );
});
