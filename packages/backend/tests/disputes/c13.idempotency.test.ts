import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  makeDisputeFields,
  seedDisputeFixture,
  type BackendTest,
  type DisputeFixture,
  TEST_ADMIN_SECRET,
  TEST_WALLETS,
} from "../fixtures/disputes";

const MARK_ERROR = "The chain operation was rejected.";

async function createDispute(t: BackendTest, fixture: DisputeFixture, metadata?: unknown) {
  return await t.mutation(api.disputes.createDispute, {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_not_delivered",
    title: "C13 idempotency dispute",
    description: "Deterministic C13 dispute fixture.",
    ...(metadata !== undefined ? { metadata } : {}),
  });
}

async function readState(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async (ctx) => {
    const dispute = await ctx.db.get(disputeId);
    const [events, notifications, conversations, messages] = await Promise.all([
      ctx.db.query("disputeEvents").take(100),
      ctx.db.query("notifications").take(100),
      ctx.db.query("conversations").take(100),
      ctx.db.query("messages").take(100),
    ]);

    return { dispute, events, notifications, conversations, messages };
  });
}

function transitionArgs(
  disputeId: Id<"disputes">,
  actorWallet: string,
  actorWalletType: "external_wallet" | "passkey_smart_account" = "external_wallet",
) {
  return { disputeId, actorWallet, actorWalletType };
}

describe("C13 idempotent dispute chain phases", () => {
  it.each(["micro_gig", "milestone"] as const)(
    "preserves success timestamps and side-effect counts for %s callbacks",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c13-success-${parentType}`,
      });
      const disputeId = await createDispute(t, fixture);

      await t.mutation(
        api.disputes.markDisputeOnChainStarted,
        transitionArgs(disputeId, fixture.clientWallet),
      );
      vi.setSystemTime(Date.now() + 1_000);
      const successAt = Date.now();
      await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        transactionHash: "tx-c13-success",
      });
      const afterFirstSuccess = await readState(t, disputeId);

      vi.setSystemTime(successAt + 1_000);
      await expect(
        t.mutation(api.disputes.markDisputeOnChainSucceeded, {
          ...transitionArgs(disputeId, fixture.clientWallet),
          transactionHash: " tx-c13-success ",
          stellarExpertUrl: "https://example.invalid/different-url",
        }),
      ).resolves.toBe(true);
      const afterReplay = await readState(t, disputeId);

      expect(afterReplay.dispute).toEqual(afterFirstSuccess.dispute);
      expect(afterReplay.events).toHaveLength(afterFirstSuccess.events.length);
      expect(afterReplay.notifications).toHaveLength(afterFirstSuccess.notifications.length);
      expect(afterReplay.conversations).toHaveLength(afterFirstSuccess.conversations.length);
      expect(afterReplay.messages).toHaveLength(afterFirstSuccess.messages.length);
      expect(afterReplay.events.filter((event) => event.type === "dispute_opened")).toHaveLength(1);
      expect(
        afterReplay.events.filter((event) => event.type === "on_chain_mark_started"),
      ).toHaveLength(1);
      expect(
        afterReplay.events.filter((event) => event.type === "on_chain_mark_succeeded"),
      ).toHaveLength(1);
    },
  );

  it.each(["micro_gig", "milestone"] as const)(
    "keeps one failure side-effect set and supports a hashless retry for %s callbacks",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, {
        parentType,
        label: `c13-failure-${parentType}`,
      });
      const disputeId = await createDispute(t, fixture, { unrelatedMetadata: "keep-me" });

      await t.mutation(
        api.disputes.markDisputeOnChainStarted,
        transitionArgs(disputeId, fixture.freelancerWallet),
      );
      await t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.freelancerWallet, "passkey_smart_account"),
        errorMessage: MARK_ERROR,
      });
      const afterFirstFailure = await readState(t, disputeId);
      const firstFailureEvent = afterFirstFailure.events.find(
        (event) => event.type === "on_chain_mark_failed",
      );

      vi.setSystemTime(Date.now() + 1_000);
      await t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.freelancerWallet),
        errorMessage: "A later error must not replace the first failure.",
      });
      const afterRepeatedFailure = await readState(t, disputeId);

      expect(afterRepeatedFailure.dispute?.onChainStatus).toBe("mark_failed");
      expect(afterRepeatedFailure.dispute?.transactionHash).toBeUndefined();
      expect(afterRepeatedFailure.dispute?.updatedAt).toBe(afterFirstFailure.dispute?.updatedAt);
      expect(afterRepeatedFailure.dispute?.metadata).toEqual({
        unrelatedMetadata: "keep-me",
        onChainMarkError: MARK_ERROR,
      });
      expect(
        afterRepeatedFailure.events.filter((event) => event.type === "dispute_opened"),
      ).toHaveLength(1);
      expect(
        afterRepeatedFailure.events.filter((event) => event.type === "on_chain_mark_started"),
      ).toHaveLength(1);
      expect(
        afterRepeatedFailure.events.filter((event) => event.type === "on_chain_mark_failed"),
      ).toHaveLength(1);
      expect(afterRepeatedFailure.notifications).toHaveLength(
        afterFirstFailure.notifications.length,
      );
      expect(afterRepeatedFailure.messages).toHaveLength(afterFirstFailure.messages.length);
      expect(firstFailureEvent).toMatchObject({
        actorWallet: fixture.freelancerWallet,
        actorWalletType: "passkey_smart_account",
      });

      await t.mutation(
        api.disputes.markDisputeOnChainStarted,
        transitionArgs(disputeId, fixture.clientWallet),
      );
      const afterRetryStart = await readState(t, disputeId);
      expect(afterRetryStart.dispute).toMatchObject({
        onChainStatus: "marking",
        metadata: { unrelatedMetadata: "keep-me" },
      });
      expect(afterRetryStart.dispute?.metadata).not.toHaveProperty("onChainMarkError");
      expect(
        afterRetryStart.events.filter((event) => event.type === "on_chain_mark_started"),
      ).toHaveLength(2);
      expect(afterRetryStart.events.at(-1)).toMatchObject({
        type: "on_chain_mark_started",
        message: "On-chain dispute marking retry started.",
        actorWallet: fixture.clientWallet,
      });

      await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        transactionHash: "tx-c13-failure",
      });
      const afterSuccess = await readState(t, disputeId);
      expect(afterSuccess.dispute?.onChainStatus).toBe("marked");
      expect(afterSuccess.dispute?.metadata).toEqual({ unrelatedMetadata: "keep-me" });
      expect(
        afterSuccess.events.filter((event) => event.type === "on_chain_mark_failed"),
      ).toHaveLength(1);
      expect(
        afterSuccess.events.filter((event) => event.type === "on_chain_mark_succeeded"),
      ).toHaveLength(1);
    },
  );

  it("allows client, freelancer, and configured-admin callbacks while preserving actor data", async () => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", TEST_WALLETS.admin);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", TEST_ADMIN_SECRET);
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-actors" });
    const disputeId = await createDispute(t, fixture);

    await t.mutation(api.disputes.markDisputeOnChainStarted, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      actorWalletType: "external_wallet",
    });
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...transitionArgs(disputeId, fixture.freelancerWallet, "passkey_smart_account"),
      errorMessage: MARK_ERROR,
    });
    await t.mutation(api.disputes.markDisputeOnChainStarted, {
      ...transitionArgs(disputeId, fixture.adminWallet),
      actorWalletType: "external_wallet",
    });
    await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
      ...transitionArgs(disputeId, fixture.adminWallet),
      transactionHash: "tx-c13-actors",
    });

    const state = await readState(t, disputeId);
    expect(state.events.filter((event) => event.type === "on_chain_mark_started")).toHaveLength(2);
    expect(state.events.filter((event) => event.type === "on_chain_mark_failed")).toHaveLength(1);
    expect(state.events.filter((event) => event.type === "on_chain_mark_succeeded")).toHaveLength(
      1,
    );
    expect(state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "on_chain_mark_started",
          actorWallet: fixture.clientWallet,
          actorWalletType: "external_wallet",
          actorRole: "client",
        }),
        expect.objectContaining({
          type: "on_chain_mark_failed",
          actorWallet: fixture.freelancerWallet,
          actorWalletType: "passkey_smart_account",
          actorRole: "freelancer",
        }),
        expect.objectContaining({
          type: "on_chain_mark_started",
          actorWallet: fixture.adminWallet,
          actorWalletType: "external_wallet",
          actorRole: "moderator",
        }),
        expect.objectContaining({
          type: "on_chain_mark_succeeded",
          actorWallet: fixture.adminWallet,
          actorWalletType: "external_wallet",
          actorRole: "moderator",
        }),
      ]),
    );
  });

  it("fills an absent failure hash without repeating the first failure side effects", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-fill-failure-hash" });
    const disputeId = await createDispute(t, fixture);
    await t.mutation(
      api.disputes.markDisputeOnChainStarted,
      transitionArgs(disputeId, fixture.clientWallet),
    );
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      errorMessage: MARK_ERROR,
    });
    const beforeFill = await readState(t, disputeId);

    vi.setSystemTime(Date.now() + 1_000);
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      errorMessage: "The callback included the known failed transaction.",
      transactionHash: "tx-c13-filled",
    });
    const afterFill = await readState(t, disputeId);

    expect(afterFill.dispute?.transactionHash).toBe("tx-c13-filled");
    expect(afterFill.dispute?.updatedAt).toBe(beforeFill.dispute?.updatedAt);
    expect(afterFill.dispute?.metadata).toEqual({ onChainMarkError: MARK_ERROR });
    expect(afterFill.events).toHaveLength(beforeFill.events.length);
    expect(afterFill.notifications).toHaveLength(beforeFill.notifications.length);
    expect(afterFill.messages).toHaveLength(beforeFill.messages.length);
  });

  it("rejects unrelated wallets without changing any record", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-unrelated" });
    const disputeId = await createDispute(t, fixture);
    const before = await readState(t, disputeId);

    await expect(
      t.mutation(
        api.disputes.markDisputeOnChainStarted,
        transitionArgs(disputeId, fixture.unrelatedWallet),
      ),
    ).rejects.toThrow(/Only dispute participants or the configured admin wallet/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.unrelatedWallet),
        transactionHash: "tx-c13-unauthorized-success",
      }),
    ).rejects.toThrow(/Only dispute participants or the configured admin wallet/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.unrelatedWallet),
        errorMessage: MARK_ERROR,
      }),
    ).rejects.toThrow(/Only dispute participants or the configured admin wallet/);

    expect(await readState(t, disputeId)).toEqual(before);
  });

  it("rejects known-hash retries and conflicting callbacks without writes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-conflicts" });
    const disputeId = await createDispute(t, fixture);
    await t.mutation(
      api.disputes.markDisputeOnChainStarted,
      transitionArgs(disputeId, fixture.clientWallet),
    );
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      errorMessage: MARK_ERROR,
      transactionHash: "tx-c13-known",
    });
    const afterFailure = await readState(t, disputeId);

    await expect(
      t.mutation(
        api.disputes.markDisputeOnChainStarted,
        transitionArgs(disputeId, fixture.clientWallet),
      ),
    ).rejects.toThrow(/requires reconciliation/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        errorMessage: MARK_ERROR,
        transactionHash: "tx-c13-other",
      }),
    ).rejects.toThrow(/different transaction hash/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        transactionHash: "tx-c13-other",
      }),
    ).rejects.toThrow(/different transaction hash/);

    expect(await readState(t, disputeId)).toEqual(afterFailure);
  });

  it("rejects invalid phase callbacks without writes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-invalid-phases" });
    const disputeId = await createDispute(t, fixture);
    const before = await readState(t, disputeId);

    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        transactionHash: "tx-c13-before-start",
      }),
    ).rejects.toThrow(/must start before it can succeed/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        errorMessage: MARK_ERROR,
      }),
    ).rejects.toThrow(/must start before it can fail/);

    await t.mutation(
      api.disputes.markDisputeOnChainStarted,
      transitionArgs(disputeId, fixture.clientWallet),
    );
    await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      transactionHash: "tx-c13-marked",
    });
    const marked = await readState(t, disputeId);
    await expect(
      t.mutation(
        api.disputes.markDisputeOnChainStarted,
        transitionArgs(disputeId, fixture.clientWallet),
      ),
    ).rejects.toThrow(/cannot be reopened/);
    expect(await readState(t, disputeId)).toEqual(marked);
    expect(before.events).toHaveLength(1);
  });

  it("allows a late success after failure and ignores a stale failure after success", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-late-callbacks" });
    const disputeId = await createDispute(t, fixture);
    await t.mutation(
      api.disputes.markDisputeOnChainStarted,
      transitionArgs(disputeId, fixture.clientWallet),
    );
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      errorMessage: MARK_ERROR,
    });
    await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
      ...transitionArgs(disputeId, fixture.freelancerWallet),
      transactionHash: "tx-c13-late-success",
    });
    const afterSuccess = await readState(t, disputeId);

    vi.setSystemTime(Date.now() + 1_000);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        errorMessage: "Stale callback",
        transactionHash: "tx-c13-late-success",
      }),
    ).resolves.toBe(true);
    expect(await readState(t, disputeId)).toEqual(afterSuccess);
  });

  it.each(["resolved_client", "resolved_freelancer", "split_resolution", "cancelled"] as const)(
    "rejects state-changing callbacks for terminal review status %s",
    async (status) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { label: `c13-terminal-${status}` });
      const disputeId = await createDispute(t, fixture);
      await t.run(async (ctx) => ctx.db.patch(disputeId, { status }));
      const before = await readState(t, disputeId);

      await expect(
        t.mutation(
          api.disputes.markDisputeOnChainStarted,
          transitionArgs(disputeId, fixture.clientWallet),
        ),
      ).rejects.toThrow(/Terminal disputes/);
      await expect(
        t.mutation(api.disputes.markDisputeOnChainSucceeded, {
          ...transitionArgs(disputeId, fixture.clientWallet),
          transactionHash: "tx-c13-terminal",
        }),
      ).rejects.toThrow(/Terminal disputes/);
      await expect(
        t.mutation(api.disputes.markDisputeOnChainFailed, {
          ...transitionArgs(disputeId, fixture.clientWallet),
          errorMessage: MARK_ERROR,
        }),
      ).rejects.toThrow(/Terminal disputes/);

      expect(await readState(t, disputeId)).toEqual(before);
    },
  );

  it("permits a success replay and ignores a stale failure after terminal review", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-terminal-replay" });
    const disputeId = await createDispute(t, fixture);
    await t.mutation(
      api.disputes.markDisputeOnChainStarted,
      transitionArgs(disputeId, fixture.clientWallet),
    );
    await t.mutation(api.disputes.markDisputeOnChainSucceeded, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      transactionHash: "tx-c13-terminal-replay",
    });
    await t.run(async (ctx) => ctx.db.patch(disputeId, { status: "resolved_client" }));
    const before = await readState(t, disputeId);

    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        transactionHash: "tx-c13-terminal-replay",
      }),
    ).resolves.toBe(true);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        errorMessage: "Late failure",
        transactionHash: "tx-c13-terminal-replay",
      }),
    ).resolves.toBe(true);

    expect(await readState(t, disputeId)).toEqual(before);
  });

  it("validates blank input and missing disputes before any idempotent path", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-validation" });
    const disputeId = await createDispute(t, fixture);
    const before = await readState(t, disputeId);

    await expect(
      t.mutation(api.disputes.markDisputeOnChainStarted, transitionArgs(disputeId, "   ")),
    ).rejects.toThrow(/walletAddress is required/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        transactionHash: "   ",
      }),
    ).rejects.toThrow(/transactionHash cannot be empty/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        errorMessage: "   ",
      }),
    ).rejects.toThrow(/message is required/);
    expect(await readState(t, disputeId)).toEqual(before);

    await t.run(async (ctx) => ctx.db.delete(disputeId));
    const missingDisputeId = disputeId;
    await expect(
      t.mutation(
        api.disputes.markDisputeOnChainStarted,
        transitionArgs(missingDisputeId, fixture.clientWallet),
      ),
    ).rejects.toThrow(/Dispute not found/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(missingDisputeId, fixture.clientWallet),
        transactionHash: "tx-c13-missing",
      }),
    ).rejects.toThrow(/Dispute not found/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(missingDisputeId, fixture.clientWallet),
        errorMessage: MARK_ERROR,
      }),
    ).rejects.toThrow(/Dispute not found/);
  });

  it("keeps one dispute and one opening event through retries", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-opening" });
    const disputeId = await createDispute(t, fixture);
    await t.mutation(
      api.disputes.markDisputeOnChainStarted,
      transitionArgs(disputeId, fixture.clientWallet),
    );
    await t.mutation(
      api.disputes.markDisputeOnChainStarted,
      transitionArgs(disputeId, fixture.clientWallet),
    );
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      errorMessage: MARK_ERROR,
    });
    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...transitionArgs(disputeId, fixture.clientWallet),
      errorMessage: "Duplicate failure",
    });

    const state = await readState(t, disputeId);
    expect(state.dispute?._id).toBe(disputeId);
    expect(state.events.filter((event) => event.type === "dispute_opened")).toHaveLength(1);
    expect(state.events.filter((event) => event.type === "on_chain_mark_started")).toHaveLength(1);
    expect(state.events.filter((event) => event.type === "on_chain_mark_failed")).toHaveLength(1);
  });

  it("keeps records unchanged when a callback targets a different stored hash", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "c13-stored-hash" });
    const disputeId = await t.run(async (ctx) =>
      ctx.db.insert(
        "disputes",
        makeDisputeFields(fixture, {
          onChainStatus: "marked",
          transactionHash: "tx-c13-stored",
        }),
      ),
    );
    const before = await readState(t, disputeId);

    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        transactionHash: "tx-c13-conflicting",
      }),
    ).rejects.toThrow(/different transaction hash/);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...transitionArgs(disputeId, fixture.clientWallet),
        errorMessage: "Stale conflicting failure",
        transactionHash: "tx-c13-conflicting",
      }),
    ).rejects.toThrow(/different transaction hash/);

    expect(await readState(t, disputeId)).toEqual(before);
  });
});
