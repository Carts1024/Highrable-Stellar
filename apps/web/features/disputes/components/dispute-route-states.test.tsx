// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Component, createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TDisputeOnChainStatus, TDisputeStatus } from "../types";

type TQueryState = { kind: "result"; value: unknown } | { kind: "error"; error: Error };

const { queryStates, queryCalls, timelineProps, actionProps, attachmentProps, walletIdentity } =
  vi.hoisted(() => ({
    queryStates: new Map<string, TQueryState>(),
    queryCalls: [] as Array<{ name: string; args: unknown }>,
    timelineProps: [] as Array<{ disputeId: string; viewerWallet: string }>,
    actionProps: [] as Array<{ disputeId: string; viewerWallet: string }>,
    attachmentProps: [] as Array<{ attachments: unknown[] }>,
    walletIdentity: {
      walletAddress: null as string | null,
      walletType: null as string | null,
    },
  }));

function queryKey(name: string, args: unknown): string {
  return args === "skip" ? `${name}:skip` : `${name}:${JSON.stringify(args)}`;
}

function setQueryResult(name: string, args: unknown, value: unknown): void {
  queryStates.set(queryKey(name, args), { kind: "result", value });
}

function setQueryError(name: string, args: unknown, error: Error): void {
  queryStates.set(queryKey(name, args), { kind: "error", error });
}

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
    const state = queryStates.get(queryKey(name, args));
    if (!state) return undefined;
    if (state.kind === "error") throw state.error;
    return state.value;
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
vi.mock("@/features/attachments/components", () => ({
  AttachmentList: (props: { attachments: unknown[] }) => {
    attachmentProps.push(props);
    return createElement("span", null, "Evidence mounted");
  },
}));
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
vi.mock("./dispute-participant-actions", () => ({
  DisputeParticipantActions: (props: { disputeId: string; viewerWallet: string }) => {
    actionProps.push(props);
    return createElement("span", null, "Actions mounted");
  },
}));
vi.mock("./dispute-timeline", () => ({
  ParticipantDisputeTimeline: (props: { disputeId: string; viewerWallet: string }) => {
    timelineProps.push(props);
    return createElement("span", null, "Timeline mounted");
  },
}));

import DisputesError from "@/app/disputes/error";

import { DISPUTE_ON_CHAIN_STATUS_LABELS, DISPUTE_STATUS_LABELS } from "../lib";
import { DisputeDetailPanel } from "./dispute-detail-panel";
import { DisputeList } from "./dispute-list";
import { DisputeOnChainStatusBadge, DisputeStatusBadge } from "./dispute-status-badge";

const REVIEW_STATUS_FIXTURES: ReadonlyArray<{
  status: TDisputeStatus;
  label: string;
}> = [
  { status: "open", label: DISPUTE_STATUS_LABELS.open },
  { status: "under_review", label: DISPUTE_STATUS_LABELS.under_review },
  {
    status: "awaiting_client_response",
    label: DISPUTE_STATUS_LABELS.awaiting_client_response,
  },
  {
    status: "awaiting_freelancer_response",
    label: DISPUTE_STATUS_LABELS.awaiting_freelancer_response,
  },
  { status: "resolved_client", label: DISPUTE_STATUS_LABELS.resolved_client },
  { status: "resolved_freelancer", label: DISPUTE_STATUS_LABELS.resolved_freelancer },
  { status: "split_resolution", label: DISPUTE_STATUS_LABELS.split_resolution },
  { status: "cancelled", label: DISPUTE_STATUS_LABELS.cancelled },
];

const MARKING_STATUS_FIXTURES: ReadonlyArray<{
  status: TDisputeOnChainStatus;
  label: string;
}> = [
  { status: "not_marked", label: DISPUTE_ON_CHAIN_STATUS_LABELS.not_marked },
  { status: "marking", label: DISPUTE_ON_CHAIN_STATUS_LABELS.marking },
  { status: "marked", label: DISPUTE_ON_CHAIN_STATUS_LABELS.marked },
  { status: "mark_failed", label: DISPUTE_ON_CHAIN_STATUS_LABELS.mark_failed },
];

const dispute = {
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
  attachments: [{ _id: "attachment-1", name: "proof.pdf", type: "pdf" }],
};

function detailArgs(disputeId: string, viewerWallet: string) {
  return { disputeId, viewerWallet };
}

function permissionArgs(disputeId: string, viewerWallet: string) {
  return { disputeId, viewerWallet };
}

function agreementArgs(disputeId: string, viewerWallet: string) {
  return { disputeId, viewerWallet };
}

function setPermittedDetail(
  disputeId: string,
  viewerWallet: string,
  value: unknown = { ...dispute, _id: disputeId },
): void {
  setQueryResult("permission", permissionArgs(disputeId, viewerWallet), {
    allowed: true,
    reason: null,
    role: viewerWallet === "GCLIENT" ? "client" : "freelancer",
  });
  setQueryResult("detail", detailArgs(disputeId, viewerWallet), value);
  setQueryResult("agreement", agreementArgs(disputeId, viewerWallet), null);
}

class TestRouteErrorBoundary extends Component<
  { readonly children: ReactNode },
  { hasError: boolean; retryKey: number }
> {
  state = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  private handleRetry = () => {
    this.setState(({ retryKey }) => ({ hasError: false, retryKey: retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return createElement(DisputesError, { reset: this.handleRetry });
    }

    return createElement("div", { key: this.state.retryKey }, this.props.children);
  }
}

describe("participant dispute route states", () => {
  afterEach(() => {
    cleanup();
    walletIdentity.walletAddress = null;
    walletIdentity.walletType = null;
    queryStates.clear();
    queryCalls.length = 0;
    timelineProps.length = 0;
    actionProps.length = 0;
    attachmentProps.length = 0;
    vi.restoreAllMocks();
  });

  it("skips wallet-scoped reads when disconnected", () => {
    render(createElement(DisputeList));
    expect(screen.getByText("Connect your wallet to view disputes.")).toBeTruthy();
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByText("Connect your wallet to view this dispute.")).toBeTruthy();
    expect(queryCalls.every((call) => call.args === "skip")).toBe(true);
  });

  it("distinguishes list loading and empty states", () => {
    walletIdentity.walletAddress = "GCLIENT";
    const view = render(createElement(DisputeList));
    expect(screen.getByRole("status").textContent).toContain("Loading disputes");
    setQueryResult("list", { walletAddress: "GCLIENT" }, []);
    view.rerender(createElement(DisputeList));
    expect(screen.getByText("No disputes found for this wallet.")).toBeTruthy();
  });

  it("shows only cases linked to the active wallet", () => {
    walletIdentity.walletAddress = "GCLIENT";
    setQueryResult("list", { walletAddress: "GCLIENT" }, [
      {
        ...dispute,
        title: "My dispute",
        clientWallet: "GCLIENT",
        freelancerWallet: "GFREELANCER",
      },
      {
        ...dispute,
        _id: "other",
        disputeNumber: "DSP-2",
        title: "Another wallet's dispute",
        clientWallet: "GOTHER",
        freelancerWallet: "GANOTHER",
      },
    ]);

    render(createElement(DisputeList));
    expect(screen.getByText("My dispute")).toBeTruthy();
    expect(screen.getByText("Your role: Client")).toBeTruthy();
    expect(screen.queryByText("Another wallet's dispute")).toBeNull();
    expect(queryCalls.at(-1)).toEqual({ name: "list", args: { walletAddress: "GCLIENT" } });
  });

  it("refreshes list content for a wallet change and clears it on disconnect", () => {
    walletIdentity.walletAddress = "GCLIENT";
    setQueryResult("list", { walletAddress: "GCLIENT" }, [
      { ...dispute, title: "Client wallet dispute" },
    ]);
    const view = render(createElement(DisputeList));
    expect(screen.getByText("Client wallet dispute")).toBeTruthy();

    walletIdentity.walletAddress = "GFREELANCER";
    view.rerender(createElement(DisputeList));
    expect(screen.queryByText("Client wallet dispute")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading disputes");
    expect(queryCalls.at(-1)).toEqual({
      name: "list",
      args: { walletAddress: "GFREELANCER" },
    });

    setQueryResult("list", { walletAddress: "GFREELANCER" }, [
      { ...dispute, title: "Freelancer wallet dispute", clientWallet: "GCLIENT" },
    ]);
    view.rerender(createElement(DisputeList));
    expect(screen.getByText("Freelancer wallet dispute")).toBeTruthy();
    expect(screen.queryByText("Client wallet dispute")).toBeNull();

    walletIdentity.walletAddress = null;
    view.rerender(createElement(DisputeList));
    expect(screen.getByText("Connect your wallet to view disputes.")).toBeTruthy();
    expect(screen.queryByText("Freelancer wallet dispute")).toBeNull();
    expect(queryCalls.at(-1)).toEqual({ name: "list", args: "skip" });
  });

  it("shows the real route fallback and recovers from a list read failure", () => {
    walletIdentity.walletAddress = "GCLIENT";
    const rawError = new Error("sensitive backend list details");
    setQueryError("list", { walletAddress: "GCLIENT" }, rawError);
    const view = render(createElement(TestRouteErrorBoundary, null, createElement(DisputeList)));

    expect(screen.getByRole("alert").textContent).toContain("Unable to load disputes");
    expect(screen.queryByText(rawError.message)).toBeNull();
    setQueryResult("list", { walletAddress: "GCLIENT" }, [
      { ...dispute, title: "Recovered list dispute" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Recovered list dispute")).toBeTruthy();
    expect(view.container.textContent).not.toContain(rawError.message);
  });

  it("shows the real route fallback and recovers from a permission read failure", () => {
    walletIdentity.walletAddress = "GCLIENT";
    const rawError = new Error("sensitive backend permission details");
    setQueryError("permission", permissionArgs("dispute-id", "GCLIENT"), rawError);
    const view = render(
      createElement(
        TestRouteErrorBoundary,
        null,
        createElement(DisputeDetailPanel, { disputeId: "dispute-id" }),
      ),
    );

    expect(screen.getByRole("alert").textContent).toContain("Unable to load disputes");
    expect(screen.queryByText(rawError.message)).toBeNull();
    setPermittedDetail("dispute-id", "GCLIENT");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("heading", { name: "Work quality dispute" })).toBeTruthy();
    expect(view.container.textContent).not.toContain(rawError.message);
  });

  it("shows the real route fallback and recovers from a detail read failure", () => {
    walletIdentity.walletAddress = "GCLIENT";
    setQueryResult("permission", permissionArgs("dispute-id", "GCLIENT"), {
      allowed: true,
      reason: null,
      role: "client",
    });
    const rawError = new Error("sensitive backend detail details");
    setQueryError("detail", detailArgs("dispute-id", "GCLIENT"), rawError);
    const view = render(
      createElement(
        TestRouteErrorBoundary,
        null,
        createElement(DisputeDetailPanel, { disputeId: "dispute-id" }),
      ),
    );

    expect(screen.getByRole("alert").textContent).toContain("Unable to load disputes");
    expect(screen.queryByText(rawError.message)).toBeNull();
    setQueryResult("detail", detailArgs("dispute-id", "GCLIENT"), dispute);
    setQueryResult("agreement", agreementArgs("dispute-id", "GCLIENT"), null);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("heading", { name: "Work quality dispute" })).toBeTruthy();
    expect(view.container.textContent).not.toContain(rawError.message);
  });

  it("shows the real route fallback and recovers from an agreement read failure", () => {
    walletIdentity.walletAddress = "GCLIENT";
    setQueryResult("permission", permissionArgs("dispute-id", "GCLIENT"), {
      allowed: true,
      reason: null,
      role: "client",
    });
    setQueryResult("detail", detailArgs("dispute-id", "GCLIENT"), dispute);
    const rawError = new Error("sensitive backend agreement details");
    setQueryError("agreement", agreementArgs("dispute-id", "GCLIENT"), rawError);
    const view = render(
      createElement(
        TestRouteErrorBoundary,
        null,
        createElement(DisputeDetailPanel, { disputeId: "dispute-id" }),
      ),
    );

    expect(screen.getByRole("alert").textContent).toContain("Unable to load disputes");
    expect(screen.queryByText(rawError.message)).toBeNull();
    setQueryResult("agreement", agreementArgs("dispute-id", "GCLIENT"), null);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("heading", { name: "Work quality dispute" })).toBeTruthy();
    expect(view.container.textContent).not.toContain(rawError.message);
  });

  it("keeps detail-dependent reads and participant content behind permission", () => {
    walletIdentity.walletAddress = "GCLIENT";
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("status").textContent).toContain("Loading dispute");
    expect(queryCalls.filter((call) => call.name === "detail").at(-1)?.args).toBe("skip");
    expect(queryCalls.filter((call) => call.name === "agreement").at(-1)?.args).toBe("skip");
    expect(screen.queryByText("Evidence mounted")).toBeNull();
    expect(screen.queryByText("Actions mounted")).toBeNull();
    expect(screen.queryByText("Timeline mounted")).toBeNull();

    setQueryResult("permission", permissionArgs("dispute-id", "GCLIENT"), {
      allowed: true,
      reason: null,
      role: "client",
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("status").textContent).toContain("Loading dispute");
    expect(screen.queryByText("Evidence mounted")).toBeNull();
    expect(screen.queryByText("Actions mounted")).toBeNull();
    expect(screen.queryByText("Timeline mounted")).toBeNull();

    setQueryResult("detail", detailArgs("dispute-id", "GCLIENT"), null);
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("alert").textContent).toContain("Dispute not found");
    expect(screen.queryByText("Evidence mounted")).toBeNull();
    expect(screen.queryByText("Actions mounted")).toBeNull();
    expect(screen.queryByText("Timeline mounted")).toBeNull();

    setPermittedDetail("dispute-id", "GCLIENT");
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("heading", { name: "Work quality dispute" })).toBeTruthy();
    expect(screen.getByText("Evidence mounted")).toBeTruthy();
    expect(screen.getByText("Actions mounted")).toBeTruthy();
    expect(screen.getByText("Timeline mounted")).toBeTruthy();

    setQueryResult("permission", permissionArgs("dispute-id", "GCLIENT"), {
      allowed: false,
      reason: "Only participants may view this case.",
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("alert").textContent).toContain("do not have access");
    expect(screen.queryByText("Work quality dispute")).toBeNull();
    expect(screen.queryByText("Evidence mounted")).toBeNull();
    expect(screen.queryByText("Actions mounted")).toBeNull();
    expect(screen.queryByText("Timeline mounted")).toBeNull();
    expect(queryCalls.filter((call) => call.name === "detail").at(-1)?.args).toBe("skip");
    expect(queryCalls.filter((call) => call.name === "agreement").at(-1)?.args).toBe("skip");
  });

  it("refreshes loaded detail reads for wallet changes and clears them on disconnect", () => {
    walletIdentity.walletAddress = "GCLIENT";
    setPermittedDetail("dispute-id", "GCLIENT", {
      ...dispute,
      title: "Client view",
    });
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("heading", { name: "Client view" })).toBeTruthy();
    expect(timelineProps.at(-1)).toEqual({
      disputeId: "dispute-id",
      viewerWallet: "GCLIENT",
    });

    walletIdentity.walletAddress = "GFREELANCER";
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("status").textContent).toContain("Loading dispute");
    expect(screen.queryByText("Client view")).toBeNull();
    expect(screen.queryByText("Evidence mounted")).toBeNull();
    expect(screen.queryByText("Actions mounted")).toBeNull();
    expect(screen.queryByText("Timeline mounted")).toBeNull();
    expect(queryCalls.filter((call) => call.name === "permission").at(-1)).toEqual({
      name: "permission",
      args: permissionArgs("dispute-id", "GFREELANCER"),
    });
    expect(queryCalls.filter((call) => call.name === "detail").at(-1)?.args).toBe("skip");
    expect(queryCalls.filter((call) => call.name === "agreement").at(-1)?.args).toBe("skip");

    setPermittedDetail("dispute-id", "GFREELANCER", {
      ...dispute,
      title: "Freelancer view",
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByRole("heading", { name: "Freelancer view" })).toBeTruthy();
    expect(screen.getByText("Evidence mounted")).toBeTruthy();
    expect(screen.getByText("Actions mounted")).toBeTruthy();
    expect(screen.getByText("Timeline mounted")).toBeTruthy();
    expect(actionProps.at(-1)).toEqual({
      disputeId: "dispute-id",
      viewerWallet: "GFREELANCER",
    });
    expect(timelineProps.at(-1)).toEqual({
      disputeId: "dispute-id",
      viewerWallet: "GFREELANCER",
    });

    walletIdentity.walletAddress = null;
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-id" }));
    expect(screen.getByText("Connect your wallet to view this dispute.")).toBeTruthy();
    expect(screen.queryByText("Freelancer view")).toBeNull();
    expect(screen.queryByText("Evidence mounted")).toBeNull();
    expect(screen.queryByText("Actions mounted")).toBeNull();
    expect(screen.queryByText("Timeline mounted")).toBeNull();
    expect(queryCalls.filter((call) => call.name === "permission").at(-1)?.args).toBe("skip");
    expect(queryCalls.filter((call) => call.name === "detail").at(-1)?.args).toBe("skip");
    expect(queryCalls.filter((call) => call.name === "agreement").at(-1)?.args).toBe("skip");
  });

  it("navigates between dispute IDs without retaining the previous case", () => {
    walletIdentity.walletAddress = "GCLIENT";
    setPermittedDetail("first-dispute", "GCLIENT", {
      ...dispute,
      _id: "first-dispute",
      title: "First dispute",
    });
    const view = render(createElement(DisputeDetailPanel, { disputeId: "first-dispute" }));
    expect(screen.getByRole("heading", { name: "First dispute" })).toBeTruthy();
    expect(screen.getByText("Evidence mounted")).toBeTruthy();
    expect(screen.getByText("Actions mounted")).toBeTruthy();
    expect(screen.getByText("Timeline mounted")).toBeTruthy();

    view.rerender(createElement(DisputeDetailPanel, { disputeId: "second-dispute" }));
    expect(screen.getByRole("status").textContent).toContain("Loading dispute");
    expect(screen.queryByText("First dispute")).toBeNull();
    expect(screen.queryByText("Evidence mounted")).toBeNull();
    expect(screen.queryByText("Actions mounted")).toBeNull();
    expect(screen.queryByText("Timeline mounted")).toBeNull();
    expect(queryCalls.filter((call) => call.name === "detail").at(-1)?.args).toBe("skip");

    setPermittedDetail("second-dispute", "GCLIENT", {
      ...dispute,
      _id: "second-dispute",
      title: "Second dispute",
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "second-dispute" }));
    expect(screen.getByRole("heading", { name: "Second dispute" })).toBeTruthy();
    expect(screen.queryByText("First dispute")).toBeNull();
    expect(screen.getByText("Evidence mounted")).toBeTruthy();
    expect(screen.getByText("Actions mounted")).toBeTruthy();
    expect(screen.getByText("Timeline mounted")).toBeTruthy();
    expect(queryCalls.filter((call) => call.name === "permission").at(-1)).toEqual({
      name: "permission",
      args: permissionArgs("second-dispute", "GCLIENT"),
    });
    expect(queryCalls.filter((call) => call.name === "detail").at(-1)).toEqual({
      name: "detail",
      args: detailArgs("second-dispute", "GCLIENT"),
    });
    expect(actionProps.at(-1)).toEqual({
      disputeId: "second-dispute",
      viewerWallet: "GCLIENT",
    });
    expect(timelineProps.at(-1)).toEqual({
      disputeId: "second-dispute",
      viewerWallet: "GCLIENT",
    });
  });

  it("renders every review status and marking phase with separate labels", () => {
    render(
      createElement(
        "div",
        null,
        REVIEW_STATUS_FIXTURES.map(({ status }) =>
          createElement(DisputeStatusBadge, { key: status, status }),
        ),
      ),
    );
    for (const fixture of REVIEW_STATUS_FIXTURES) {
      expect(screen.getByText(fixture.label)).toBeTruthy();
    }

    cleanup();
    render(
      createElement(
        "div",
        null,
        MARKING_STATUS_FIXTURES.map(({ status }) =>
          createElement(DisputeOnChainStatusBadge, { key: status, status }),
        ),
      ),
    );
    for (const fixture of MARKING_STATUS_FIXTURES) {
      expect(screen.getByText(`Chain: ${fixture.label}`)).toBeTruthy();
    }

    expect(screen.queryByText("Open")).toBeNull();
  });
});
