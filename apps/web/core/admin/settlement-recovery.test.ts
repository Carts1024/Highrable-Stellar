import {
  Account,
  Address,
  Contract,
  Horizon,
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
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon.example.test",
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
      getAdminSettlementPreflight: "settlement-preflight",
      getSettlementAttemptByOperation: "attempt",
      recordDisputeResolutionStarted: "started",
      recordDisputeResolutionReconciliationStarted: "reconciliation-started",
      recordDisputeResolutionSigned: "signed",
      recordDisputeResolutionFailed: "failed",
      recordDisputeResolutionSubmissionUnknown: "unknown",
      recordDisputeResolutionSucceeded: "succeeded",
    },
  },
}));

import { POST } from "@/app/api/admin/disputes/[disputeId]/resolve/route";

import {
  readDisputedEscrowStatus,
  verifyAdminChainOperation,
  verifySuccessfulAdminResolutionTransaction,
} from "./chain-verification";

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

function settlementPreflight() {
  return {
    network: "testnet",
    contractId: contract,
    onChainEscrowId: "42",
    escrowStatus: "disputed",
    clientWallet: client,
    freelancerWallet: freelancer,
  };
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

async function startSettlement() {
  return POST(
    new NextRequest("http://localhost/api/admin/disputes/dispute-1/resolve", {
      method: "POST",
      body: JSON.stringify({
        phase: "started",
        status: "split_resolution",
        freelancerShareBps: 5000,
        operationId: "operation-1",
      }),
    }),
    { params: Promise.resolve({ disputeId: "dispute-1" }) },
  );
}

async function reconcileExternalSettlement() {
  return POST(
    new NextRequest("http://localhost/api/admin/disputes/dispute-1/resolve", {
      method: "POST",
      body: JSON.stringify({ phase: "reconcile_external" }),
    }),
    { params: Promise.resolve({ disputeId: "dispute-1" }) },
  );
}

function mockHorizonHistory(
  records: readonly Record<string, unknown>[],
  disputeMarkLedger?: number,
) {
  const page = {
    records,
    next: vi.fn().mockResolvedValue({ records: [], next: vi.fn() }),
  };
  const disputeMark = { call: vi.fn().mockResolvedValue({ ledger_attr: disputeMarkLedger }) };
  const builder = {
    forAccount: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    call: vi.fn().mockResolvedValue(page),
    transaction: vi.fn().mockReturnValue(disputeMark),
  };
  vi.spyOn(Horizon.Server.prototype, "transactions").mockReturnValue(builder as never);
  return builder;
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

  it("reads resolution terms and expiry from a confirmed transaction", async () => {
    await expect(
      verifySuccessfulAdminResolutionTransaction({
        transactionHash: verificationArgs().transactionHash,
        network: "testnet",
        contractId: contract,
        actorWallet: actor,
        escrowId: "42",
      }),
    ).resolves.toEqual({ freelancerShareBps: 5_000, transactionValidUntil: 1_000 });
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
  it("discovers, verifies, and records a prior resolution without a supplied hash", async () => {
    const tx = transaction();
    const transactionHash = tx.hash().toString("hex");
    const history = mockHorizonHistory(
      [
        {
          successful: true,
          hash: transaction(43n).hash().toString("hex"),
          envelope_xdr: transaction(43n).toEnvelope().toXDR("base64"),
          ledger_attr: 100,
        },
        {
          successful: true,
          hash: transactionHash,
          envelope_xdr: tx.toEnvelope().toXDR("base64"),
          ledger_attr: 101,
        },
      ],
      99,
    );
    query.mockResolvedValueOnce({ ...settlementPreflight(), disputeTxHash: "d".repeat(64) });
    mutation
      .mockReset()
      .mockResolvedValueOnce({ operationId: "reconcile_dispute:dispute-1:hash", transactionHash })
      .mockResolvedValueOnce({
        status: "resolved_freelancer",
        freelancerShareBps: 5_000,
        freelancerPayoutAmount: 50,
        clientRefundAmount: 50,
        resolutionTxHash: transactionHash,
        resolutionStellarExpertUrl: "https://stellar.expert/testnet/tx/hash",
      });

    const response = await reconcileExternalSettlement();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "succeeded",
      operationId: "reconcile_dispute:dispute-1:hash",
      transactionValidUntil: 1_000,
      result: { resolutionTxHash: transactionHash },
    });
    expect(mutation).toHaveBeenNthCalledWith(
      1,
      "reconciliation-started",
      expect.objectContaining({
        disputeId: "dispute-1",
        transactionHash,
        transactionValidUntil: 1_000,
        freelancerShareBps: 5_000,
      }),
    );
    expect(mutation).toHaveBeenNthCalledWith(
      2,
      "succeeded",
      expect.objectContaining({
        operationId: "reconcile_dispute:dispute-1:hash",
        transactionHash,
        transactionValidUntil: 1_000,
      }),
    );
    expect(history.forAccount).toHaveBeenCalledWith(actor);
    expect(history.transaction).toHaveBeenCalledWith("d".repeat(64));
    expect(history.order).toHaveBeenCalledWith("desc");
    expect(history.limit).toHaveBeenCalledWith(200);
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("does not write bookkeeping when automatic history discovery finds no matching call", async () => {
    query.mockResolvedValueOnce(settlementPreflight());
    mockHorizonHistory([]);

    const response = await reconcileExternalSettlement();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      details: { code: "resolution_transaction_not_found" },
    });
    expect(mutation).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("does not trust a successful Horizon history row when Soroban RPC reports failure", async () => {
    const tx = transaction();
    mockHorizonHistory([
      {
        successful: true,
        hash: tx.hash().toString("hex"),
        envelope_xdr: tx.toEnvelope().toXDR("base64"),
      },
    ]);
    query.mockResolvedValueOnce(settlementPreflight());
    vi.mocked(rpc.Server.prototype.getTransaction).mockResolvedValueOnce({
      status: "FAILED",
      envelopeXdr: tx.toEnvelope(),
    } as never);

    const response = await reconcileExternalSettlement();

    expect(response.status).toBe(500);
    expect(mutation).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("does not record reconciliation when the current chain state disagrees with its resolution", async () => {
    const tx = transaction();
    mockHorizonHistory([
      {
        successful: true,
        hash: tx.hash().toString("hex"),
        envelope_xdr: tx.toEnvelope().toXDR("base64"),
      },
    ]);
    query.mockResolvedValueOnce(settlementPreflight());
    vi.mocked(rpc.Server.prototype.simulateTransaction).mockResolvedValueOnce(
      reply(escrow(["Disputed"])),
    );

    const response = await reconcileExternalSettlement();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      details: { code: "settlement_reconciliation_failed", onChainStatus: "Disputed" },
    });
    expect(mutation).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it.each(["Funded", "Released"] as const)(
    "does not create a settlement attempt while the on-chain escrow is %s",
    async (status) => {
      query.mockResolvedValueOnce(settlementPreflight());
      vi.mocked(rpc.Server.prototype.simulateTransaction).mockResolvedValueOnce(
        reply(escrow([status])),
      );

      const response = await startSettlement();

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: `Settlement requires on-chain escrow 42 to be Disputed; Stellar reports ${status}. Reconcile the dispute state before retrying.`,
        details: { code: "settlement_preflight_failed", onChainStatus: status },
      });
      expect(query).toHaveBeenCalledWith(
        "settlement-preflight",
        expect.objectContaining({ disputeId: "dispute-1", adminWallet: actor }),
      );
      expect(mutation).not.toHaveBeenCalled();
      expect(rpc.Server.prototype.getTransaction).not.toHaveBeenCalled();
      expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
    },
  );

  it("starts settlement only after the scoped on-chain escrow and participants are verified", async () => {
    query.mockResolvedValueOnce(settlementPreflight());
    vi.mocked(rpc.Server.prototype.simulateTransaction).mockResolvedValueOnce(
      reply(escrow(["Disputed"])),
    );

    const response = await startSettlement();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, phase: "started" });
    expect(mutation).toHaveBeenCalledWith(
      "started",
      expect.objectContaining({ disputeId: "dispute-1", operationId: "operation-1" }),
    );
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects an escrow-ID collision whose on-chain participants differ from the saved dispute", async () => {
    query.mockResolvedValueOnce(settlementPreflight());
    vi.mocked(rpc.Server.prototype.simulateTransaction).mockResolvedValueOnce(
      reply({ ...escrow(["Disputed"]), client: freelancer, freelancer: client }),
    );

    const response = await startSettlement();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "On-chain escrow participants do not match the saved dispute.",
      details: { code: "settlement_preflight_failed" },
    });
    expect(mutation).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("passes through the complete verified settlement result", async () => {
    const result = {
      status: "split_resolution",
      freelancerShareBps: 5_000,
      freelancerPayoutAmount: 250,
      clientRefundAmount: 250,
      resolutionTxHash: verificationArgs().transactionHash,
      resolutionStellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${verificationArgs().transactionHash}`,
    };
    mutation.mockResolvedValueOnce(result);

    const response = await recover();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "succeeded", result });
    expect(mutation).toHaveBeenCalledWith(
      "succeeded",
      expect.objectContaining({
        operationId: "operation-1",
        transactionHash: verificationArgs().transactionHash,
      }),
    );
  });

  it("closes an unsigned attempt as not submitted without reading Stellar", async () => {
    query.mockResolvedValueOnce({
      disputeId: "dispute-1",
      operationId: "operation-1",
      actorWallet: actor,
      transactionHash: undefined,
      transactionValidUntil: undefined,
      onChainEscrowId: "42",
      freelancerShareBps: 5000,
      network: "testnet",
      contractId: contract,
      status: "started",
    });

    const response = await recover();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "failed",
      result: true,
      failureKind: "not_submitted",
    });
    expect(mutation).toHaveBeenCalledWith(
      "failed",
      expect.objectContaining({
        operationId: "operation-1",
        errorMessage: "No signed transaction was persisted, so no settlement was submitted.",
      }),
    );
    expect(rpc.Server.prototype.getTransaction).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.simulateTransaction).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects an attempt saved for a different case before verification or finalization", async () => {
    query.mockResolvedValueOnce({
      disputeId: "other-dispute",
      operationId: "operation-1",
      transactionHash: verificationArgs().transactionHash,
      transactionValidUntil: 1000,
      status: "submission_unknown",
    });

    const response = await recover();

    expect(response.status).toBe(404);
    expect(mutation).not.toHaveBeenCalled();
    expect(rpc.Server.prototype.getTransaction).not.toHaveBeenCalled();
  });

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
      expect(mutation.mock.calls.some(([name]) => name === "succeeded")).toBe(false);
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
    expect(mutation.mock.calls.some(([name]) => name === "succeeded")).toBe(false);
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
