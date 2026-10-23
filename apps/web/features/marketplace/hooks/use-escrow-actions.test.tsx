/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  activeWallet: "G" + "A".repeat(55),
  identity: {
    walletAddress: "G" + "A".repeat(55),
    walletType: "external_wallet",
    isConnected: true,
    canSignEscrowTransactions: true,
  },
  passkeyReadiness: {
    canExecute: true,
    feePath: "relayer",
    classicSourceAddress: null,
  },
  createEscrowOnChain: vi.fn(),
  fundEscrowOnChain: vi.fn(),
  getTokenBalanceOnChain: vi.fn(),
  syncEscrowStatus: vi.fn(),
  mutations: {
    createTransaction: vi.fn(),
    updateTransactionStatus: vi.fn(),
    createEscrowRecord: vi.fn(),
    updateEscrowStatus: vi.fn(),
    createReputationRecord: vi.fn(),
  },
}));

vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredEscrowActionConfig: () => ({
    rpcUrl: "https://rpc.example.test",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: "C" + "B".repeat(55),
    horizonUrl: "https://horizon.example.test",
    reputationContractId: "C" + "C".repeat(55),
    stablecoinTokenContractId: "C" + "D".repeat(55),
  }),
  STELLAR_NETWORK: "testnet",
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
    approveAndReleaseOnChain: vi.fn(),
    cancelEscrowOnChain: vi.fn(),
    createEscrowOnChain: runtime.createEscrowOnChain,
    fundEscrowOnChain: runtime.fundEscrowOnChain,
    getTokenBalanceOnChain: runtime.getTokenBalanceOnChain,
    markDisputedOnChain: vi.fn(),
    submitWorkOnChain: vi.fn(),
    EscrowIdRecoveryError,
  };
});
vi.mock("@/core/stellar/explorer", () => ({ getTxExplorerUrl: vi.fn(() => null) }));
vi.mock("@/core/stellar/hashes", () => ({
  bytesToHex: vi.fn(() => "hash"),
  toBytesN32Hash: vi.fn(async () => new Uint8Array(32).fill(1)),
}));
vi.mock("@/core/stellar/passkeySmartAccountExecutor", () => ({
  getPasskeyEscrowExecutionReadiness: vi.fn(async () => runtime.passkeyReadiness),
}));
vi.mock("@/core/stellar/payment-assets", () => ({
  parseEscrowAssetAmount: vi.fn(() => 25_000_000n),
  requireSupportedEscrowAsset: vi.fn(() => ({
    tokenContractId: "C" + "D".repeat(55),
    decimals: 6,
    symbol: "USDC",
  })),
}));
vi.mock("@/core/stellar/smart-account-kit", () => ({
  getSmartAccountKit: vi.fn(() => ({ deployerPublicKey: runtime.activeWallet })),
}));
vi.mock("@/core/stellar/transaction", () => ({
  isPendingStellarTransactionError: vi.fn(() => false),
  normalizeStellarError: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : "unexpected error",
  ),
}));
vi.mock("@/core/wallet/config", () => ({
  getWalletNetworkMismatchMessage: vi.fn(() => "wrong network"),
  isWalletOnConfiguredNetwork: vi.fn(() => true),
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => runtime.identity,
}));
vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({
    address: runtime.activeWallet,
    walletState: {
      isConnected: true,
      isFunded: true,
      isTestnet: true,
      canWriteContracts: true,
    },
    signTransaction: vi.fn(async () => "signed-xdr"),
  }),
}));
vi.mock("@/features/marketplace/lib/escrow-action-guards", () => ({
  getEscrowActionGuard: vi.fn(() => ({ canAct: true, reason: null })),
}));
vi.mock("@repo/convex-client", () => ({
  api: {
    transactions: {
      createTransaction: "createTransaction",
      updateTransactionStatus: "updateTransactionStatus",
    },
    escrows: {
      createEscrowRecord: "createEscrowRecord",
      updateEscrowStatus: "updateEscrowStatus",
    },
    reputation: { createReputationRecord: "createReputationRecord" },
    sync: { syncEscrowStatus: "syncEscrowStatus" },
  },
}));
vi.mock("convex/react", () => ({
  useMutation: (key: keyof typeof runtime.mutations) => runtime.mutations[key],
  useAction: () => runtime.syncEscrowStatus,
}));

import { EscrowIdRecoveryError } from "@/core/stellar/escrow-contract";

import type { TStellarExecutionPhase } from "@/core/stellar/transaction";
import type { TConvexDoc } from "@repo/convex-client";

import { useEscrowActions } from "./use-escrow-actions";

const walletAddress = "G" + "A".repeat(55);
const txHash = "c".repeat(64);
const job = {
  _id: "jobs:1",
  status: "selected",
  clientWallet: walletAddress,
  selectedFreelancerWallet: "G" + "E".repeat(55),
  asset: "C" + "D".repeat(55),
  jobHash: "job-hash",
  budget: 25,
  jobType: "micro_gig",
} as unknown as TConvexDoc<"jobs">;

function renderActions(escrow: TConvexDoc<"escrows"> | null = null) {
  return renderHook(() => useEscrowActions({ job, escrow, applications: [] }));
}

beforeEach(() => {
  runtime.activeWallet = walletAddress;
  runtime.identity = {
    walletAddress,
    walletType: "external_wallet",
    isConnected: true,
    canSignEscrowTransactions: true,
  };
  Object.values(runtime.mutations).forEach((mutation) => mutation.mockResolvedValue("mutation-id"));
  runtime.getTokenBalanceOnChain.mockResolvedValue(50_000_000n);
  runtime.createEscrowOnChain.mockImplementation(
    async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
      onPhase?.("simulation");
      return { txHash, escrowId: "42" };
    },
  );
  runtime.fundEscrowOnChain.mockImplementation(
    async ({
      onPhase,
      preSignCheck,
    }: {
      onPhase?: (phase: TStellarExecutionPhase) => void;
      preSignCheck?: () => Promise<void>;
    }) => {
      await preSignCheck?.();
      onPhase?.("simulation");
      return { txHash };
    },
  );
  runtime.syncEscrowStatus.mockResolvedValue({ ok: true, changed: false, newStatus: "created" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useEscrowActions progress and execution guards", () => {
  it("blocks a duplicate click before starting a second chain call", async () => {
    const hook = renderActions();
    let resolveChain: ((result: { txHash: string; escrowId: string }) => void) | undefined;
    const chainResult = new Promise<{ txHash: string; escrowId: string }>((resolve) => {
      resolveChain = resolve;
    });
    runtime.createEscrowOnChain.mockImplementationOnce(
      async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
        onPhase?.("simulation");
        return await chainResult;
      },
    );

    let firstAction: Promise<boolean> | undefined;
    let duplicateAction: Promise<boolean> | undefined;
    act(() => {
      firstAction = hook.result.current.createEscrow();
      duplicateAction = hook.result.current.createEscrow();
    });
    await expect(duplicateAction).resolves.toBe(false);

    await waitFor(() => expect(runtime.createEscrowOnChain).toHaveBeenCalledOnce());
    resolveChain?.({ txHash, escrowId: "42" });
    await act(async () => await firstAction);

    expect(runtime.createEscrowOnChain).toHaveBeenCalledOnce();
    expect(runtime.mutations.createTransaction).toHaveBeenCalledOnce();
  });

  it("announces chain phases and ignores callbacks after the wallet changes", async () => {
    const hook = renderActions();
    let resolveChain: ((result: { txHash: string; escrowId: string }) => void) | undefined;
    let reportPhase: ((phase: TStellarExecutionPhase) => void) | undefined;
    const chainResult = new Promise<{ txHash: string; escrowId: string }>((resolve) => {
      resolveChain = resolve;
    });
    runtime.createEscrowOnChain.mockImplementationOnce(
      async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
        reportPhase = onPhase;
        onPhase?.("simulation");
        return await chainResult;
      },
    );

    let action: Promise<boolean> | undefined;
    act(() => {
      action = hook.result.current.createEscrow();
    });
    await waitFor(() => expect(hook.result.current.progress).toBe("simulating"));

    runtime.activeWallet = "G" + "F".repeat(55);
    runtime.identity = {
      walletAddress: runtime.activeWallet,
      walletType: "external_wallet",
      isConnected: true,
      canSignEscrowTransactions: true,
    };
    hook.rerender();
    await waitFor(() => expect(hook.result.current.progress).toBeNull());

    runtime.activeWallet = walletAddress;
    runtime.identity = {
      walletAddress,
      walletType: "external_wallet",
      isConnected: true,
      canSignEscrowTransactions: true,
    };
    hook.rerender();

    act(() => reportPhase?.("signing"));
    expect(hook.result.current.progress).toBeNull();

    resolveChain?.({ txHash, escrowId: "42" });
    await act(async () => await action);
    expect(hook.result.current.success).toBeNull();
    expect(hook.result.current.pendingAction).toBeNull();
  });

  it("blocks escrow creation before a chain call when the token balance is insufficient", async () => {
    runtime.getTokenBalanceOnChain.mockResolvedValueOnce(0n);
    const hook = renderActions();

    await act(async () => {
      await hook.result.current.createEscrow();
    });

    expect(runtime.createEscrowOnChain).not.toHaveBeenCalled();
    expect(runtime.mutations.createTransaction).toHaveBeenCalledOnce();
    expect(runtime.mutations.updateTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(hook.result.current.error).toContain("You need more USDC");
  });

  it("funds a standalone micro-gig escrow and records the phase", async () => {
    const escrow = {
      _id: "escrows:1",
      escrowId: "42",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.fundEscrowOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        walletType: "external_wallet",
        escrowId: "42",
        onPhase: expect.any(Function),
        preSignCheck: expect.any(Function),
      }),
    );
    expect(runtime.getTokenBalanceOnChain).toHaveBeenCalledOnce();
    expect(runtime.mutations.updateEscrowStatus).toHaveBeenCalledWith(
      expect.objectContaining({ escrowId: "42", status: "funded", txHash, txType: "fund_escrow" }),
    );
  });

  it("keeps insufficient-balance funding blocked before wallet signing", async () => {
    runtime.getTokenBalanceOnChain.mockResolvedValueOnce(0n);
    const escrow = {
      _id: "escrows:1",
      escrowId: "42",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.fundEscrowOnChain).toHaveBeenCalledOnce();
    expect(runtime.mutations.updateEscrowStatus).not.toHaveBeenCalled();
    expect(runtime.mutations.updateTransactionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(hook.result.current.error).toContain("You need more USDC");
  });

  it("forwards validated passkey readiness into standalone micro-gig funding", async () => {
    const passkeyAddress = "C" + "F".repeat(55);
    runtime.activeWallet = passkeyAddress;
    runtime.identity = {
      walletAddress: passkeyAddress,
      walletType: "passkey_smart_account",
      isConnected: true,
      canSignEscrowTransactions: true,
    };
    const escrow = {
      _id: "escrows:1",
      escrowId: "42",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.fundEscrowOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        walletType: "passkey_smart_account",
        escrowId: "42",
        passkeyReadiness: runtime.passkeyReadiness,
      }),
    );
  });

  it("reconciles an invalid on-chain status after simulation without recording a successful fund", async () => {
    runtime.fundEscrowOnChain.mockImplementationOnce(
      async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
        onPhase?.("simulation");
        throw new Error("HostError: Error(Contract, #6)");
      },
    );
    runtime.syncEscrowStatus.mockResolvedValueOnce({
      ok: true,
      changed: true,
      newStatus: "funded",
    });
    const escrow = {
      _id: "escrows:1",
      escrowId: "42",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.fundEscrowOnChain).toHaveBeenCalledOnce();
    expect(runtime.syncEscrowStatus).toHaveBeenCalledWith({
      escrowId: "42",
      expectedEscrowContractId: "C" + "B".repeat(55),
      expectedNetworkPassphrase: "Test SDF Network ; September 2015",
    });
    expect(runtime.mutations.updateEscrowStatus).not.toHaveBeenCalled();
    expect(runtime.mutations.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(hook.result.current.txHash).toBeNull();
    expect(hook.result.current.error).toContain("escrow is funded on Stellar");
  });

  it("explains a client/server contract configuration mismatch after invalid status", async () => {
    runtime.fundEscrowOnChain.mockImplementationOnce(
      async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
        onPhase?.("simulation");
        throw new Error("HostError: Error(Contract, #6)");
      },
    );
    runtime.syncEscrowStatus.mockResolvedValueOnce({
      ok: false,
      reason: "contract_config_mismatch",
    });
    const escrow = {
      _id: "escrows:1",
      escrowId: "42",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.syncEscrowStatus).toHaveBeenCalledOnce();
    expect(runtime.mutations.updateEscrowStatus).not.toHaveBeenCalled();
    expect(hook.result.current.error).toContain(
      "web and Convex contract/network configuration differ",
    );
  });

  it("does not claim a current chain status when reconciliation cannot read it", async () => {
    runtime.fundEscrowOnChain.mockImplementationOnce(
      async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
        onPhase?.("simulation");
        throw new Error("HostError: Error(Contract, #6)");
      },
    );
    runtime.syncEscrowStatus.mockResolvedValueOnce({ ok: false, reason: "onchain_read_failed" });
    const escrow = {
      _id: "escrows:1",
      escrowId: "42",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.syncEscrowStatus).toHaveBeenCalledOnce();
    expect(runtime.mutations.updateEscrowStatus).not.toHaveBeenCalled();
    expect(hook.result.current.error).toContain("could not verify the latest on-chain status");
    expect(hook.result.current.error).not.toContain("is not in Created status");
  });

  it("does not reconcile invalid status errors after transaction submission begins", async () => {
    runtime.fundEscrowOnChain.mockImplementationOnce(
      async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
        onPhase?.("submission");
        throw new Error("HostError: Error(Contract, #6)");
      },
    );
    const escrow = {
      _id: "escrows:1",
      escrowId: "42",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.syncEscrowStatus).not.toHaveBeenCalled();
    expect(runtime.mutations.updateEscrowStatus).not.toHaveBeenCalled();
    expect(runtime.mutations.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("keeps confirmed creation successful in history when escrow ID recovery fails", async () => {
    runtime.createEscrowOnChain.mockRejectedValue(
      new EscrowIdRecoveryError("escrow state read failed", txHash, true),
    );
    const hook = renderActions();

    await act(async () => {
      await hook.result.current.createEscrow();
    });

    expect(runtime.mutations.createEscrowRecord).not.toHaveBeenCalled();
    expect(runtime.mutations.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ txHash, transactionHash: txHash, status: "success" }),
    );
    expect(hook.result.current.error).toContain("Stellar confirmed transaction");
  });

  it("keeps a hash pending when creation recovery cannot verify an uncertain submission", async () => {
    runtime.createEscrowOnChain.mockRejectedValue(
      new EscrowIdRecoveryError("escrow state read failed", txHash, false),
    );
    const hook = renderActions();

    await act(async () => {
      await hook.result.current.createEscrow();
    });

    expect(runtime.mutations.createEscrowRecord).not.toHaveBeenCalled();
    expect(runtime.mutations.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ txHash, transactionHash: txHash, status: "pending" }),
    );
    expect(hook.result.current.txHash).toBe(txHash);
    expect(hook.result.current.error).toContain("The transaction remains pending");
  });
});
