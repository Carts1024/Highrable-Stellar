/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
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
  mutations: {
    createTransaction: vi.fn(),
    updateTransactionStatus: vi.fn(),
    createMilestoneEscrowRecord: vi.fn(),
    updateMilestoneEscrowStatus: vi.fn(),
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
  createMilestoneHash: vi.fn(() => "milestone-hash"),
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
  getSmartAccountKit: vi.fn(() => ({ deployerPublicKey: "G" + "A".repeat(55) })),
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
vi.mock("@repo/convex-client", () => ({
  api: {
    transactions: {
      createTransaction: "createTransaction",
      updateTransactionStatus: "updateTransactionStatus",
    },
    milestones: {
      createMilestoneEscrowRecord: "createMilestoneEscrowRecord",
      updateMilestoneEscrowStatus: "updateMilestoneEscrowStatus",
    },
    reputation: { createReputationRecord: "createReputationRecord" },
  },
}));
vi.mock("convex/react", () => ({
  useMutation: (key: keyof typeof runtime.mutations) => runtime.mutations[key],
}));

import { EscrowIdRecoveryError } from "@/core/stellar/escrow-contract";

import type { TStellarExecutionPhase } from "@/core/stellar/transaction";
import type { TConvexDoc } from "@repo/convex-client";

import { useMilestoneEscrowActions } from "./use-milestone-escrow-actions";

const walletAddress = "G" + "A".repeat(55);
const contractWalletAddress = "C" + "E".repeat(55);
const txHash = "d".repeat(64);
const job = {
  _id: "jobs:milestone",
  clientWallet: walletAddress,
  asset: "C" + "D".repeat(55),
} as unknown as TConvexDoc<"jobs">;
const milestone = {
  _id: "milestones:1",
  jobId: job._id,
  order: 1,
  title: "First milestone",
  status: "assigned",
  amount: 25,
  asset: "C" + "D".repeat(55),
  assignedFreelancerWallet: "G" + "F".repeat(55),
} as unknown as TConvexDoc<"milestones">;

function renderActions(
  escrow: TConvexDoc<"escrows"> | null = null,
  jobDoc: TConvexDoc<"jobs"> = job,
) {
  return renderHook(() =>
    useMilestoneEscrowActions({ job: jobDoc, milestone, escrow, applications: [] }),
  );
}

beforeEach(() => {
  runtime.activeWallet = walletAddress;
  runtime.identity = {
    walletAddress,
    walletType: "external_wallet",
    isConnected: true,
    canSignEscrowTransactions: true,
  };
  runtime.passkeyReadiness = {
    canExecute: true,
    feePath: "relayer",
    classicSourceAddress: null,
  };
  Object.values(runtime.mutations).forEach((mutation) => mutation.mockResolvedValue("mutation-id"));
  runtime.getTokenBalanceOnChain.mockResolvedValue(50_000_000n);
  runtime.createEscrowOnChain.mockImplementation(
    async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
      onPhase?.("simulation");
      return { txHash, escrowId: "51" };
    },
  );
  runtime.fundEscrowOnChain.mockImplementation(
    async ({ onPhase }: { onPhase?: (phase: TStellarExecutionPhase) => void }) => {
      onPhase?.("simulation");
      return { txHash };
    },
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useMilestoneEscrowActions", () => {
  it("creates a standalone milestone escrow and records its execution phase", async () => {
    const hook = renderActions();

    await act(async () => {
      await hook.result.current.createEscrow();
    });

    expect(runtime.createEscrowOnChain).toHaveBeenCalledOnce();
    expect(runtime.createEscrowOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ walletType: "external_wallet", onPhase: expect.any(Function) }),
    );
    expect(runtime.mutations.createMilestoneEscrowRecord).toHaveBeenCalledWith(
      expect.objectContaining({ escrowId: "51", createTxHash: txHash }),
    );
  });

  it("funds a milestone with the passkey relayer fee path and updates funded state", async () => {
    runtime.activeWallet = contractWalletAddress;
    runtime.identity = {
      walletAddress: contractWalletAddress,
      walletType: "passkey_smart_account",
      isConnected: true,
      canSignEscrowTransactions: true,
    };
    const escrow = {
      _id: "escrows:1",
      escrowId: "51",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const passkeyJob = { ...job, clientWallet: contractWalletAddress } as TConvexDoc<"jobs">;
    const hook = renderActions(escrow, passkeyJob);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.getTokenBalanceOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAddress: walletAddress,
        walletAddress: contractWalletAddress,
      }),
    );
    expect(runtime.fundEscrowOnChain).toHaveBeenCalledWith(
      expect.objectContaining({ walletType: "passkey_smart_account", escrowId: "51" }),
    );
    expect(runtime.mutations.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ feePath: "relayer", walletType: "passkey_smart_account" }),
    );
    expect(runtime.mutations.updateMilestoneEscrowStatus).toHaveBeenCalledWith(
      expect.objectContaining({ escrowId: "51", status: "funded", txHash }),
    );
  });

  it("blocks milestone funding when the connected account is not ready", async () => {
    runtime.identity = {
      walletAddress: contractWalletAddress,
      walletType: "passkey_smart_account",
      isConnected: true,
      canSignEscrowTransactions: true,
    };
    runtime.passkeyReadiness = {
      canExecute: false,
      feePath: "missing",
      classicSourceAddress: null,
    };
    const escrow = {
      _id: "escrows:1",
      escrowId: "51",
      status: "created",
    } as unknown as TConvexDoc<"escrows">;
    const hook = renderActions(escrow);

    await act(async () => {
      await hook.result.current.fundEscrow();
    });

    expect(runtime.fundEscrowOnChain).not.toHaveBeenCalled();
    expect(runtime.mutations.createTransaction).not.toHaveBeenCalled();
  });

  it("keeps an uncertain standalone milestone creation hash pending", async () => {
    runtime.createEscrowOnChain.mockRejectedValue(
      new EscrowIdRecoveryError("escrow state read failed", txHash, false),
    );
    const hook = renderActions();

    await act(async () => {
      await hook.result.current.createEscrow();
    });

    expect(runtime.mutations.createMilestoneEscrowRecord).not.toHaveBeenCalled();
    expect(runtime.mutations.updateTransactionStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ txHash, transactionHash: txHash, status: "pending" }),
    );
    expect(hook.result.current.txHash).toBe(txHash);
    expect(hook.result.current.error).toContain("The transaction remains pending");
  });
});
