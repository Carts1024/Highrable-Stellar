import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  prepareTransaction: vi.fn(),
  sendTransaction: vi.fn(),
  getTransaction: vi.fn(),
  env: {
    NEXT_PUBLIC_ENABLE_VELO_GAS_STATION: false,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  },
}));

vi.mock("@/core/config/env", () => ({ env: runtime.env }));

vi.mock("@stellar/stellar-sdk", () => {
  class FakeContract {
    constructor(readonly contractId: string) {}

    call(method: string) {
      return { contractId: this.contractId, method };
    }
  }

  class FakeTransactionBuilder {
    constructor(..._args: unknown[]) {}

    setTimeout() {
      return this;
    }

    addOperation() {
      return this;
    }

    build() {
      return { toXDR: () => "prepared-xdr" };
    }

    static fromXDR() {
      return {
        hash: () => new Uint8Array([1, 2, 3]),
        timeBounds: { maxTime: 123 },
      };
    }
  }

  class FakeServer {
    constructor(..._args: unknown[]) {}

    getAccount() {
      return Promise.resolve({});
    }

    prepareTransaction() {
      return runtime.prepareTransaction();
    }

    sendTransaction(transaction: unknown) {
      return runtime.sendTransaction(transaction);
    }

    getTransaction(hash: string) {
      return runtime.getTransaction(hash);
    }
  }

  return {
    BASE_FEE: "100",
    Contract: FakeContract,
    TransactionBuilder: FakeTransactionBuilder,
    scValToNative: vi.fn(() => "return-value"),
    rpc: {
      Server: FakeServer,
      Api: {
        GetTransactionStatus: {
          SUCCESS: "SUCCESS",
          FAILED: "FAILED",
          NOT_FOUND: "NOT_FOUND",
        },
      },
    },
  };
});

import { invokeContract } from "./transaction";

const invokeParams = {
  rpcUrl: "https://rpc.example",
  networkPassphrase: "test-passphrase",
  sourceAddress: "GADMIN",
  contractId: "CONTRACT",
  method: "resolve_dispute",
  args: [],
};

describe("invokeContract execution phases and recovery identity", () => {
  beforeEach(() => {
    runtime.prepareTransaction.mockResolvedValue({ toXDR: () => "prepared-xdr" });
    runtime.sendTransaction.mockResolvedValue({ status: "PENDING", hash: "submitted-hash" });
    runtime.getTransaction.mockResolvedValue({ status: "SUCCESS", returnValue: undefined });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports simulation, signing, submission, and confirmation in order", async () => {
    const phases: string[] = [];

    await invokeContract({
      ...invokeParams,
      signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
      onPhase: (phase) => phases.push(phase),
      onSigned: async () => {
        phases.push("signed-identity-recorded");
      },
    });

    expect(phases).toEqual([
      "simulation",
      "signing",
      "signed-identity-recorded",
      "submission",
      "confirmation",
    ]);
  });

  it("does not sign or submit when simulation/preparation fails", async () => {
    runtime.prepareTransaction.mockRejectedValue(new Error("simulation failed"));
    const signTransaction = vi.fn();

    await expect(invokeContract({ ...invokeParams, signTransaction })).rejects.toThrow(
      "simulation failed",
    );
    expect(signTransaction).not.toHaveBeenCalled();
    expect(runtime.sendTransaction).not.toHaveBeenCalled();
  });

  it("keeps the local hash when signed-identity persistence fails", async () => {
    await expect(
      invokeContract({
        ...invokeParams,
        signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
        onSigned: async () => {
          throw new Error("signed identity API unavailable");
        },
      }),
    ).rejects.toMatchObject({
      txHash: "010203",
      message: "signed identity API unavailable",
    });
    expect(runtime.sendTransaction).not.toHaveBeenCalled();
  });

  it("keeps the local hash when submission transport fails", async () => {
    runtime.sendTransaction.mockRejectedValue(new Error("RPC transport failed"));

    await expect(
      invokeContract({
        ...invokeParams,
        signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
      }),
    ).rejects.toMatchObject({
      txHash: "010203",
      message: "RPC transport failed",
    });
  });

  it("keeps the submitted hash when confirmation reports an RPC failure", async () => {
    runtime.getTransaction.mockResolvedValue({ status: "FAILED" });

    await expect(
      invokeContract({
        ...invokeParams,
        signTransaction: vi.fn().mockResolvedValue("signed-xdr"),
      }),
    ).rejects.toMatchObject({
      txHash: "010203",
      message: "On-chain transaction failed.",
    });
  });
});
