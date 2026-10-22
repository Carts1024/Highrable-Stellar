import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  createAndFundOpenEscrowOnChain: vi.fn(),
}));

vi.mock("@/core/stellar/escrow-contract", () => {
  class EscrowIdRecoveryError extends Error {
    public constructor(
      message: string,
      public readonly txHash: string,
      public readonly chainConfirmed: boolean,
    ) {
      super(message);
    }
  }

  return {
    createAndFundOpenEscrowOnChain: runtime.createAndFundOpenEscrowOnChain,
    EscrowIdRecoveryError,
  };
});

import { EscrowIdRecoveryError } from "@/core/stellar/escrow-contract";
import { StellarTransactionPendingError } from "@/core/stellar/transaction";

import { runAtomicOpenEscrowPosting } from "./atomic-escrow-posting";

const txHash = "b".repeat(64);
const jobId = "jobs:atomic-post" as never;

function dependencies() {
  return {
    config: {
      rpcUrl: "https://rpc.example.test",
      networkPassphrase: "Test SDF Network ; September 2015",
      escrowContractId: "C" + "A".repeat(55),
    },
    walletAddress: "G" + "B".repeat(55),
    jobId,
    clientRequestId: "create_escrow:jobs:atomic-post:request",
    amount: 25,
    asset: "C" + "D".repeat(55),
    assetDecimals: 6,
    jobHash: new Uint8Array(32).fill(3),
    signTransaction: vi.fn(async () => "signed-xdr"),
    createTransaction: vi.fn(async () => "transaction-row-id"),
    updateTransactionStatus: vi.fn(async () => "transaction-row-id"),
    createEscrowRecord: vi.fn(async () => "escrow-row-id"),
    onProgress: vi.fn(),
  };
}

beforeEach(() => {
  runtime.createAndFundOpenEscrowOnChain.mockImplementation(async (params) => {
    await params.onSigned?.({
      operationId: params.operationId,
      transactionHash: txHash,
      transactionValidUntil: 1_900_000_000,
    });
    params.onPhase?.("simulation");
    params.onPhase?.("signing");
    params.onPhase?.("submission");
    params.onPhase?.("confirmation");
    return { txHash, escrowId: "42" };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runAtomicOpenEscrowPosting", () => {
  it("records one transaction row and a funded escrow with the same operation hash", async () => {
    const params = dependencies();

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toEqual({
      kind: "success",
      escrowId: "42",
      txHash,
    });

    expect(params.createTransaction).toHaveBeenCalledOnce();
    expect(params.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "create_escrow", clientRequestId: params.clientRequestId }),
    );
    expect(runtime.createAndFundOpenEscrowOnChain).toHaveBeenCalledOnce();
    expect(params.createEscrowRecord).toHaveBeenCalledOnce();
    expect(params.createEscrowRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "funded",
        createTxHash: txHash,
        fundTxHash: txHash,
      }),
    );
    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clientRequestId: params.clientRequestId,
        txHash,
        transactionHash: txHash,
        status: "success",
      }),
    );
    expect(params.onProgress).toHaveBeenCalledWith("recording");
  });

  it("keeps rejected atomic creation failed and creates no escrow record", async () => {
    const params = dependencies();
    runtime.createAndFundOpenEscrowOnChain.mockRejectedValue(new Error("transaction rejected"));

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toMatchObject({ kind: "failed" });

    expect(params.createTransaction).toHaveBeenCalledOnce();
    expect(runtime.createAndFundOpenEscrowOnChain).toHaveBeenCalledOnce();
    expect(params.createEscrowRecord).not.toHaveBeenCalled();
    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("preserves a pending hash and does not create or resubmit an escrow", async () => {
    const params = dependencies();
    runtime.createAndFundOpenEscrowOnChain.mockRejectedValue(
      new StellarTransactionPendingError("confirmation timed out", txHash),
    );

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toEqual({
      kind: "pending",
      message:
        "Stellar RPC timed out while confirming the transaction. Check the explorer before retrying.",
      txHash,
    });

    expect(runtime.createAndFundOpenEscrowOnChain).toHaveBeenCalledOnce();
    expect(params.createEscrowRecord).not.toHaveBeenCalled();
    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        txHash,
        transactionHash: txHash,
        status: "pending",
      }),
    );
  });

  it("keeps an uncertain recovery hash pending", async () => {
    const params = dependencies();
    runtime.createAndFundOpenEscrowOnChain.mockRejectedValue(
      new EscrowIdRecoveryError("escrow state read failed", txHash, false),
    );

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toMatchObject({
      kind: "pending",
      txHash,
      message: expect.stringContaining("The transaction remains pending"),
    });

    expect(params.createEscrowRecord).not.toHaveBeenCalled();
    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ txHash, transactionHash: txHash, status: "pending" }),
    );
  });

  it("keeps confirmed chain success distinct when local escrow recording fails", async () => {
    const params = dependencies();
    params.createEscrowRecord.mockRejectedValue(new Error("Convex unavailable"));

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toMatchObject({
      kind: "bookkeeping_failed",
      escrowId: "42",
      txHash,
      escrowRecordSaved: false,
    });

    expect(runtime.createAndFundOpenEscrowOnChain).toHaveBeenCalledOnce();
    expect(params.createEscrowRecord).toHaveBeenCalledOnce();
    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        txHash,
        transactionHash: txHash,
        status: "success",
        errorMessage: expect.stringContaining("Stellar confirmed the atomic escrow"),
      }),
    );
  });

  it("does not report success when the escrow mutation returns no record ID", async () => {
    const params = dependencies();
    params.createEscrowRecord.mockResolvedValueOnce(undefined as unknown as string);

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toMatchObject({
      kind: "bookkeeping_failed",
      escrowId: "42",
      txHash,
      escrowRecordSaved: false,
    });

    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "success", txHash, errorMessage: expect.any(String) }),
    );
  });

  it("keeps a saved funded escrow when the transaction history update fails afterward", async () => {
    const params = dependencies();
    params.updateTransactionStatus
      .mockResolvedValueOnce("transaction-row-id")
      .mockRejectedValueOnce(new Error("history write failed"))
      .mockResolvedValueOnce("transaction-row-id");

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toMatchObject({
      kind: "bookkeeping_failed",
      escrowId: "42",
      txHash,
      escrowRecordSaved: true,
    });

    expect(params.createEscrowRecord).toHaveBeenCalledOnce();
    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "success", txHash }),
    );
  });

  it("records confirmed chain success when the ID readback cannot recover the escrow", async () => {
    const params = dependencies();
    runtime.createAndFundOpenEscrowOnChain.mockRejectedValue(
      new EscrowIdRecoveryError("escrow ID read failed", txHash, true),
    );

    await expect(runAtomicOpenEscrowPosting(params)).resolves.toEqual({
      kind: "recovery_failed",
      txHash,
      message: "On-chain transaction failed: escrow ID read failed",
    });

    expect(params.createEscrowRecord).not.toHaveBeenCalled();
    expect(params.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({
        txHash,
        transactionHash: txHash,
        status: "success",
      }),
    );
  });
});
