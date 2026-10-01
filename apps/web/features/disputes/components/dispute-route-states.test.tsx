// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { queryResults, queryCalls, timelineProps, walletIdentity, reset } = vi.hoisted(() => ({
  queryResults: {} as Record<string, unknown>,
  queryCalls: [] as Array<{ name: string; args: unknown }>,
  timelineProps: [] as Array<{ disputeId: string; viewerWallet: string }>,
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
vi.mock("./dispute-timeline", () => ({
  ParticipantDisputeTimeline: (props: { disputeId: string; viewerWallet: string }) => {
    timelineProps.push(props);
    return createElement("span", null, "Timeline mounted");
  },
}));

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
    timelineProps.length = 0;
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

  it("shows only cases linked to the active wallet", () => {
    walletIdentity.walletAddress = "GCLIENT";
    queryResults.list = [
      {
        _id: "mine",
        disputeNumber: "DSP-1",
        title: "My dispute",
        reasonCategory: "work_quality_issue",
        openedAt: 1,
        status: "open",
        onChainStatus: "not_marked",
        clientWallet: "GCLIENT",
        freelancerWallet: "GFREELANCER",
      },
      {
        _id: "other",
        disputeNumber: "DSP-2",
        title: "Another wallet's dispute",
        reasonCategory: "work_quality_issue",
        openedAt: 1,
        status: "open",
        onChainStatus: "not_marked",
        clientWallet: "GOTHER",
        freelancerWallet: "GANOTHER",
      },
    ];

    render(createElement(DisputeList));
    expect(screen.getByText("My dispute")).toBeTruthy();
    expect(screen.getByText("Your role: Client")).toBeTruthy();
    expect(screen.queryByText("Another wallet's dispute")).toBeNull();
    expect(queryCalls.find((call) => call.name === "list")?.args).toEqual({
      walletAddress: "GCLIENT",
    });
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

  it("renders a permitted case and mounts its timeline for the active wallet", () => {
    walletIdentity.walletAddress = "GFREELANCER";
    queryResults.permission = { allowed: true, reason: null, role: "freelancer" };
    queryResults.detail = {
      _id: "dispute-id",
      disputeNumber: "DSP-100",
      title: "Work quality dispute",
      reasonCategory: "work_quality_issue",
      status: "under_review",
      onChainStatus: "marked",
      openedAt: 1,
      clientWallet: "GCLIENT",
      freelancerWallet: "GFREELANCER",
      description: "The work needs review.",
      attachments: [],
    };

    render(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("heading", { name: "Work quality dispute" })).toBeTruthy();
    expect(timelineProps).toContainEqual({
      disputeId: "dispute-id",
      viewerWallet: "GFREELANCER",
    });
    expect(queryCalls.find((call) => call.name === "detail")?.args).toEqual({
      disputeId: "dispute-id",
      viewerWallet: "GFREELANCER",
    });
  });

  it("offers an explicit retry after a route read error", () => {
    render(createElement(DisputesError, { reset }));
    expect(screen.getByRole("alert").textContent).toContain("Unable to load disputes");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
