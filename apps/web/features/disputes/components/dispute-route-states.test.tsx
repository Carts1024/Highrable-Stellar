// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { queryResults, queryCalls, walletIdentity, reset } = vi.hoisted(() => ({
  queryResults: {} as Record<string, unknown>,
  queryCalls: [] as Array<{ name: string; args: unknown }>,
  walletIdentity: { walletAddress: null as string | null, walletType: null as string | null },
  reset: vi.fn(),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    disputes: {
      getDisputesForWallet: "list",
      canViewDispute: "permission",
      getDispute: "detail",
      getDisputeTimeline: "timeline",
      markDisputeOnChainStarted: "started",
      markDisputeOnChainSucceeded: "succeeded",
      markDisputeOnChainFailed: "failed",
    },
    work_agreements: { getAgreementContextForDispute: "agreement" },
    escrows: { updateEscrowStatus: "escrow" },
    milestones: { updateMilestoneEscrowStatus: "milestone" },
    transactions: {
      createTransaction: "createTransaction",
      updateTransactionStatus: "transaction",
    },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    queryCalls.push({ name, args });
    return args === "skip" ? undefined : queryResults[name];
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => walletIdentity,
}));
vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({ address: null, walletState: {}, signTransaction: vi.fn() }),
}));
vi.mock("@/core/config/stellar-contracts", () => ({ getRequiredEscrowActionConfig: vi.fn() }));
vi.mock("@/core/stellar/escrow-contract", () => ({ markDisputedOnChain: vi.fn() }));
vi.mock("@/core/stellar/explorer", () => ({ getTxExplorerUrl: vi.fn() }));
vi.mock("@/core/stellar/passkeySmartAccountExecutor", () => ({
  getPasskeyEscrowExecutionReadiness: vi.fn(),
}));
vi.mock("@/core/stellar/transaction", () => ({
  isPendingStellarTransactionError: vi.fn(),
  normalizeStellarError: vi.fn(),
}));
vi.mock("@/features/attachments/components", () => ({ AttachmentList: () => null }));
vi.mock("@/features/common", () => ({
  showWarningToast: vi.fn(),
  RouteCallout: ({ children }: { children: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
}));
vi.mock("@/features/work-agreements/components", () => ({ AgreementReferenceCard: () => null }));
vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => createElement("span", null, children),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));
vi.mock("./dispute-response-composer", () => ({ DisputeResponseComposer: () => null }));
vi.mock("./dispute-status-badge", () => ({
  DisputeStatusBadge: () => null,
  DisputeOnChainStatusBadge: () => null,
}));
vi.mock("./dispute-timeline", () => ({ DisputeTimeline: () => null }));

import DisputesError from "@/app/disputes/error";

import { DisputeDetailPanel } from "./dispute-detail-panel";
import { DisputeList } from "./dispute-list";

describe("participant dispute route states", () => {
  afterEach(() => {
    cleanup();
    walletIdentity.walletAddress = null;
    walletIdentity.walletType = null;
    reset.mockReset();
    queryCalls.length = 0;
    for (const key of Object.keys(queryResults)) delete queryResults[key];
  });

  it("skips wallet-scoped reads when disconnected", () => {
    render(createElement(DisputeList));
    expect(screen.getByText("Connect your wallet to view disputes.")).toBeTruthy();
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByText("Connect your wallet to view this dispute.")).toBeTruthy();
  });

  it("distinguishes list loading and empty states", () => {
    walletIdentity.walletAddress = "GCLIENT";
    const view = render(createElement(DisputeList));
    expect(screen.getByRole("status").textContent).toContain("Loading disputes");
    queryResults.list = [];
    view.rerender(createElement(DisputeList));
    expect(screen.getByText("No disputes found for this wallet.")).toBeTruthy();
  });

  it("gates detail reads and distinguishes forbidden from missing cases", () => {
    walletIdentity.walletAddress = "GCLIENT";
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("status").textContent).toContain("Loading dispute");
    queryResults.permission = { allowed: false, reason: "Only participants may view this case." };
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("alert").textContent).toContain("do not have access");
    expect(
      queryCalls.filter((call) => call.name === "detail").every((call) => call.args === "skip"),
    ).toBe(true);
    queryResults.permission = { allowed: false, reason: "Dispute not found." };
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("alert").textContent).toContain("Dispute not found");
  });

  it("offers an explicit retry after a route read error", () => {
    render(createElement(DisputesError, { reset }));
    expect(screen.getByRole("alert").textContent).toContain("Unable to load disputes");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
