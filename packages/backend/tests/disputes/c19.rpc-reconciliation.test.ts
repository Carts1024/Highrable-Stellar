import { Account, Address, nativeToScVal, rpc, StrKey } from "@stellar/stellar-sdk";
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../convex/_generated/api";
import {
  getCompletionFromContract,
  getEscrowFromContract,
  normalizeOnChainAddress,
  normalizeOnChainBytes32,
  normalizeOnChainEscrowStatus,
} from "../../convex/lib/stellarReads";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import { seedDisputeFixture } from "../fixtures/disputes";

const client = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
const freelancer = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
const contract = StrKey.encodeContract(Buffer.alloc(32, 3));
const config = {
  rpcUrl: "https://rpc.example.test",
  networkPassphrase: "Test SDF Network ; September 2015",
  escrowContractId: contract,
  reputationContractId: contract,
  readSourceAccount: client,
};

function escrow() {
  return {
    escrow_id: 42n,
    client,
    freelancer,
    asset: contract,
    amount: 500n,
    job_hash: new Uint8Array(32),
    status: ["Disputed"],
    created_at: 1n,
    funded_at: 2n,
    submitted_at: 0n,
    released_at: 0n,
  };
}

function rpcResult(value: unknown) {
  return { result: { retval: nativeToScVal(value) } } as never;
}

beforeEach(() => {
  vi.spyOn(rpc.Server.prototype, "getAccount").mockResolvedValue(new Account(client, "1"));
  vi.spyOn(rpc.Server.prototype, "sendTransaction").mockRejectedValue(
    new Error("Reads must not submit."),
  );
  vi.stubEnv("STELLAR_NETWORK", "testnet");
  vi.stubEnv("STELLAR_RPC_URL", config.rpcUrl);
  vi.stubEnv("ESCROW_CONTRACT_ID", contract);
  vi.stubEnv("REPUTATION_CONTRACT_ID", contract);
  vi.stubEnv("STELLAR_READ_SOURCE_ACCOUNT", client);
});

describe("Deliverable 2 C19 RPC normalization", () => {
  it.each(["Disputed", ["Disputed"], { Disputed: null }, { Disputed: [] }].map((value) => [value]))(
    "accepts the supported unit enum representation %j",
    (value) => {
      expect(normalizeOnChainEscrowStatus(value)).toBe("disputed");
    },
  );

  it.each(
    [
      null,
      "Unknown",
      "toString",
      "constructor",
      [],
      [["Disputed"]],
      ["Disputed", "Released"],
      { Disputed: "Released" },
    ].map((value) => [value]),
  )("rejects an unreadable status %j", (value) => {
    expect(normalizeOnChainEscrowStatus(value)).toBeNull();
  });

  it("validates Stellar address checksums and fixed-size hashes", () => {
    expect(normalizeOnChainAddress(new Address(client))).toBe(client);
    expect(normalizeOnChainAddress(` ${client.toLowerCase()} `)).toBe(client);
    expect(() => normalizeOnChainAddress("GNOTANADDRESS")).toThrow();
    expect(normalizeOnChainBytes32(new Uint8Array(32))).toBe("00".repeat(32));
    expect(normalizeOnChainBytes32(new Uint8Array(31))).toBeUndefined();
    expect(normalizeOnChainBytes32(new Uint8Array(33))).toBeUndefined();
  });

  it("decodes a matching escrow and never submits a transaction", async () => {
    vi.spyOn(rpc.Server.prototype, "simulateTransaction").mockResolvedValue(rpcResult(escrow()));
    expect(await getEscrowFromContract(config, "42")).toMatchObject(escrow());
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it.each(
    [
      null,
      [],
      {},
      { ...escrow(), escrow_id: 43n },
      { ...escrow(), escrow_id: -1n },
      { ...escrow(), escrow_id: Number.MAX_SAFE_INTEGER + 1 },
      { ...escrow(), status: "constructor" },
      { ...escrow(), client: "invalid" },
      { ...escrow(), amount: -1n },
      { ...escrow(), created_at: "1.5" },
      { ...escrow(), job_hash: new Uint8Array(31) },
    ].map((value) => [value]),
  )("rejects malformed or mismatched escrow records %#", async (value) => {
    vi.spyOn(rpc.Server.prototype, "simulateTransaction").mockResolvedValue(rpcResult(value));
    await expect(getEscrowFromContract(config, "42")).rejects.toThrow();
  });

  it.each([{ error: "RPC unavailable" }, {}, { result: {} }])(
    "rejects missing simulation results %#",
    async (value) => {
      vi.spyOn(rpc.Server.prototype, "simulateTransaction").mockResolvedValue(value as never);
      await expect(getEscrowFromContract(config, "42")).rejects.toThrow();
    },
  );

  it("distinguishes absent completion from malformed completion", async () => {
    const simulate = vi.spyOn(rpc.Server.prototype, "simulateTransaction");
    simulate.mockResolvedValueOnce(rpcResult(null));
    expect(await getCompletionFromContract(config, "42")).toBeNull();
    const completion = {
      ...escrow(),
      rating: 5,
      review_hash: new Uint8Array(32),
      completed_at: 3n,
    };
    simulate.mockResolvedValueOnce(rpcResult(completion));
    expect(await getCompletionFromContract(config, "42")).toMatchObject({
      rating: 5,
      escrow_id: 42n,
    });
    for (const invalid of [
      {},
      { ...completion, escrow_id: 43n },
      { ...completion, rating: 6 },
      { ...completion, rating: 0 },
      { ...completion, rating: "1.5" },
      { ...completion, review_hash: new Uint8Array(1) },
    ]) {
      simulate.mockResolvedValueOnce(rpcResult(invalid));
      await expect(getCompletionFromContract(config, "42")).rejects.toThrow();
    }
  });
});

describe("Deliverable 2 C19 sync recovery", () => {
  it.each(["micro_gig", "milestone"] as const)(
    "preserves %s state on an unreadable read and recovers on a matching read",
    async (parentType) => {
      const t = convexTest(schema, modules);
      const fixture = await seedDisputeFixture(t, { parentType });
      await t.run(({ db }) => db.patch(fixture.escrowId, { escrowId: "42" }));
      const before = await t.run(({ db }) => db.get(fixture.jobId));
      const milestoneBefore = fixture.milestoneId
        ? await t.run(({ db }) => db.get(fixture.milestoneId!))
        : null;
      const simulate = vi.spyOn(rpc.Server.prototype, "simulateTransaction");
      simulate.mockResolvedValueOnce(rpcResult({ ...escrow(), escrow_id: 43n }));
      expect(await t.action(api.sync.syncEscrowStatus, { escrowId: "42" })).toMatchObject({
        ok: false,
        reason: "onchain_read_failed",
      });
      const failed = await t.run(({ db }) => db.get(fixture.escrowId));
      expect(failed).toMatchObject({ status: "funded", lastSyncOutcome: "failed" });
      expect(await t.run(({ db }) => db.get(fixture.jobId))).toEqual(before);
      if (fixture.milestoneId) {
        expect(await t.run(({ db }) => db.get(fixture.milestoneId!))).toEqual(milestoneBefore);
      }

      simulate.mockResolvedValueOnce(rpcResult(escrow()));
      expect(await t.action(api.sync.syncEscrowStatus, { escrowId: "42" })).toMatchObject({
        ok: true,
        changed: true,
        newStatus: "disputed",
      });
      expect(await t.run(({ db }) => db.get(fixture.escrowId))).toMatchObject({
        status: "disputed",
        lastSyncOutcome: "success",
      });
      expect(
        (await t.run(({ db }) => db.get(fixture.escrowId)))?.lastSyncErrorMessage,
      ).toBeUndefined();
      simulate.mockResolvedValueOnce(rpcResult({ ...escrow(), status: ["Released"] }));
      expect(await t.action(api.sync.syncEscrowStatus, { escrowId: "42" })).toMatchObject({
        ok: false,
        reason: "unsafe_status_downgrade",
      });
      expect((await t.run(({ db }) => db.get(fixture.escrowId)))?.status).toBe("disputed");
      expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
    },
  );
});
