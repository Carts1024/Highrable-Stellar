import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import { seedDisputeFixture, type DisputeParentKind } from "../fixtures/disputes";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const METADATA = { context: { preserved: true }, tags: ["original"] };
const TERMINAL = [
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const;
const PHASES = ["marking", "hashless_failure", "known_failure", "confirmed"] as const;

function tick() {
  vi.setSystemTime(Date.now() + 1_000);
}

async function setup(parentType: DisputeParentKind = "micro_gig") {
  const t = convexTest(schema, modules);
  const fixture = await seedDisputeFixture(t, { parentType, label: "c14" });
  const disputeId = await t.mutation(api.disputes.createDispute, {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_not_delivered",
    title: "C14 callback coverage",
    description: "Recorded evidence survives callback recovery.",
    metadata: METADATA,
  });
  const args = {
    disputeId,
    actorWallet: fixture.clientWallet,
    actorWalletType: "external_wallet" as const,
  };
  const start = (actorWallet = args.actorWallet) =>
    t.mutation(api.disputes.markDisputeOnChainStarted, { ...args, actorWallet });
  const fail = (
    transactionHash?: string,
    errorMessage = "First failure",
    actorWallet = args.actorWallet,
  ) =>
    t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...args,
      actorWallet,
      errorMessage,
      ...(transactionHash === undefined ? {} : { transactionHash }),
    });
  const succeed = (transactionHash = HASH, actorWallet = args.actorWallet) =>
    t.mutation(api.disputes.markDisputeOnChainSucceeded, { ...args, actorWallet, transactionHash });
  const read = () =>
    t.run(async ({ db }) => ({
      dispute: await db.get(disputeId),
      events: await db.query("disputeEvents").collect(),
      messages: await db.query("messages").collect(),
      notifications: await db.query("notifications").collect(),
      conversations: await db.query("conversations").collect(),
      transactions: await db.query("transactions").collect(),
      escrow: await db.get(fixture.escrowId),
      job: await db.get(fixture.jobId),
      milestone: fixture.milestoneId ? await db.get(fixture.milestoneId) : null,
    }));
  // Advance time for every rejection/replay so timestamp writes cannot hide in equality checks.
  const unchanged = async (callback: () => Promise<boolean>, error?: RegExp) => {
    const before = await read();
    tick();
    if (error) await expect(callback()).rejects.toThrow(error);
    else await expect(callback()).resolves.toBe(true);
    expect(await read()).toEqual(before);
  };
  return { t, fixture, disputeId, start, fail, succeed, read, unchanged };
}

type State = Awaited<ReturnType<Awaited<ReturnType<typeof setup>>["read"]>>;

function expectEffects(state: State, starts: number, failures: number, successes: number) {
  expect(state.events.filter((e) => e.type === "dispute_opened")).toHaveLength(1);
  expect(state.events.filter((e) => e.type === "on_chain_mark_started")).toHaveLength(starts);
  expect(state.events.filter((e) => e.type === "on_chain_mark_failed")).toHaveLength(failures);
  expect(state.events.filter((e) => e.type === "on_chain_mark_succeeded")).toHaveLength(successes);
  expect(state.events).toHaveLength(1 + starts + failures + successes);
  expect(state.messages.filter((m) => m.eventType === "dispute_on_chain_mark_failed")).toHaveLength(
    failures,
  );
  expect(state.messages.filter((m) => m.eventType === "dispute_on_chain_marked")).toHaveLength(
    successes,
  );
  expect(state.messages).toHaveLength(1 + failures + successes);
  expect(state.notifications.filter((n) => n.type === "dispute_on_chain_mark_failed")).toHaveLength(
    failures,
  );
  expect(state.notifications.filter((n) => n.type === "dispute_on_chain_marked")).toHaveLength(
    2 * successes,
  );
  expect(state.notifications).toHaveLength(1 + failures + 2 * successes);
  expect(state.conversations).toHaveLength(1);
  expect(state.transactions).toHaveLength(0);
}

function expectGuidance(state: State, hash?: string) {
  const event = state.events.find((e) => e.type === "on_chain_mark_failed");
  const message = state.messages.find((m) => m.eventType === "dispute_on_chain_mark_failed");
  const notification = state.notifications.find((n) => n.type === "dispute_on_chain_mark_failed");
  const guidance = hash
    ? "The recorded transaction hash requires reconciliation before retrying."
    : "Retry only if the operation was not submitted; otherwise, reconcile its outcome first.";
  for (const text of [event?.message, message?.body, notification?.body])
    expect(text).toContain(guidance);
  expect(event?.transactionHash).toBe(hash);
  expect(message?.eventPayload.transactionHash).toBe(hash);
  expect(state.dispute?.transactionHash).toBe(hash);
  expect(notification?.recipientWallet).toBe(state.dispute?.openedByWallet);
}

describe.each(["micro_gig", "milestone"] as const)("C14 %s marking callbacks", (parentType) => {
  it.each(TERMINAL.flatMap((status) => PHASES.map((phase) => ({ status, phase }))))(
    "preserves terminal $status records in $phase",
    async ({ status, phase }) => {
      const c = await setup(parentType);
      await c.start();
      if (phase === "hashless_failure") await c.fail();
      if (phase === "known_failure") await c.fail(HASH);
      if (phase === "confirmed") await c.succeed();
      await c.t.run(async ({ db }) => db.patch(c.disputeId, { status }));
      await c.unchanged(() => c.start(), /Terminal disputes/);
      await c.unchanged(() => c.succeed(), phase === "confirmed" ? undefined : /Terminal disputes/);
      await c.unchanged(() => c.fail(), phase === "marking" ? /Terminal disputes/ : undefined);
      // Hash enrichment is a state change, including when the failure itself is a replay.
      await c.unchanged(
        () => c.fail(HASH),
        phase === "marking" || phase === "hashless_failure" ? /Terminal disputes/ : undefined,
      );
      await c.unchanged(
        () => c.succeed(OTHER_HASH),
        phase === "known_failure" || phase === "confirmed"
          ? /different transaction hash/
          : /Terminal disputes/,
      );
      await c.unchanged(
        () => c.fail(OTHER_HASH),
        phase === "known_failure" || phase === "confirmed"
          ? /different transaction hash/
          : /Terminal disputes/,
      );
    },
  );

  it.each(PHASES)("authorizes before idempotent returns in %s", async (phase) => {
    const c = await setup(parentType);
    await c.start();
    if (phase === "hashless_failure") await c.fail();
    if (phase === "known_failure") await c.fail(HASH);
    if (phase === "confirmed") await c.succeed();
    const unauthorized = /Only dispute participants or the configured admin wallet/;
    await c.unchanged(() => c.start(c.fixture.unrelatedWallet), unauthorized);
    await c.unchanged(() => c.succeed(HASH, c.fixture.unrelatedWallet), unauthorized);
    await c.unchanged(
      () => c.fail(undefined, "Unauthorized replay", c.fixture.unrelatedWallet),
      unauthorized,
    );
    await c.unchanged(
      () => c.fail(HASH, "Unauthorized hash", c.fixture.unrelatedWallet),
      unauthorized,
    );
  });

  it("preserves history and metadata across three hashless failure/retry cycles", async () => {
    const c = await setup(parentType);
    const opening = await c.read();
    const history: State["events"] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      tick();
      await expect(c.start()).resolves.toBe(true);
      const marking = await c.read();
      expect(marking.dispute).toMatchObject({
        onChainStatus: "marking",
        metadata: METADATA,
        updatedAt: Date.now(),
      });
      expectEffects(marking, attempt, attempt - 1, 0);
      await c.unchanged(() => c.start());
      tick();
      await expect(c.fail(undefined, `Failure ${attempt}`)).resolves.toBe(true);
      const failed = await c.read();
      expect(failed.dispute).toMatchObject({
        onChainStatus: "mark_failed",
        updatedAt: Date.now(),
        metadata: { ...METADATA, onChainMarkError: `Failure ${attempt}` },
      });
      expectGuidance(failed);
      expectEffects(failed, attempt, attempt, 0);
      for (const event of history) expect(failed.events).toContainEqual(event);
      history.push(
        ...failed.events.filter(
          (e) => e.type === "on_chain_mark_failed" && !history.some((old) => old._id === e._id),
        ),
      );
      await c.unchanged(() => c.fail(undefined, "Replay must preserve first failure"));
    }
    tick();
    await c.start();
    await c.unchanged(() => c.start());
    tick();
    await expect(c.succeed()).resolves.toBe(true);
    const confirmed = await c.read();
    expectEffects(confirmed, 4, 3, 1);
    expect(confirmed.dispute).toMatchObject({
      onChainStatus: "marked",
      metadata: METADATA,
      markedDisputedAt: Date.now(),
      updatedAt: Date.now(),
    });
    for (const event of [...opening.events, ...history])
      expect(confirmed.events).toContainEqual(event);
    expect(
      confirmed.events
        .filter((e) => e.type === "on_chain_mark_failed")
        .map((e) => e.metadata.errorMessage),
    ).toEqual(["Failure 1", "Failure 2", "Failure 3"]);
    expect(confirmed.escrow).toEqual(opening.escrow);
    expect(confirmed.job).toEqual(opening.job);
    expect(confirmed.milestone).toEqual(opening.milestone);
    await c.unchanged(() => c.succeed());
    await c.unchanged(() => c.fail());
    await c.unchanged(() => c.fail(HASH));
  });

  it("enriches only the absent hash, blocks retry, then accepts matching success", async () => {
    const c = await setup(parentType);
    await c.start();
    await c.fail();
    const failed = await c.read();
    tick();
    await expect(c.fail(` ${HASH} `, "Later details")).resolves.toBe(true);
    expect(await c.read()).toEqual({
      ...failed,
      dispute: { ...failed.dispute, transactionHash: HASH },
    });
    await c.unchanged(() => c.start(), /requires reconciliation/);
    await c.unchanged(() => c.fail(HASH, "Repeated details"));
    await c.unchanged(() => c.fail(OTHER_HASH), /different transaction hash/);
    await c.unchanged(() => c.succeed(OTHER_HASH), /different transaction hash/);
    tick();
    await expect(c.succeed()).resolves.toBe(true);
    const confirmed = await c.read();
    expectEffects(confirmed, 1, 1, 1);
    expect(confirmed.dispute).toMatchObject({
      onChainStatus: "marked",
      transactionHash: HASH,
      metadata: METADATA,
      markedDisputedAt: Date.now(),
      updatedAt: Date.now(),
    });
    for (const event of failed.events) expect(confirmed.events).toContainEqual(event);
    for (const message of failed.messages) expect(confirmed.messages).toContainEqual(message);
    for (const notification of failed.notifications)
      expect(confirmed.notifications).toContainEqual(notification);
    await c.unchanged(() => c.fail());
    await c.unchanged(() => c.fail(HASH));
    await c.unchanged(() => c.succeed());
    await c.unchanged(() => c.fail(OTHER_HASH), /different transaction hash/);
  });

  it.each(["incoming", "stored", "both"] as const)(
    "uses the effective %s hash for first-failure guidance",
    async (source) => {
      const c = await setup(parentType);
      await c.start();
      if (source !== "incoming")
        await c.t.run(async ({ db }) => db.patch(c.disputeId, { transactionHash: HASH }));
      tick();
      await expect(c.fail(source === "stored" ? undefined : ` ${HASH} `)).resolves.toBe(true);
      const failed = await c.read();
      expectEffects(failed, 1, 1, 0);
      expectGuidance(failed, HASH);
      expect(failed.dispute).toMatchObject({
        onChainStatus: "mark_failed",
        updatedAt: Date.now(),
        metadata: { ...METADATA, onChainMarkError: "First failure" },
      });
      expect(failed.events.at(-1)?.metadata).toEqual({ errorMessage: "First failure" });
      await c.unchanged(() => c.fail(HASH, "Replacement error"));
      await c.unchanged(() => c.start(), /requires reconciliation/);
    },
  );
});
