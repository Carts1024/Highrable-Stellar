// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queries, mutations, markOnChain } = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  markOnChain: vi.fn(),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    disputes: {
      canViewDispute: "permission",
      getDispute: "detail",
      markDisputeOnChainStarted: "markStarted",
      markDisputeOnChainSucceeded: "markSucceeded",
      markDisputeOnChainFailed: "markFailed",
    },
    work_agreements: { getAgreementContextForDispute: "agreement" },
    escrows: { updateEscrowStatus: "updateEscrow" },
    milestones: { updateMilestoneEscrowStatus: "updateMilestone" },
    transactions: {
      createTransaction: "createTransaction",
      updateTransactionStatus: "updateTransaction",
    },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => (args === "skip" ? undefined : queries[name]),
  useMutation: (name: string) => mutations[name],
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({ walletAddress: "GCLIENT", walletType: "external_wallet" }),
}));
vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({
    address: "GCLIENT",
    walletState: { isConnected: true, canWriteContracts: true },
    signTransaction: vi.fn(),
  }),
}));
vi.mock("@/core/wallet/config", () => ({
  isWalletOnConfiguredNetwork: () => true,
  getWalletNetworkMismatchMessage: () => "Wrong network.",
}));
vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredEscrowActionConfig: () => ({
    rpcUrl: "rpc",
    networkPassphrase: "testnet",
    escrowContractId: "contract",
  }),
}));
vi.mock("@/core/stellar/escrow-contract", () => ({ markDisputedOnChain: markOnChain }));
vi.mock("@/core/stellar/explorer", () => ({
  getTxExplorerUrl: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
}));
vi.mock("@/core/stellar/passkeySmartAccountExecutor", () => ({
  getPasskeyEscrowExecutionReadiness: vi.fn(),
}));
vi.mock("@/core/stellar/transaction", () => ({
  isPendingStellarTransactionError: () => false,
  normalizeStellarError: (error: Error) => error.message,
}));
vi.mock("@/features/attachments/components", () => ({ AttachmentList: () => null }));
vi.mock("@/features/common", () => ({ showWarningToast: vi.fn() }));
vi.mock("@/features/work-agreements/components", () => ({ AgreementReferenceCard: () => null }));
vi.mock("./dispute-participant-actions", () => ({ DisputeParticipantActions: () => null }));
vi.mock("./dispute-timeline", () => ({ ParticipantDisputeTimeline: () => null }));
vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: {
    asChild?: boolean;
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: "button";
  }) => (asChild ? children : createElement("button", props, children)),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import { DisputeDetailPanel } from "./dispute-detail-panel";

const hash = "a".repeat(64);

function detail(
  status: "not_marked" | "marking" | "mark_failed" | "marked",
  transactionHash?: string,
) {
  return {
    _id: "dispute-1",
    disputeNumber: "DSP-1",
    title: "Delivery dispute",
    reasonCategory: "work_not_delivered",
    description: "Missing delivery.",
    status: "open",
    onChainStatus: status,
    onChainEscrowId: "chain-1",
    clientWallet: "GCLIENT",
    freelancerWallet: "GFREELANCER",
    openedAt: 1,
    attachments: [],
    ...(transactionHash ? { transactionHash, stellarExpertUrl: "#" } : {}),
  };
}

describe("C23 participant transaction states", () => {
  beforeEach(() => {
    queries.permission = { allowed: true, role: "client" };
    queries.detail = detail("mark_failed");
    queries.agreement = null;
    for (const name of [
      "markStarted",
      "markSucceeded",
      "markFailed",
      "createTransaction",
      "updateTransaction",
      "updateEscrow",
      "updateMilestone",
    ]) {
      mutations[name] = vi.fn().mockResolvedValue(true);
    }
    markOnChain.mockReset().mockResolvedValue({ txHash: hash });
  });
  afterEach(cleanup);

  it("distinguishes confirmed, pending, failed with hash, and retryable states", () => {
    queries.detail = detail("marked", hash);
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText("Escrow dispute marking is confirmed on Stellar.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "View transaction on Stellar Expert" }).getAttribute("href"),
    ).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);
    expect(screen.queryByRole("button", { name: "Retry escrow marking" })).toBeNull();

    queries.detail = detail("marking");
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText(/Escrow dispute marking is pending/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry escrow marking" })).toBeNull();

    queries.detail = detail("mark_failed", hash);
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText(/Reconcile its outcome before retrying/)).toBeTruthy();
    expect(screen.getByText("Chain: Reconciliation Required")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry escrow marking" })).toBeNull();

    queries.detail = detail("mark_failed");
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByRole("button", { name: "Retry escrow marking" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "View transaction on Stellar Expert" })).toBeNull();

    queries.detail = detail("not_marked");
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText(/escrow marking has not started/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry escrow marking" })).toBeTruthy();

    queries.detail = { ...detail("mark_failed"), status: "cancelled" };
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText(/This dispute is closed/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry escrow marking" })).toBeNull();
  });

  it("locks retry after a submitted transaction has an uncertain outcome", async () => {
    markOnChain.mockImplementationOnce(
      async (args: {
        onPhase: (phase: string) => void;
        onSigned: (identity: { transactionHash: string }) => Promise<void>;
      }) => {
        await args.onSigned({ transactionHash: hash });
        args.onPhase("submission");
        throw Object.assign(new Error("RPC timeout"), { txHash: hash });
      },
    );
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry escrow marking" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Transaction outcome is uncertain"),
    );
    expect(mutations.markFailed).not.toHaveBeenCalled();
    expect(mutations.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: hash, status: "pending" }),
    );
    expect(screen.queryByRole("button", { name: "Retry escrow marking" })).toBeNull();
    expect(screen.getByRole("link", { name: "View transaction on Stellar Expert" })).toBeTruthy();
  });

  it("retries recording a confirmed result without submitting Stellar twice", async () => {
    mutations.markSucceeded!.mockRejectedValueOnce(new Error("Convex unavailable"));
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry escrow marking" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry recording confirmation" })).toBeTruthy(),
    );
    expect(screen.getByRole("alert").textContent).toContain("Stellar confirmed");
    expect(mutations.markFailed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry recording confirmation" }));
    await waitFor(() => expect(mutations.markSucceeded).toHaveBeenCalledTimes(2));
    expect(markOnChain).toHaveBeenCalledTimes(1);
    expect(mutations.updateEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ status: "disputed", txHash: hash }),
    );
  });

  it("allows a new attempt after a pre-submission failure without a page reset", async () => {
    markOnChain.mockRejectedValueOnce(new Error("Wallet rejected signing"));
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry escrow marking" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Wallet rejected signing"),
    );
    expect(mutations.markFailed).toHaveBeenCalledOnce();
    expect(mutations.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry escrow marking" }));
    await waitFor(() => expect(mutations.markSucceeded).toHaveBeenCalledOnce());
    expect(markOnChain).toHaveBeenCalledTimes(2);
  });
});
