// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { wallet, results, calls, mutations } = vi.hoisted(() => ({
  wallet: { walletAddress: "GCLIENT", walletType: "external_wallet" },
  results: {} as Record<string, unknown>,
  calls: [] as Array<{ name: string; args: unknown }>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

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
    return args === "skip" ? undefined : results[name];
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
vi.mock("@/core/stellar/escrow-contract", () => ({ markDisputedOnChain: vi.fn() }));
vi.mock("@/core/stellar/explorer", () => ({ getTxExplorerUrl: () => "https://example.test/tx" }));
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
  }: {
    onChange: (update: (current: unknown[]) => unknown[]) => void;
    ownerRole: string;
  }) =>
    createElement(
      "button",
      {
        type: "button",
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
  _id: "dispute-1",
  disputeNumber: "DSP-1",
  title: "Payment dispute",
  description: "Payment is pending.",
  reasonCategory: "payment_release_disagreement",
  status: "open",
  onChainStatus: "marked",
  openedAt: 1,
  clientWallet: "GCLIENT",
  freelancerWallet: "GFREELANCER",
  attachments: [{ _id: "initial-evidence", name: "initial.pdf", type: "pdf" }],
};

describe("C24 participant detail integration and accessibility", () => {
  beforeEach(() => {
    wallet.walletAddress = "GCLIENT";
    wallet.walletType = "external_wallet";
    results.canView = { allowed: true, role: "client" };
    results.detail = dispute;
    results.agreement = null;
    results.canRespond = { allowed: true, role: "client" };
    results.timeline = [
      {
        _id: "event-1",
        type: "dispute_opened",
        actorRole: "client",
        actorWallet: "GCLIENT",
        message: "Dispute opened.",
        createdAt: 1,
        attachmentIds: [],
        attachments: [],
      },
    ];
    calls.length = 0;
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
  afterEach(cleanup);

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
    results.canRespond = { allowed: false, role: null, reason: "This dispute is closed." };
    render(createElement(DisputeDetailPanel, { disputeId: "dispute-1" }));
    expect(screen.getByText("This dispute is closed.")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Response" })).toBeNull();
    expect(screen.getByRole("list", { name: "Dispute evidence timeline" })).toBeTruthy();
  });
});
