// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TConvexDoc } from "@repo/convex-client";

const { queryResults, mutations, markOnChain, onOpenChange } = vi.hoisted(() => ({
  queryResults: {} as Record<string, unknown>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  markOnChain: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    disputes: {
      canOpenDispute: "eligibility",
      createDispute: "createDispute",
      markDisputeOnChainStarted: "markStarted",
      markDisputeOnChainSucceeded: "markSucceeded",
      markDisputeOnChainFailed: "markFailed",
    },
    work_submissions: { getLatestSubmissionForEscrow: "latestSubmission" },
    revisions: { getRevisionRequestsByParent: "revisions" },
    escrows: { updateEscrowStatus: "updateEscrow" },
    milestones: { updateMilestoneEscrowStatus: "updateMilestone" },
    transactions: {
      createTransaction: "createTransaction",
      updateTransactionStatus: "updateTransaction",
    },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => (args === "skip" ? undefined : queryResults[name]),
  useMutation: (name: string) => mutations[name],
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({
    walletAddress: "GCLIENT",
    walletType: "external_wallet",
    isConnected: true,
  }),
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
    escrowContractId: "contract-1",
    rpcUrl: "https://example.test",
    networkPassphrase: "testnet",
  }),
}));
vi.mock("@/core/stellar/escrow-contract", () => ({ markDisputedOnChain: markOnChain }));
vi.mock("@/core/stellar/explorer", () => ({ getTxExplorerUrl: () => "https://example.test/tx" }));
vi.mock("@/core/stellar/passkeySmartAccountExecutor", () => ({
  getPasskeyEscrowExecutionReadiness: vi.fn(),
}));
vi.mock("@/core/stellar/transaction", () => ({
  isPendingStellarTransactionError: () => false,
  normalizeStellarError: (error: Error) => error.message,
}));
vi.mock("@/features/attachments/components", () => ({ AttachmentUploader: () => null }));
vi.mock("@/features/attachments/lib", () => ({
  getReadableAttachmentError: (error: Error) => error.message,
}));
vi.mock("@/features/common", () => ({ showWarningToast: vi.fn() }));
vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode }) =>
    createElement("button", props, children),
}));
vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => createElement("textarea", props),
}));
vi.mock("@repo/ui/responsive-dialog", () => {
  const container = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  return {
    ResponsiveDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? createElement("div", null, children) : null,
    ResponsiveDialogBody: container,
    ResponsiveDialogContent: container,
    ResponsiveDialogDescription: container,
    ResponsiveDialogHeader: container,
    ResponsiveDialogTitle: container,
  };
});
vi.mock("lucide-react", () => ({ AlertTriangle: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

import { OpenDisputeDialog } from "./open-dispute-dialog";

const job = { _id: "job-1" } as TConvexDoc<"jobs">;
const escrow = {
  _id: "escrow-1",
  escrowId: "chain-1",
  clientWallet: "GCLIENT",
  status: "funded",
} as TConvexDoc<"escrows">;

function renderDialog() {
  return render(
    createElement(OpenDisputeDialog, {
      isOpen: true,
      onOpenChange,
      job,
      escrow,
      parentType: "escrow",
      parentId: escrow._id,
    }),
  );
}

function fillDraft() {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  Payment dispute  " } });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "  Work was delivered but payment is pending.  " },
  });
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "payment_release_disagreement" },
  });
}

describe("OpenDisputeDialog", () => {
  beforeEach(() => {
    queryResults.eligibility = {
      allowed: true,
      reason: null,
      escrowId: escrow._id,
      onChainEscrowId: escrow.escrowId,
      openedByRole: "client",
    };
    queryResults.latestSubmission = null;
    queryResults.revisions = [];
    for (const name of [
      "createDispute",
      "markStarted",
      "markSucceeded",
      "markFailed",
      "updateEscrow",
      "updateMilestone",
      "createTransaction",
      "updateTransaction",
    ]) {
      mutations[name] = vi.fn().mockResolvedValue(undefined);
    }
    mutations.createDispute = vi.fn().mockResolvedValue("dispute-1");
    markOnChain.mockReset().mockResolvedValue({ txHash: "tx-1" });
    onOpenChange.mockReset();
  });

  afterEach(() => {
    cleanup();
    for (const key of Object.keys(queryResults)) delete queryResults[key];
  });

  it("blocks submission until the backend confirms this escrow is eligible", () => {
    queryResults.eligibility = {
      allowed: false,
      reason: "Escrow is not funded.",
      escrowId: null,
      onChainEscrowId: null,
      openedByRole: null,
    };
    renderDialog();
    fillDraft();
    expect(screen.getByText("Escrow is not funded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Dispute" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(mutations.createDispute).not.toHaveBeenCalled();
  });

  it("validates the form before creating a case and sends selected related records", async () => {
    queryResults.latestSubmission = { _id: "submission-1", createdAt: 1, proofHash: "proof-1" };
    queryResults.revisions = [
      { _id: "revision-1", escrowId: escrow._id, revisionNumber: 1, reason: "Scope", createdAt: 1 },
      {
        _id: "revision-other",
        escrowId: "other",
        revisionNumber: 2,
        reason: "Other",
        createdAt: 2,
      },
    ];
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Open Dispute" }));
    expect(screen.getByRole("alert").textContent).toContain("Title");
    expect(mutations.createDispute).not.toHaveBeenCalled();

    fillDraft();
    expect(screen.queryByText(/Revision 2:/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/Revision 1:/));
    fireEvent.click(screen.getByRole("button", { name: "Open Dispute" }));
    await waitFor(() => expect(mutations.createDispute).toHaveBeenCalledOnce());
    expect(mutations.createDispute).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Payment dispute",
        description: "Work was delivered but payment is pending.",
        reasonCategory: "payment_release_disagreement",
        relatedWorkSubmissionIds: ["submission-1"],
        relatedRevisionRequestIds: ["revision-1"],
        proofHash: "proof-1",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows pending creation and allows retry after a failed create mutation", async () => {
    let rejectCreate!: (error: Error) => void;
    mutations.createDispute = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectCreate = reject;
          }),
      )
      .mockResolvedValueOnce("dispute-1");
    renderDialog();
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Open Dispute" }));
    expect(screen.getByRole("status").textContent).toContain("Saving dispute");
    expect(screen.getByRole("button", { name: "Saving Dispute..." }).hasAttribute("disabled")).toBe(
      true,
    );
    rejectCreate(new Error("Temporary backend failure"));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("Temporary backend failure");
    fireEvent.click(screen.getByRole("button", { name: "Retry Opening Dispute" }));
    await waitFor(() => expect(mutations.createDispute).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows the separate on-chain marking phase after the case is saved", async () => {
    let finishMark!: (result: { txHash: string }) => void;
    markOnChain.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishMark = resolve;
        }),
    );
    renderDialog();
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Open Dispute" }));
    expect((await screen.findByRole("status")).textContent).toContain("Marking escrow disputed");
    expect(mutations.createDispute).toHaveBeenCalledOnce();
    finishMark({ txHash: "tx-1" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps a saved case visible without offering duplicate creation after marking fails", async () => {
    markOnChain.mockRejectedValueOnce(new Error("RPC unavailable"));
    renderDialog();
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Open Dispute" }));
    const link = await screen.findByRole("link", { name: /View the dispute/ });
    expect(link.getAttribute("href")).toBe("/disputes/dispute-1");
    expect(screen.getByRole("alert").textContent).toContain("on-chain marking failed");
    expect(screen.queryByRole("button", { name: /Open Dispute|Retry Opening Dispute/ })).toBeNull();
    expect(mutations.createDispute).toHaveBeenCalledOnce();
    expect(mutations.markFailed).toHaveBeenCalledOnce();
  });

  it("keeps an uncertain submission pending and links its known hash without a duplicate attempt", async () => {
    const hash = "a".repeat(64);
    markOnChain.mockImplementationOnce(
      async ({
        onPhase,
        onSigned,
      }: {
        onPhase: (phase: string) => void;
        onSigned: (identity: { transactionHash: string }) => Promise<void>;
      }) => {
        await onSigned({ transactionHash: hash });
        onPhase("submission");
        throw Object.assign(new Error("RPC timeout"), { txHash: hash });
      },
    );
    renderDialog();
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Open Dispute" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("outcome is uncertain"),
    );
    expect(mutations.markFailed).not.toHaveBeenCalled();
    expect(mutations.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ txHash: hash, status: "pending" }),
    );
    expect(
      screen.getByRole("link", { name: "View transaction on Stellar Expert" }).getAttribute("href"),
    ).toBe("https://example.test/tx");
    expect(screen.getByRole("link", { name: /View the dispute/ }).getAttribute("href")).toBe(
      "/disputes/dispute-1",
    );
    expect(screen.queryByRole("button", { name: "Open Dispute" })).toBeNull();
  });

  it("keeps a confirmed transaction distinct from a failed recording update", async () => {
    mutations.markSucceeded!.mockRejectedValueOnce(new Error("Convex unavailable"));
    renderDialog();
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Open Dispute" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Stellar confirmed"),
    );
    expect(mutations.markFailed).not.toHaveBeenCalled();
    expect(mutations.createDispute).toHaveBeenCalledOnce();
    expect(markOnChain).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "View transaction on Stellar Expert" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /View the dispute/ })).toBeTruthy();
  });
});
