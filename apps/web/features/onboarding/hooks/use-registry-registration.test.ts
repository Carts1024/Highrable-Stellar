// @vitest-environment jsdom

import { StellarTransactionPendingError } from "@/core/stellar/transaction";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  checkRegistryTransaction: vi.fn(),
  completeOnboarding: vi.fn(),
  configError: null as Error | null,
  createTransaction: vi.fn(),
  getUserRegistration: vi.fn(),
  identity: {
    walletAddress: `G${"B".repeat(55)}`,
    walletType: "external_wallet" as "external_wallet" | "passkey_smart_account",
  },
  registerUser: vi.fn(),
  saveProfileDraft: vi.fn(),
  signTransaction: vi.fn(),
  syncUserRegistration: vi.fn(),
  transaction: null as null | Record<string, unknown>,
  updateTransactionStatus: vi.fn(),
  verifiedRegistration: null as null | Record<string, unknown>,
}));

vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredRegistryConfig: () => {
    if (runtime.configError) {
      throw runtime.configError;
    }
    return {
      network: "testnet",
      networkPassphrase: "Test SDF Network ; September 2015",
      registryContractId: `C${"A".repeat(55)}`,
      rpcUrl: "https://rpc.example.test",
    };
  },
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({ signTransaction: runtime.signTransaction }),
}));

vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({ ...runtime.identity }),
}));

vi.mock("@/core/stellar/registry-contract", () => {
  return {
    checkRegistryTransaction: runtime.checkRegistryTransaction,
    getUserRegistration: runtime.getUserRegistration,
    registerUser: runtime.registerUser,
  };
});

vi.mock("@repo/convex-client", () => ({
  api: {
    sync: { syncUserRegistration: "syncUserRegistration" },
    transactions: {
      createTransaction: "createTransaction",
      getRegistryTransaction: "transactions/getRegistryTransaction",
      updateTransactionStatus: "updateTransactionStatus",
    },
    users: {
      completeOnboarding: "completeOnboarding",
      saveProfileDraft: "saveProfileDraft",
    },
  },
}));

vi.mock("convex/server", () => ({
  makeFunctionReference: (name: string) => name,
}));

vi.mock("convex/react", () => ({
  useAction: () => runtime.syncUserRegistration,
  useMutation: (reference: string) => {
    switch (reference) {
      case "saveProfileDraft":
        return runtime.saveProfileDraft;
      case "completeOnboarding":
        return runtime.completeOnboarding;
      case "createTransaction":
        return runtime.createTransaction;
      case "updateTransactionStatus":
        return runtime.updateTransactionStatus;
      default:
        throw new Error(`Unexpected mutation reference: ${reference}`);
    }
  },
  useQuery: (reference: string) => {
    if (reference === "registry/queries:getVerifiedRegistration") {
      return runtime.verifiedRegistration;
    }
    if (reference === "transactions/getRegistryTransaction") {
      return runtime.transaction;
    }
    throw new Error(`Unexpected query reference: ${reference}`);
  },
}));

import { useRegistryRegistration } from "./use-registry-registration";

const registrationIdentity = {
  transactionHash: "a".repeat(64),
  transactionValidUntil: 1_900_000_000,
};
const profileDraft = {
  firstName: "Ada",
  lastName: "Lovelace",
  publicHandle: "adalovelace",
  coreSkills: ["Stellar"],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  runtime.configError = null;
  runtime.identity = {
    walletAddress: `G${"B".repeat(55)}`,
    walletType: "external_wallet",
  };
  runtime.transaction = null;
  runtime.verifiedRegistration = null;
  runtime.signTransaction.mockResolvedValue("signed-xdr");
  runtime.saveProfileDraft.mockResolvedValue("user-id");
  runtime.createTransaction.mockResolvedValue("transaction-id");
  runtime.updateTransactionStatus.mockResolvedValue("transaction-id");
  runtime.completeOnboarding.mockResolvedValue("user-id");
  runtime.syncUserRegistration.mockResolvedValue({ ok: true, isRegistered: false });
  runtime.getUserRegistration.mockResolvedValue(null);
  runtime.checkRegistryTransaction.mockResolvedValue({ status: "pending" });
  runtime.registerUser.mockImplementation(
    async (params: {
      onSigned: (identity: typeof registrationIdentity) => Promise<void>;
      onPhase: (phase: "simulation" | "signing" | "submission" | "confirmation") => void;
    }) => {
      params.onPhase("simulation");
      await params.onSigned(registrationIdentity);
      return { txHash: registrationIdentity.transactionHash };
    },
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useRegistryRegistration", () => {
  it.each(["external_wallet", "passkey_smart_account"] as const)(
    "completes registration for %s only after registry synchronization",
    async (walletType) => {
      runtime.identity = { ...runtime.identity, walletType };
      runtime.syncUserRegistration
        .mockResolvedValueOnce({ ok: true, isRegistered: false })
        .mockResolvedValueOnce({ ok: true, isRegistered: true });
      const { result } = renderHook(() => useRegistryRegistration());

      await act(async () => {
        await result.current.register({ completeOnboarding: true });
      });

      expect(runtime.registerUser).toHaveBeenCalledWith(
        expect.objectContaining({ walletType, walletAddress: runtime.identity.walletAddress }),
      );
      expect(runtime.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: "register_user", status: "pending" }),
      );
      expect(runtime.completeOnboarding).toHaveBeenCalledWith({
        walletAddress: runtime.identity.walletAddress,
      });
      expect(result.current.step).toBe("complete");
    },
  );

  it("keeps a confirmed transaction successful when Convex sync fails afterward", async () => {
    runtime.syncUserRegistration
      .mockResolvedValueOnce({ ok: true, isRegistered: false })
      .mockResolvedValueOnce({ ok: false, errorMessage: "RPC unavailable" });
    const { result } = renderHook(() => useRegistryRegistration());

    await act(async () => {
      await result.current.register({ completeOnboarding: true });
    });

    expect(runtime.updateTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", confirmedAt: expect.any(Number) }),
    );
    expect(runtime.completeOnboarding).not.toHaveBeenCalled();
    expect(result.current.error).toContain("RPC unavailable");
  });

  it("records signature rejection as failed and leaves the saved profile draft resumable", async () => {
    runtime.saveProfileDraft.mockResolvedValue("user-id");
    runtime.registerUser.mockRejectedValue(new Error("User declined the signature."));
    const { result } = renderHook(() => useRegistryRegistration());

    await act(async () => {
      await result.current.register({ profileDraft: profileDraft as never });
    });

    expect(runtime.saveProfileDraft).toHaveBeenCalledWith(
      expect.objectContaining({ walletAddress: runtime.identity.walletAddress }),
    );
    expect(runtime.updateTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "User declined the signature." }),
    );
    expect(result.current.error).toContain("User declined the signature");
  });

  it("preserves a known sponsored inner hash as pending bookkeeping", async () => {
    runtime.registerUser.mockImplementation(
      async (params: { onSigned: (identity: typeof registrationIdentity) => Promise<void> }) => {
        await params.onSigned({
          ...registrationIdentity,
          identityType: "inner_transaction",
        } as typeof registrationIdentity);
        throw new StellarTransactionPendingError(
          "Sponsored submission is still being confirmed.",
          registrationIdentity.transactionHash,
        );
      },
    );
    const { result } = renderHook(() => useRegistryRegistration());

    await act(async () => {
      await result.current.register();
    });

    expect(runtime.updateTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        transactionHash: registrationIdentity.transactionHash,
        transactionValidUntil: registrationIdentity.transactionValidUntil,
        submissionIdentityType: "inner_transaction",
      }),
    );
    const persistedStatuses = runtime.updateTransactionStatus.mock.calls.map(([args]) => args);
    expect(persistedStatuses.some((args) => "txHash" in args)).toBe(false);
  });

  it("does not resubmit a pending transaction after a refresh", async () => {
    runtime.transaction = {
      clientRequestId: "saved-operation",
      createdAt: 1_800_000_000_000,
      status: "pending",
      submissionIdentityType: "transaction",
      transactionValidUntil: 1_900_000_000,
      txHash: registrationIdentity.transactionHash,
    };
    runtime.checkRegistryTransaction.mockResolvedValue({ status: "pending" });
    const firstMount = renderHook(() => useRegistryRegistration());
    firstMount.unmount();

    const { result } = renderHook(() => useRegistryRegistration());
    await act(async () => {
      await result.current.checkRegistration();
    });

    expect(runtime.checkRegistryTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ transactionHash: registrationIdentity.transactionHash }),
    );
    expect(runtime.registerUser).not.toHaveBeenCalled();
    expect(runtime.createTransaction).not.toHaveBeenCalled();
  });

  it("ignores an in-flight result after the wallet changes", async () => {
    const saveDraft = deferred<string>();
    runtime.saveProfileDraft.mockReturnValue(saveDraft.promise);
    const { result, rerender } = renderHook(() => useRegistryRegistration());
    let registrationPromise: Promise<void> | undefined;

    act(() => {
      registrationPromise = result.current.register({ profileDraft: profileDraft as never });
    });
    await waitFor(() => expect(runtime.saveProfileDraft).toHaveBeenCalled());
    runtime.identity = {
      walletAddress: `G${"C".repeat(55)}`,
      walletType: "external_wallet",
    };
    rerender();
    saveDraft.resolve("user-id");

    await act(async () => {
      await registrationPromise;
    });

    expect(runtime.syncUserRegistration).not.toHaveBeenCalled();
    expect(runtime.registerUser).not.toHaveBeenCalled();
    expect(runtime.createTransaction).not.toHaveBeenCalled();
  });

  it("prevents duplicate registration from rapid repeated clicks", async () => {
    const { result } = renderHook(() => useRegistryRegistration());
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;

    act(() => {
      first = result.current.register();
      second = result.current.register();
    });
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(runtime.createTransaction).toHaveBeenCalledTimes(1);
    expect(runtime.registerUser).toHaveBeenCalledTimes(1);
  });

  it("blocks new registration with actionable feedback when registry config is missing", async () => {
    runtime.configError = new Error("Set NEXT_PUBLIC_REGISTRY_CONTRACT_ID.");
    const { result } = renderHook(() => useRegistryRegistration());

    await act(async () => {
      await result.current.register();
    });

    expect(result.current.configurationError).toContain("NEXT_PUBLIC_REGISTRY_CONTRACT_ID");
    expect(runtime.registerUser).not.toHaveBeenCalled();
    expect(runtime.createTransaction).not.toHaveBeenCalled();
  });

  it("checks pending expiry without starting a replacement transaction", async () => {
    runtime.transaction = {
      clientRequestId: "saved-operation",
      createdAt: 1_800_000_000_000,
      status: "pending",
      submissionIdentityType: "transaction",
      transactionValidUntil: 1_900_000_000,
      txHash: registrationIdentity.transactionHash,
    };
    runtime.checkRegistryTransaction.mockResolvedValue({ status: "expired" });
    const { result } = renderHook(() => useRegistryRegistration());

    await act(async () => {
      await result.current.checkRegistration();
    });

    expect(runtime.updateTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(runtime.registerUser).not.toHaveBeenCalled();
    expect(runtime.createTransaction).not.toHaveBeenCalled();
  });
});
