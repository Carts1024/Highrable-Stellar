import {
  Account,
  Address,
  Contract,
  nativeToScVal,
  rpc,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { settings, query, mutation } = vi.hoisted(() => ({
  settings: {
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://rpc.example.test",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_ESCROW_CONTRACT_ID: "",
  },
  query: vi.fn(),
  mutation: vi.fn(),
}));
vi.mock("@/core/config/env", () => ({ env: settings }));
vi.mock("@/core/admin/server-auth", () => ({
  requireAdminRequestContext: () => ({
    adminWallet: StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1)),
    adminApiSecret: "test-only",
  }),
}));
vi.mock("@/core/admin/server-api", () => ({
  createAdminConvexClient: () => ({ query, mutation }),
  createAdminErrorResponse: (error: Error) =>
    NextResponse.json({ error: error.message }, { status: 500 }),
}));
vi.mock("@repo/convex-client/server", () => ({
  api: {
    admin: {
      getSettlementAttemptByOperation: "attempt",
      recordDisputeResolutionStarted: "started",
      recordDisputeResolutionSigned: "signed",
      recordDisputeResolutionFailed: "failed",
      recordDisputeResolutionSubmissionUnknown: "unknown",
      recordDisputeResolutionSucceeded: "succeeded",
    },
  },
}));

import { POST } from "@/app/api/admin/disputes/[disputeId]/resolve/route";

import { readDisputedEscrowStatus, verifyAdminChainOperation } from "./chain-verification";

const actor = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
const client = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 2));
const freelancer = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));
const contract = StrKey.encodeContract(Buffer.alloc(32, 4));

function transaction(escrowId = 42n) {
  return new TransactionBuilder(new Account(actor, "1"), {
    fee: "100",
    networkPassphrase: settings.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    timebounds: { minTime: 0, maxTime: 1000 },
  })
    .addOperation(
      new Contract(contract).call(
        "resolve_dispute",
        new Address(actor).toScVal(),
        nativeToScVal(escrowId, { type: "u64" }),
        nativeToScVal(5000, { type: "u32" }),
        nativeToScVal(Buffer.alloc(32)),
      ),
    )
    .build();
}

function verificationArgs() {
  return {
    transactionHash: transaction().hash().toString("hex"),
    transactionValidUntil: 1000,
    network: "testnet",
    contractId: contract,
    expected: {
      method: "resolve_dispute" as const,
      actorWallet: actor,
      escrowId: "42",
      freelancerShareBps: 5000,
    },
  };
}

function readArgs() {
  return { sourceAddress: actor, escrowId: "42", network: "testnet", contractId: contract };
}

function reply(value: unknown) {
  return { result: { retval: nativeToScVal(value) } } as never;
}

function escrow(status: unknown = ["Released"]) {
  return { escrow_id: 42n, client, freelancer, status };
}

async function recover() {
  return POST(
    new NextRequest("http://localhost/api/admin/disputes/dispute-1/resolve", {
      method: "POST",
      body: JSON.stringify({ phase: "reconcile", operationId: "operation-1" }),
    }),
    { params: Promise.resolve({ disputeId: "dispute-1" }) },
  );
}

beforeEach(() => {
  settings.NEXT_PUBLIC_ESCROW_CONTRACT_ID = contract;
  query.mockReset().mockResolvedValue({
    disputeId: "dispute-1",
    operationId: "operation-1",
    actorWallet: actor,
    transactionHash: verificationArgs().transactionHash,
    transactionValidUntil: 1000,
    onChainEscrowId: "42",
    freelancerShareBps: 5000,
    network: "testnet",
    contractId: contract,
    status: "submission_unknown",
  });
  mutation.mockReset().mockResolvedValue(true);
  vi.spyOn(rpc.Server.prototype, "getAccount").mockResolvedValue(new Account(actor, "1"));
  vi.spyOn(rpc.Server.prototype, "getTransaction").mockResolvedValue({
    status: "SUCCESS",
    envelopeXdr: transaction().toEnvelope(),
  } as never);
  vi.spyOn(rpc.Server.prototype, "simulateTransaction").mockResolvedValue(reply(escrow()));
  vi.spyOn(rpc.Server.prototype, "sendTransaction").mockRejectedValue(
    new Error("Recovery must never resubmit."),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("C19 saved transaction verification", () => {
  it.each(["SUCCESS", "FAILED"])(
    "verifies the saved hash and invocation for %s",
    async (status) => {
      vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue({
        status,
        envelopeXdr: transaction().toEnvelope(),
      } as never);
      expect(await verifyAdminChainOperation(verificationArgs())).toBe(
        status === "SUCCESS" ? "succeeded" : "failed",
      );
    },
  );

  it("accepts the saved inner hash of a sponsored transaction", async () => {
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      actor,
      "100",
      transaction(),
      settings.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    );
    vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue({
      status: "SUCCESS",
      envelopeXdr: feeBump.toEnvelope(),
    } as never);
    expect(await verifyAdminChainOperation(verificationArgs())).toBe("succeeded");
    expect(
      await verifyAdminChainOperation({
        ...verificationArgs(),
        transactionHash: feeBump.hash().toString("hex"),
      }),
    ).toBe("succeeded");
  });

  it("rejects a different envelope even when its invocation would otherwise match", async () => {
    await expect(
      verifyAdminChainOperation({ ...verificationArgs(), transactionHash: "a".repeat(64) }),
    ).rejects.toThrow("saved hash");
  });

  it("rejects a matching transaction hash with different settlement terms", async () => {
    vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue({
      status: "SUCCESS",
      envelopeXdr: transaction(43n).toEnvelope(),
    } as never);
    await expect(
      verifyAdminChainOperation({
        ...verificationArgs(),
        transactionHash: transaction(43n).hash().toString("hex"),
      }),
    ).rejects.toThrow("escrow or split");
  });

  it.each([undefined, "UNKNOWN", "PENDING"])("rejects unknown RPC status %s", async (status) => {
    vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue({
      status,
      envelopeXdr: transaction().toEnvelope(),
    } as never);
    await expect(verifyAdminChainOperation(verificationArgs())).rejects.toThrow(
      "unrecognized transaction status",
    );
  });

  it.each([undefined, NaN, -1, 1.5, "1006"])(
    "does not infer expiry from unreadable ledger time %s",
    async (latestLedgerCloseTime) => {
      vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue({
        status: "NOT_FOUND",
        latestLedgerCloseTime,
      } as never);
      await expect(verifyAdminChainOperation(verificationArgs())).rejects.toThrow(
        "ledger close time",
      );
    },
  );

  it.each([
    [1005, "pending"],
    [1006, "expired"],
  ])("uses ledger time %s for expiry", async (latestLedgerCloseTime, expected) => {
    vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue({
      status: "NOT_FOUND",
      latestLedgerCloseTime,
    } as never);
    expect(await verifyAdminChainOperation(verificationArgs())).toBe(expected);
  });

  it.each([
    null,
    {},
    { ...escrow(), escrow_id: 43n },
    { ...escrow(), status: ["Released", "Disputed"] },
    { ...escrow(), status: { Released: "invalid" } },
    { ...escrow(), client: "invalid" },
    { escrow_id: 42n, client, status: ["Released"] },
  ])("rejects unreadable or mismatched escrow data %#", async (value) => {
    vi.mocked(rpc.Server.prototype.simulateTransaction).mockResolvedValue(reply(value));
    await expect(readDisputedEscrowStatus(readArgs())).rejects.toThrow();
  });
});

describe("C19 recovery route with real chain verification and mocked RPC", () => {
  it("keeps an unknown attempt recoverable after an unreadable read, then verifies success", async () => {
    vi.mocked(rpc.Server.prototype.simulateTransaction).mockResolvedValueOnce(
      reply({ ...escrow(), escrow_id: 43n }),
    );
    expect((await recover()).status).toBe(500);
    expect(mutation).not.toHaveBeenCalled();
    expect((await recover()).status).toBe(200);
    expect(mutation).toHaveBeenCalledWith(
      "succeeded",
      expect.objectContaining({
        operationId: "operation-1",
        transactionHash: verificationArgs().transactionHash,
      }),
    );
    expect(rpc.Server.prototype.getTransaction).toHaveBeenCalledWith(
      verificationArgs().transactionHash,
    );
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it.each(["FAILED", "expired"])(
    "records %s only while the escrow remains disputed",
    async (status) => {
      vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue(
        status === "expired"
          ? ({ status: "NOT_FOUND", latestLedgerCloseTime: 1006 } as never)
          : ({ status: "FAILED", envelopeXdr: transaction().toEnvelope() } as never),
      );
      expect((await recover()).status).toBe(409);
      expect(mutation).not.toHaveBeenCalled();
      vi.mocked(rpc.Server.prototype.simulateTransaction).mockResolvedValue(
        reply(escrow(["Disputed"])),
      );
      expect((await recover()).status).toBe(200);
      expect(mutation).toHaveBeenCalledWith(
        "failed",
        expect.objectContaining({
          operationId: "operation-1",
          transactionHash: verificationArgs().transactionHash,
        }),
      );
      expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
    },
  );

  it("preserves pending state and does not read or finalize an unconfirmed escrow", async () => {
    vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValue({
      status: "NOT_FOUND",
      latestLedgerCloseTime: 1005,
    } as never);
    expect((await recover()).status).toBe(202);
    expect(mutation).toHaveBeenCalledWith(
      "unknown",
      expect.objectContaining({ operationId: "operation-1" }),
    );
    expect(rpc.Server.prototype.simulateTransaction).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects a different deployment before querying RPC or updating the attempt", async () => {
    settings.NEXT_PUBLIC_ESCROW_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 9));
    expect((await recover()).status).toBe(500);
    expect(rpc.Server.prototype.getTransaction).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
});
