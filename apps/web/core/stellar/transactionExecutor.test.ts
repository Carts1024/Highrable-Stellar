import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  executeWithPasskeySmartAccount: vi.fn(),
  invokeContract: vi.fn(),
}));

vi.mock("@/core/stellar/passkeySmartAccountExecutor", () => ({
  executeWithPasskeySmartAccount: runtime.executeWithPasskeySmartAccount,
}));

vi.mock("@/core/stellar/transaction", () => {
  class StellarTransactionError extends Error {
    constructor(
      message: string,
      readonly txHash?: string,
    ) {
      super(message);
      this.name = "StellarTransactionError";
    }
  }

  class StellarTransactionPendingError extends StellarTransactionError {
    constructor(message: string, txHash?: string) {
      super(message, txHash);
      this.name = "StellarTransactionPendingError";
    }
  }

  return {
    StellarTransactionError,
    StellarTransactionPendingError,
    invokeContract: runtime.invokeContract,
  };
});

import { executeHighrableContractCall } from "./transactionExecutor";

const submissionIdentity = {
  operationId: "registry-operation",
  transactionHash: "a".repeat(64),
  transactionValidUntil: 1_900_000_000,
};

const sharedParams = {
  action: "register user",
  args: [],
  contractId: `C${"A".repeat(55)}`,
  method: "register",
  networkPassphrase: "Test SDF Network ; September 2015",
  onSigned: vi.fn(async () => undefined),
  operationId: "registry-operation",
  onPhase: vi.fn(),
  rpcUrl: "https://rpc.example.test",
  signTransaction: vi.fn(async () => "signed-xdr"),
};

beforeEach(() => {
  runtime.invokeContract.mockResolvedValue({ txHash: "outer-hash" });
  runtime.executeWithPasskeySmartAccount.mockResolvedValue({
    status: "success",
    txHash: "outer-hash",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("shared Highrable transaction executor", () => {
  it("routes external wallets through the classic source and preserves callbacks", async () => {
    const walletAddress = `G${"B".repeat(55)}`;

    await executeHighrableContractCall({
      ...sharedParams,
      walletAddress,
      walletType: "external_wallet",
    });

    expect(runtime.invokeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAddress: walletAddress,
        operationId: sharedParams.operationId,
        onSigned: sharedParams.onSigned,
        onPhase: sharedParams.onPhase,
      }),
    );
    expect(runtime.executeWithPasskeySmartAccount).not.toHaveBeenCalled();
  });

  it("routes passkey wallets as contract actors and preserves signed identity callbacks", async () => {
    const walletAddress = `C${"D".repeat(55)}`;
    runtime.executeWithPasskeySmartAccount.mockImplementation(
      async (params: { onSigned: (identity: typeof submissionIdentity) => Promise<void> }) => {
        await params.onSigned(submissionIdentity);
        return { status: "success", txHash: "outer-hash" };
      },
    );

    await executeHighrableContractCall({
      ...sharedParams,
      walletAddress,
      walletType: "passkey_smart_account",
    });

    expect(runtime.executeWithPasskeySmartAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        smartAccountAddress: walletAddress,
        onSigned: sharedParams.onSigned,
        onPhase: sharedParams.onPhase,
      }),
    );
    expect(sharedParams.onSigned).toHaveBeenCalledWith(submissionIdentity);
    expect(runtime.invokeContract).not.toHaveBeenCalled();
  });

  it("keeps passkey submission uncertainty pending with its known hash", async () => {
    const walletAddress = `C${"E".repeat(55)}`;
    runtime.executeWithPasskeySmartAccount.mockResolvedValue({
      status: "pending",
      txHash: "inner-hash",
      errorMessage: "confirmation timed out",
    });

    await expect(
      executeHighrableContractCall({
        ...sharedParams,
        walletAddress,
        walletType: "passkey_smart_account",
      }),
    ).rejects.toMatchObject({
      name: "StellarTransactionPendingError",
      txHash: "inner-hash",
      message: "confirmation timed out",
    });
  });
});
