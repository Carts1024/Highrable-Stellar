import { Keypair, scValToNative, type xdr } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  execute: vi.fn(),
  simulate: vi.fn(),
  getSmartAccountKit: vi.fn(),
}));

vi.mock("./transaction", () => ({ simulateContractCall: runtime.simulate }));
vi.mock("./transactionExecutor", () => ({ executeHighrableContractCall: runtime.execute }));
vi.mock("./smart-account-kit", () => ({ getSmartAccountKit: runtime.getSmartAccountKit }));
vi.mock("./stablecoin-config", () => ({ stablecoinConfig: { decimals: 6 } }));

import { createAndFundOpenEscrowOnChain, createOpenEscrowOnChain } from "./escrow-contract";

const client = Keypair.random().publicKey();
const asset = Keypair.random().publicKey();
const sourceAddress = Keypair.random().publicKey();
const contractId = Keypair.random().publicKey();
const jobHash = new Uint8Array(32).fill(7);
const txHash = "a".repeat(64);

function callParams() {
  return {
    rpcUrl: "https://rpc.example.test",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: contractId,
    sourceAddress,
    signTransaction: vi.fn(async () => "signed-xdr"),
    operationId: "create_escrow:job:operation",
    onPhase: vi.fn(),
    onRecovery: vi.fn(),
    onSigned: vi.fn(async () => undefined),
    client,
    asset,
    amount: 25,
    assetDecimals: 6,
    jobHash,
  };
}

function matchingEscrow(id: bigint) {
  return {
    escrow_id: id,
    client,
    freelancer: null,
    asset,
    amount: 25_000_000n,
    job_hash: jobHash,
    status: "Funded",
    created_at: 1n,
    funded_at: 2n,
    submitted_at: 0n,
    released_at: 0n,
  };
}

beforeEach(() => {
  runtime.simulate.mockResolvedValue(4n);
  runtime.execute.mockResolvedValue({ txHash, result: 12n });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createAndFundOpenEscrowOnChain", () => {
  it("uses one atomic contract call and returns the direct escrow ID", async () => {
    const params = callParams();

    await expect(createAndFundOpenEscrowOnChain(params)).resolves.toEqual({
      txHash,
      result: 12n,
      escrowId: "12",
    });

    expect(runtime.execute).toHaveBeenCalledTimes(1);
    expect(runtime.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "create_and_fund_open_escrow",
        operationId: params.operationId,
        onPhase: params.onPhase,
        onSigned: params.onSigned,
      }),
    );
    expect(runtime.simulate).toHaveBeenCalledTimes(1);
    expect(params.onRecovery).not.toHaveBeenCalled();
  });

  it("recovers missing IDs in ordered batches of four with bounded concurrency", async () => {
    const params = callParams();
    let nextIdRead = 0;
    let activeReads = 0;
    let maxActiveReads = 0;
    const readIds: bigint[] = [];

    runtime.simulate.mockImplementation(
      async ({ method, args }: { method: string; args: readonly xdr.ScVal[] }) => {
        if (method === "get_next_escrow_id") {
          nextIdRead += 1;
          return nextIdRead === 1 ? 4n : 8n;
        }

        const escrowId = scValToNative(args[0] as xdr.ScVal) as bigint;
        readIds.push(escrowId);
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, escrowId === 4n ? 20 : 2));
        activeReads -= 1;

        if (escrowId === 4n || escrowId === 5n) {
          return matchingEscrow(escrowId);
        }
        return { ...matchingEscrow(escrowId), client: Keypair.random().publicKey() };
      },
    );
    runtime.execute.mockResolvedValue({ txHash, result: undefined });

    await expect(createAndFundOpenEscrowOnChain(params)).resolves.toMatchObject({
      txHash,
      escrowId: "4",
    });

    expect(params.onRecovery).toHaveBeenCalledOnce();
    expect(readIds).toEqual([4n, 5n, 6n, 7n]);
    expect(maxActiveReads).toBe(4);
    expect(runtime.execute).toHaveBeenCalledOnce();
  });

  it("keeps RPC count while reducing deterministic delayed recovery time vs sequential reads", async () => {
    vi.useFakeTimers();
    try {
      const params = callParams();
      let nextIdRead = 0;
      let candidateReadCount = 0;
      let activeReads = 0;
      let maxActiveReads = 0;
      runtime.simulate.mockImplementation(
        async ({ method, args }: { method: string; args: readonly xdr.ScVal[] }) => {
          if (method === "get_next_escrow_id") {
            nextIdRead += 1;
            return nextIdRead === 1 ? 4n : 20n;
          }

          candidateReadCount += 1;
          const escrowId = scValToNative(args[0] as xdr.ScVal) as bigint;
          activeReads += 1;
          maxActiveReads = Math.max(maxActiveReads, activeReads);
          await new Promise((resolve) => setTimeout(resolve, 10));
          activeReads -= 1;

          return escrowId === 19n
            ? matchingEscrow(escrowId)
            : { ...matchingEscrow(escrowId), client: Keypair.random().publicKey() };
        },
      );
      runtime.execute.mockResolvedValue({ txHash, result: undefined });

      const batchedStartedAt = Date.now();
      let batchedComplete = false;
      const batchedRecovery = createAndFundOpenEscrowOnChain(params).then((result) => {
        batchedComplete = true;
        return result;
      });
      await vi.advanceTimersByTimeAsync(39);
      expect(batchedComplete).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(batchedRecovery).resolves.toMatchObject({ escrowId: "19" });
      const batchedElapsedMs = Date.now() - batchedStartedAt;
      const batchedRpcCalls = runtime.simulate.mock.calls.length;

      const sequentialStartedAt = Date.now();
      let sequentialComplete = false;
      let sequentialCandidateReads = 0;
      const sequentialRecovery = (async () => {
        for (let escrowId = 4; escrowId < 20; escrowId += 1) {
          sequentialCandidateReads += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      })().then(() => {
        sequentialComplete = true;
      });
      await vi.advanceTimersByTimeAsync(159);
      expect(sequentialComplete).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await sequentialRecovery;
      const sequentialElapsedMs = Date.now() - sequentialStartedAt;
      const sequentialRpcCalls = 2 + sequentialCandidateReads;

      expect(candidateReadCount).toBe(16);
      expect(batchedRpcCalls).toBe(sequentialRpcCalls);
      expect(batchedRpcCalls).toBe(18);
      expect(maxActiveReads).toBe(4);
      expect(batchedElapsedMs).toBe(40);
      expect(sequentialElapsedMs).toBe(160);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores failed reads and reports when no matching escrow exists", async () => {
    const params = callParams();
    let nextIdRead = 0;
    runtime.simulate.mockImplementation(
      async ({ method }: { method: string; args: readonly xdr.ScVal[] }) => {
        if (method === "get_next_escrow_id") {
          nextIdRead += 1;
          return nextIdRead === 1 ? 2n : 3n;
        }
        throw new Error("RPC read failed");
      },
    );
    runtime.execute.mockResolvedValue({ txHash, result: undefined });

    await expect(createAndFundOpenEscrowOnChain(params)).rejects.toMatchObject({
      name: "EscrowIdRecoveryError",
      txHash,
      chainConfirmed: true,
      message: expect.stringContaining("created escrow ID could not be recovered"),
    });
    expect(params.onRecovery).toHaveBeenCalledOnce();
    expect(runtime.execute).toHaveBeenCalledOnce();
  });

  it("checks all recovery fields and returns the lowest matching ID across batches", async () => {
    const params = callParams();
    let nextIdRead = 0;
    runtime.simulate.mockImplementation(
      async ({ method, args }: { method: string; args: readonly xdr.ScVal[] }) => {
        if (method === "get_next_escrow_id") {
          nextIdRead += 1;
          return nextIdRead === 1 ? 2n : 10n;
        }

        const escrowId = scValToNative(args[0] as xdr.ScVal) as bigint;
        const escrow = matchingEscrow(escrowId);
        switch (escrowId) {
          case 2n:
            return { ...escrow, freelancer: Keypair.random().publicKey() };
          case 3n:
            return { ...escrow, asset: Keypair.random().publicKey() };
          case 4n:
            return { ...escrow, amount: escrow.amount + 1n };
          case 5n:
            return { ...escrow, job_hash: new Uint8Array(32).fill(9) };
          case 6n:
          case 7n:
            return escrow;
          default:
            return { ...escrow, client: Keypair.random().publicKey() };
        }
      },
    );
    runtime.execute.mockResolvedValue({ txHash, result: undefined });

    await expect(createAndFundOpenEscrowOnChain(params)).resolves.toMatchObject({ escrowId: "6" });
    expect(runtime.simulate).toHaveBeenCalledTimes(10);
  });

  it("preserves an uncertain submitted hash and never retries the atomic call", async () => {
    const params = callParams();
    const pendingError = Object.assign(new Error("confirmation timed out"), { txHash });
    runtime.execute.mockRejectedValue(pendingError);

    await expect(createAndFundOpenEscrowOnChain(params)).rejects.toBe(pendingError);
    expect(runtime.execute).toHaveBeenCalledOnce();
    expect(runtime.simulate).toHaveBeenCalledOnce();
  });

  it("does not retry escrow ID recovery after a confirmed standalone create", async () => {
    const params = callParams();
    let nextIdRead = 0;
    runtime.simulate.mockImplementation(async ({ method }: { method: string }) => {
      if (method === "get_next_escrow_id") {
        nextIdRead += 1;
        return nextIdRead === 1 ? 4n : 5n;
      }

      throw new Error("escrow state read failed");
    });
    runtime.execute.mockResolvedValue({ txHash, result: undefined });

    await expect(createOpenEscrowOnChain(params)).rejects.toMatchObject({
      name: "EscrowIdRecoveryError",
      txHash,
      chainConfirmed: true,
    });

    expect(runtime.execute).toHaveBeenCalledOnce();
    expect(runtime.simulate).toHaveBeenCalledTimes(3);
    expect(params.onRecovery).toHaveBeenCalledOnce();
  });
});
