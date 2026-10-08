// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  TParticipantDisputeQueryResult,
  TParticipantDisputeTimelineQueryResult,
  TParticipantDisputePermissionQueryResult,
  TParticipantDisputeResponsePermissionQueryResult,
  TParticipantAgreementContextQueryResult,
} from "../types";
import type { TConvexId } from "@repo/convex-client";

type TQueryResults = {
  canView: TParticipantDisputePermissionQueryResult;
  detail: TParticipantDisputeQueryResult;
  canRespond: TParticipantDisputeResponsePermissionQueryResult;
  timeline: TParticipantDisputeTimelineQueryResult;
  agreement: TParticipantAgreementContextQueryResult;
};

type TQueryState = { kind: "result"; value: unknown } | { kind: "error"; error: Error };

const { wallet, queryFixtures, calls, mutations, stellarOperations } = vi.hoisted(() => ({
  wallet: {
    walletAddress: "GCLIENT" as string | null,
    walletType: "external_wallet" as string | null,
  },
  queryFixtures: new Map<string, TQueryState>(),
  calls: [] as Array<{ name: string; args: unknown }>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  stellarOperations: [] as unknown[][],
}));

function queryKey(name: string, args: unknown): string {
  return `${name}:${JSON.stringify(args)}`;
}

function setQueryResult<TName extends keyof TQueryResults>(
  name: TName,
  args: unknown,
  value: TQueryResults[TName],
): void {
  queryFixtures.set(queryKey(name, args), { kind: "result", value });
}

function setQueryError(name: string, args: unknown, error: Error): void {
  queryFixtures.set(queryKey(name, args), { kind: "error", error });
}

function permissionArgs(disputeId: string, viewerWallet: string) {
  return { disputeId, viewerWallet };
}

function detailArgs(disputeId: string, viewerWallet: string) {
  return { disputeId, viewerWallet };
}

function agreementArgs(disputeId: string, viewerWallet: string) {
  return { disputeId, viewerWallet };
}

function responsePermissionArgs(disputeId: string, walletAddress: string) {
  return { disputeId, walletAddress };
}

function timelineArgs(disputeId: string, viewerWallet: string) {
  return { disputeId, viewerWallet };
}

function timelineEvent(
  message: string,
  actorWallet = "GCLIENT",
): TParticipantDisputeTimelineQueryResult[number] {
  return {
    _id: `event-${message}` as TConvexId<"disputeEvents">,
    _creationTime: 1,
    disputeId: "dispute-1" as TConvexId<"disputes">,
    type: "dispute_opened",
    actorRole: actorWallet === "GFREELANCER" ? "freelancer" : "client",
    actorWallet,
    actorWalletType: "external_wallet",
    message,
    createdAt: 1,
    attachmentIds: [],
    attachments: [],
  };
}

vi.mock("@repo/convex-client", () => ({
  api: {
    disputes: {
      canViewDispute: "canView",
      getDispute: "detail",
      canRespondToDispute: "canRespond",
      getDisputeTimeline: "timeline",
      addDisputeEvidence: "evidence",
      addDisputeResponse: "response",
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
  useQuery: (name: string, args: unknown) => {
    calls.push({ name, args });
    const state = queryFixtures.get(queryKey(name, args));
    if (!state) return undefined;
    if (state.kind === "error") throw state.error;
    return state.value;
  },
  useMutation: (name: string) => mutations[name],
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => wallet,
}));
vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({
    address: wallet.walletAddress,
    walletState: { isConnected: true },
    signTransaction: vi.fn(),
  }),
}));
vi.mock("@/core/wallet/config", () => ({
  isWalletOnConfiguredNetwork: () => true,
  getWalletNetworkMismatchMessage: () => "Wrong network.",
}));
vi.mock("@/core/config/stellar-contracts", () => ({ getRequiredEscrowActionConfig: vi.fn() }));
vi.mock("@/core/stellar/escrow-contract", () => ({
  markDisputedOnChain: (...args: unknown[]) => {
    stellarOperations.push(args);
    return Promise.resolve({ txHash: "tx-created-by-test" });
  },
}));
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
vi.mock("@/features/attachments/components", () => ({
  AttachmentList: ({ attachments }: { attachments: unknown[] }) =>
    createElement("span", null, `${attachments.length} linked attachments`),
  AttachmentUploader: ({
    onChange,
    ownerRole,
    value,
    disabled,
  }: {
    onChange: (update: (current: unknown[]) => unknown[]) => void;
    ownerRole: string;
    value: unknown[];
    disabled?: boolean;
  }) =>
    createElement(
      "div",
      null,
      createElement(
        "button",
        {
          type: "button",
          disabled,
          onClick: () =>
            onChange((current) => [
              ...current,
              {
                id: `attachment-${current.length + 1}`,
                name: "proof.pdf",
                type: "pdf",
                status: "ready",
              },
            ]),
        },
        `Attach as ${ownerRole}`,
      ),
      createElement("span", null, `${ownerRole} attachments: ${value.length}`),
    ),
}));
vi.mock("@/features/attachments/lib", () => ({
  getReadableAttachmentError: (error: Error) => error.message,
}));
vi.mock("@/features/common", () => ({ showWarningToast: vi.fn() }));
vi.mock("@/features/work-agreements/components", () => ({ AgreementReferenceCard: () => null }));
vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) =>
    asChild ? children : createElement("button", props, children),
}));
vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => createElement("textarea", props),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import { DisputeDetailPanel } from "./dispute-detail-panel";

const dispute = {
  _id: "dispute-1" as TConvexId<"disputes">,
  _creationTime: 1,
  parentType: "micro_gig",
  parentId: "job-1",
  openedByWallet: "GCLIENT",
  openedByWalletType: "external_wallet",
  openedByRole: "client",
  evidenceAttachmentIds: [],
  relatedWorkSubmissionIds: [],
  relatedRevisionRequestIds: [],
  createdAt: 1,
  updatedAt: 1,
  disputeNumber: "DSP-1",
  title: "Payment dispute",
  description: "Payment is pending.",
  reasonCategory: "payment_release_disagreement",
  status: "open",
  onChainStatus: "marked",
  openedAt: 1,
  clientWallet: "GCLIENT",
  freelancerWallet: "GFREELANCER",
  attachments: [],
} satisfies NonNullable<TParticipantDisputeQueryResult>;

function setParticipantCase(
  disputeId = "dispute-1",
  viewerWallet = "GCLIENT",
  options: {
    title?: string;
    role?: "client" | "freelancer";
    timeline?: TParticipantDisputeTimelineQueryResult;
  } = {},
): void {
  const role = options.role ?? (viewerWallet === "GFREELANCER" ? "freelancer" : "client");
  setQueryResult("canView", permissionArgs(disputeId, viewerWallet), {
    allowed: true,
    reason: null,
    role,
  });
  setQueryResult("detail", detailArgs(disputeId, viewerWallet), {
    ...dispute,
    _id: disputeId as TConvexId<"disputes">,
    title: options.title ?? dispute.title,
  });
  setQueryResult("agreement", agreementArgs(disputeId, viewerWallet), null);
  setQueryResult("canRespond", responsePermissionArgs(disputeId, viewerWallet), {
    allowed: true,
    role,
    reason: null,
  });
  setQueryResult(
    "timeline",
    timelineArgs(disputeId, viewerWallet),
    options.timeline ?? [timelineEvent("Dispute opened.", viewerWallet)],
  );
}

describe("participant detail integration and accessibility", () => {
  beforeEach(() => {
    wallet.walletAddress = "GCLIENT";
    wallet.walletType = "external_wallet";
    queryFixtures.clear();
    setParticipantCase();
    calls.length = 0;
    stellarOperations.length = 0;
    mutations.evidence = vi.fn().mockResolvedValue(true);
    mutations.response = vi.fn().mockResolvedValue(true);
    for (const name of [
      "markStarted",
      "markSucceeded",
      "markFailed",
      "updateEscrow",
      "updateMilestone",
      "createTransaction",
      "updateTransaction",
    ]) {
      mutations[name] = vi.fn().mockResolvedValue(true);
    }
  });
  afterEach(() => {
    cleanup();
    queryFixtures.clear();
  });

  it("keeps detail, actions, and timeline scoped to the viewer and exposes labeled controls", () => {
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByRole("heading", { name: "Payment dispute" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Note (optional)" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Response" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Dispute evidence timeline" })).toBeTruthy();
    expect(screen.getByText("Dispute opened.")).toBeTruthy();
    for (const name of ["canView", "detail", "canRespond", "timeline"]) {
      expect(calls.find((call) => call.name === name)?.args).toEqual(
        name === "canRespond"
          ? { disputeId: "dispute-1", walletAddress: "GCLIENT" }
          : { disputeId: "dispute-1", viewerWallet: "GCLIENT" },
      );
    }
  });

  it("submits evidence and response through their forms and links validation errors to fields", async () => {
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    const note = screen.getByRole("textbox", { name: "Note (optional)" });
    const response = screen.getByRole("textbox", { name: "Response" });
    const evidenceForm = note.closest("form")!;
    const responseForm = response.closest("form")!;

    fireEvent.submit(evidenceForm);
    expect(within(evidenceForm).getByRole("alert").textContent).toContain(
      "Add at least one evidence",
    );
    expect(evidenceForm.getAttribute("aria-describedby")).toBe(
      within(evidenceForm).getByRole("alert").id,
    );
    fireEvent.click(within(evidenceForm).getByRole("button", { name: "Attach as client" }));
    fireEvent.change(note, { target: { value: "  Delivery proof.  " } });
    fireEvent.submit(evidenceForm);
    await waitFor(() =>
      expect(mutations.evidence).toHaveBeenCalledWith({
        disputeId: "dispute-1",
        actorWallet: "GCLIENT",
        actorWalletType: "external_wallet",
        attachmentIds: ["attachment-1"],
        message: "Delivery proof.",
      }),
    );

    fireEvent.submit(responseForm);
    expect(within(responseForm).getByRole("alert").textContent).toContain("Enter a response");
    expect(response.getAttribute("aria-invalid")).toBe("true");
    expect(response.getAttribute("aria-describedby")).toBe(
      within(responseForm).getByRole("alert").id,
    );
    fireEvent.change(response, { target: { value: "  Please review the invoice.  " } });
    fireEvent.submit(responseForm);
    await waitFor(() =>
      expect(mutations.response).toHaveBeenCalledWith({
        disputeId: "dispute-1",
        responderWallet: "GCLIENT",
        responderWalletType: "external_wallet",
        attachmentIds: [],
        message: "Please review the invoice.",
      }),
    );
  });

  it("hides both action forms when the case stops accepting participant submissions", () => {
    setQueryResult("canRespond", responsePermissionArgs("dispute-1", "GCLIENT"), {
      allowed: false,
      role: null,
      reason: "This dispute is closed.",
    });
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText("This dispute is closed.")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Response" })).toBeNull();
    expect(screen.getByRole("list", { name: "Dispute evidence timeline" })).toBeTruthy();
  });

  it("keeps detail and participant drafts intact while the real timeline is loading", () => {
    queryFixtures.delete(queryKey("timeline", timelineArgs("dispute-1", "GCLIENT")));
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));

    expect(screen.getByRole("heading", { name: "Payment dispute" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Loading timeline");

    const note = screen.getByRole("textbox", { name: "Note (optional)" });
    const response = screen.getByRole("textbox", { name: "Response" });
    const attachButton = screen.getAllByRole("button", { name: "Attach as client" })[0];
    if (!attachButton) throw new Error("Expected the evidence attachment button.");
    fireEvent.click(attachButton);
    fireEvent.change(note, { target: { value: "Loading evidence draft." } });
    fireEvent.change(response, { target: { value: "Loading response draft." } });

    setQueryResult("timeline", timelineArgs("dispute-1", "GCLIENT"), [
      timelineEvent("Loaded timeline event."),
    ]);
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));

    expect(screen.getByRole("heading", { name: "Payment dispute" })).toBeTruthy();
    expect(screen.getByText("Loaded timeline event.")).toBeTruthy();
    expect((note as HTMLTextAreaElement).value).toBe("Loading evidence draft.");
    expect((response as HTMLTextAreaElement).value).toBe("Loading response draft.");
    expect(screen.getByText("client attachments: 1")).toBeTruthy();
    expect(Object.values(mutations).every((mutation) => mutation.mock.calls.length === 0)).toBe(
      true,
    );
    expect(stellarOperations).toHaveLength(0);
  });

  it("isolates timeline failure, preserves participant drafts, and retries without writes", () => {
    const rawError = new Error("sensitive timeline backend details");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setQueryError("timeline", timelineArgs("dispute-1", "GCLIENT"), rawError);
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));

    expect(screen.getByRole("heading", { name: "Payment dispute" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the dispute timeline");
    expect(screen.queryByText(rawError.message)).toBeNull();

    const note = screen.getByRole("textbox", { name: "Note (optional)" });
    const response = screen.getByRole("textbox", { name: "Response" });
    const attachButton = screen.getAllByRole("button", { name: "Attach as client" })[0];
    if (!attachButton) throw new Error("Expected the evidence attachment button.");
    fireEvent.click(attachButton);
    fireEvent.change(note, { target: { value: "Evidence draft retained." } });
    fireEvent.change(response, { target: { value: "Response draft retained." } });
    expect(screen.getByText("client attachments: 1")).toBeTruthy();

    setQueryResult("timeline", timelineArgs("dispute-1", "GCLIENT"), [
      timelineEvent("Recovered timeline event."),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Retry timeline" }));

    expect(screen.getByText("Recovered timeline event.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect((note as HTMLTextAreaElement).value).toBe("Evidence draft retained.");
    expect((response as HTMLTextAreaElement).value).toBe("Response draft retained.");
    expect(screen.getByText("client attachments: 1")).toBeTruthy();
    expect(screen.queryByText(rawError.message)).toBeNull();
    expect(Object.values(mutations).every((mutation) => mutation.mock.calls.length === 0)).toBe(
      true,
    );
    expect(stellarOperations).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it("removes the real timeline on revocation and disconnect, then restores the current participant and case", () => {
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText("Dispute opened.")).toBeTruthy();

    setQueryResult("canView", permissionArgs("dispute-1", "GCLIENT"), {
      allowed: false,
      role: null,
      reason: "Only participants may view this case.",
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByRole("alert").textContent).toContain("do not have access");
    expect(screen.queryByRole("list", { name: "Dispute evidence timeline" })).toBeNull();
    expect(screen.queryByText("Dispute opened.")).toBeNull();

    wallet.walletAddress = null;
    wallet.walletType = null;
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText("Connect your wallet to view this dispute.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Dispute evidence timeline" })).toBeNull();

    wallet.walletAddress = "GFREELANCER";
    wallet.walletType = "external_wallet";
    setParticipantCase("dispute-2", "GFREELANCER", {
      title: "Freelancer dispute",
      role: "freelancer",
      timeline: [timelineEvent("Current freelancer timeline event.", "GFREELANCER")],
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-2" }));

    expect(screen.getByRole("heading", { name: "Freelancer dispute" })).toBeTruthy();
    expect(screen.getByText("Current freelancer timeline event.")).toBeTruthy();
    expect(calls.filter((call) => call.name === "canView").at(-1)).toEqual({
      name: "canView",
      args: { disputeId: "dispute-2", viewerWallet: "GFREELANCER" },
    });
    expect(calls.filter((call) => call.name === "detail").at(-1)).toEqual({
      name: "detail",
      args: { disputeId: "dispute-2", viewerWallet: "GFREELANCER" },
    });
    expect(calls.filter((call) => call.name === "timeline").at(-1)).toEqual({
      name: "timeline",
      args: { disputeId: "dispute-2", viewerWallet: "GFREELANCER" },
    });
  });

  it("D2 C22 discards a revoked case session and ignores its late write after access returns", async () => {
    let resolveResponse!: (value: boolean) => void;
    mutations.response!.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    fireEvent.change(screen.getByLabelText("Response"), {
      target: { value: "Old submitted response" },
    });
    fireEvent.submit(screen.getByLabelText("Response").closest("form")!);
    expect(mutations.response).toHaveBeenCalledTimes(1);

    setQueryResult("canView", permissionArgs("dispute-1", "GCLIENT"), {
      allowed: false,
      role: null,
      reason: "Revoked",
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.queryByRole("heading", { name: "Payment dispute" })).toBeNull();
    expect(screen.queryByLabelText("Response")).toBeNull();
    expect(screen.queryByRole("list", { name: "Dispute evidence timeline" })).toBeNull();
    expect(calls.filter((call) => call.name === "detail").at(-1)?.args).toBe("skip");

    setParticipantCase();
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    const response = screen.getByLabelText<HTMLTextAreaElement>("Response");
    expect(response.value).toBe("");
    fireEvent.change(response, { target: { value: "New authorized draft" } });
    await act(async () => {
      resolveResponse(true);
    });
    expect(response.value).toBe("New authorized draft");
    expect(mutations.response).toHaveBeenCalledTimes(1);
    expect(mutations.evidence).not.toHaveBeenCalled();
    expect(stellarOperations).toHaveLength(0);
  });

  it("D2 C22 isolates current wallet reads and drafts from stale case results and rejected writes", async () => {
    let rejectResponse!: (reason: Error) => void;
    mutations.response!.mockReturnValueOnce(
      new Promise<boolean>((_, reject) => {
        rejectResponse = reject;
      }),
    );
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "Client response" } });
    fireEvent.submit(screen.getByLabelText("Response").closest("form")!);

    wallet.walletAddress = "GFREELANCER";
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-2" }));
    expect(screen.queryByRole("heading", { name: "Payment dispute" })).toBeNull();
    expect(screen.queryByLabelText("Response")).toBeNull();
    expect(screen.queryByText("Dispute opened.")).toBeNull();
    expect(calls.filter((call) => call.name === "detail").at(-1)?.args).toBe("skip");

    setParticipantCase("dispute-2", "GFREELANCER", {
      title: "New participant case",
      timeline: [timelineEvent("New case event", "GFREELANCER")],
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-2" }));
    const response = screen.getByLabelText<HTMLTextAreaElement>("Response");
    fireEvent.change(response, { target: { value: "Freelancer draft" } });
    setQueryResult("timeline", timelineArgs("dispute-1", "GCLIENT"), [
      timelineEvent("Late private client event"),
    ]);
    await act(async () => {
      rejectResponse(new Error("Old client write rejected"));
    });
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-2" }));
    expect(response.value).toBe("Freelancer draft");
    expect(screen.getByText("New case event")).toBeTruthy();
    expect(screen.queryByText("Late private client event")).toBeNull();
    expect(screen.queryByText("Old client write rejected")).toBeNull();
    expect(mutations.response).toHaveBeenCalledTimes(1);
    expect(stellarOperations).toHaveLength(0);
  });

  it("D2 C22 keeps form errors, focus, attachment controls and pending writes independent during timeline recovery", async () => {
    let resolveEvidence!: (value: boolean) => void;
    mutations.evidence!.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveEvidence = resolve;
      }),
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
      const note = screen.getByLabelText<HTMLTextAreaElement>("Note (optional)");
      const response = screen.getByLabelText<HTMLTextAreaElement>("Response");
      const evidenceForm = note.closest("form")!;
      const responseForm = response.closest("form")!;
      fireEvent.submit(evidenceForm);
      fireEvent.submit(responseForm);
      const evidenceError = within(evidenceForm).getByRole("alert");
      const responseError = within(responseForm).getByRole("alert");
      expect(evidenceError.id).not.toBe(responseError.id);
      expect(evidenceForm.getAttribute("aria-describedby")).toBe(evidenceError.id);
      expect(response.getAttribute("aria-describedby")).toBe(responseError.id);
      expect(
        within(evidenceForm).getByRole("button", { name: "Add Evidence" }).getAttribute("type"),
      ).toBe("submit");
      expect(
        within(responseForm).getByRole("button", { name: "Add Response" }).getAttribute("type"),
      ).toBe("submit");

      fireEvent.click(within(evidenceForm).getByRole("button", { name: "Attach as client" }));
      fireEvent.change(note, { target: { value: "Pending evidence" } });
      fireEvent.submit(evidenceForm);
      fireEvent.submit(evidenceForm);
      expect(mutations.evidence).toHaveBeenCalledTimes(1);
      expect(
        within(evidenceForm).getByRole<HTMLButtonElement>("button", { name: "Attach as client" })
          .disabled,
      ).toBe(true);
      expect(
        within(responseForm).getByRole<HTMLButtonElement>("button", { name: "Attach as client" })
          .disabled,
      ).toBe(false);
      fireEvent.click(within(responseForm).getByRole("button", { name: "Attach as client" }));
      fireEvent.change(response, { target: { value: "Independent response draft" } });
      response.focus();
      expect(document.activeElement).toBe(response);

      setQueryError(
        "timeline",
        timelineArgs("dispute-1", "GCLIENT"),
        new Error("Timeline offline"),
      );
      view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
      expect(document.activeElement).toBe(response);
      setQueryResult("timeline", timelineArgs("dispute-1", "GCLIENT"), [
        timelineEvent("Recovered during evidence write"),
      ]);
      fireEvent.click(screen.getByRole("button", { name: "Retry timeline" }));
      expect(response.value).toBe("Independent response draft");
      expect(within(responseForm).getByText("client attachments: 1")).toBeTruthy();
      fireEvent.submit(evidenceForm);
      expect(mutations.evidence).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolveEvidence(true);
      });
      expect(note.value).toBe("");
      expect(response.value).toBe("Independent response draft");
      expect(within(responseForm).getByText("client attachments: 1")).toBeTruthy();
      expect(mutations.response).not.toHaveBeenCalled();
      expect(stellarOperations).toHaveLength(0);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("D2 C22 refreshes a saved-hash marking result without resubmission or disturbing participant drafts", () => {
    const hash = "b".repeat(64);
    const savedCase = {
      ...dispute,
      onChainStatus: "mark_failed" as const,
      onChainEscrowId: "chain-1",
      transactionHash: hash,
      stellarExpertUrl: "https://untrusted.test/stale",
    };
    setQueryResult("detail", detailArgs("dispute-1", "GCLIENT"), savedCase);
    const view = render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    const response = screen.getByLabelText<HTMLTextAreaElement>("Response");
    fireEvent.change(response, { target: { value: "Draft while reconciliation is pending" } });
    expect(screen.getByText(/Reconcile its outcome before retrying/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry escrow marking" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "View transaction on Stellar Expert" }).getAttribute("href"),
    ).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);

    setQueryResult("detail", detailArgs("dispute-1", "GCLIENT"), {
      ...savedCase,
      onChainStatus: "marked",
    });
    setQueryResult("timeline", timelineArgs("dispute-1", "GCLIENT"), [
      {
        ...timelineEvent("Escrow marking reconciled"),
        type: "on_chain_mark_succeeded",
        transactionHash: hash,
      },
    ]);
    view.rerender(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText("Escrow dispute marking is confirmed on Stellar.")).toBeTruthy();
    expect(screen.getByText("Escrow marking reconciled")).toBeTruthy();
    expect(response.value).toBe("Draft while reconciliation is pending");
    expect(screen.queryByRole("button", { name: "Retry escrow marking" })).toBeNull();
    expect(Object.values(mutations).every((mutation) => mutation.mock.calls.length === 0)).toBe(
      true,
    );
    expect(stellarOperations).toHaveLength(0);
  });
});
