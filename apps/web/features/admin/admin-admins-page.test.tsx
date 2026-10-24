// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IAdminMembershipManagement, IAdminMembershipOperation } from "./types";

const OWNER_WALLET = `G${"O".repeat(55)}`;
const TARGET_WALLET = `G${"T".repeat(55)}`;
const ESCROW_CONTRACT_ID = `C${"E".repeat(55)}`;

const mocks = vi.hoisted(() => ({
  fetchManagement: vi.fn(),
  startOperation: vi.fn(),
  recordSigned: vi.fn(),
  recoverOperation: vi.fn(),
  failBeforeSubmission: vi.fn(),
  addDisputeAdminOnChain: vi.fn(),
  removeDisputeAdminOnChain: vi.fn(),
  handleProtectedApiError: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@/features/admin/admin-session-gate", () => ({
  ADMIN_QUERY_KEY: ["admin"],
  AdminSessionGate: ({ children }: { children: ReactNode }) => children,
  useAdminSessionAccess: () => ({
    verifiedWallet: OWNER_WALLET,
    handleProtectedApiError: mocks.handleProtectedApiError,
  }),
}));
vi.mock("@/features/admin/lib/admin-api", () => ({
  fetchAdminMembershipManagement: mocks.fetchManagement,
  startAdminMembershipOperation: mocks.startOperation,
  recordAdminMembershipSignedTransaction: mocks.recordSigned,
  recoverAdminMembershipOperation: mocks.recoverOperation,
  failAdminMembershipOperationBeforeSubmission: mocks.failBeforeSubmission,
  isAdminAccessError: () => false,
}));
vi.mock("@/core/stellar/escrow-contract", () => ({
  addDisputeAdminOnChain: mocks.addDisputeAdminOnChain,
  removeDisputeAdminOnChain: mocks.removeDisputeAdminOnChain,
}));
vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredAdminContractConfig: () => ({
    network: "testnet",
    rpcUrl: "https://rpc.test.invalid",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: ESCROW_CONTRACT_ID,
  }),
}));
vi.mock("@/core/stellar/transaction", () => ({
  normalizeStellarError: (error: unknown) =>
    error instanceof Error ? error.message : "Unknown Stellar error",
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({ walletAddress: OWNER_WALLET }),
}));
vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({
    address: OWNER_WALLET,
    signTransaction: mocks.signTransaction,
    walletState: { isConnected: true, isTestnet: true },
  }),
}));
vi.mock("@/features/common", () => ({
  ProductPageHero: ({ title }: { readonly title: ReactNode }) => createElement("h1", null, title),
  RouteCallout: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
  showWarningToast: vi.fn(),
}));
vi.mock("@/features/disputes", () => ({
  DisputeOnChainStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, `Chain: ${status}`),
  DisputeStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, status),
}));

import { AdminAdminsPage } from "./admin-admins-page";

// The page relies on Next's automatic JSX runtime; Vitest here uses the classic transform.
vi.stubGlobal("React", React);

function membershipOperation(
  overrides: Partial<IAdminMembershipOperation> = {},
): IAdminMembershipOperation {
  return {
    _id: "operation-doc-1",
    _creationTime: 1,
    network: "testnet",
    contractId: ESCROW_CONTRACT_ID,
    wallet: TARGET_WALLET,
    action: "grant",
    status: "awaiting_signature",
    actorWallet: OWNER_WALLET,
    operationId: "dispute-admin:grant:op-1",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as IAdminMembershipOperation;
}

function management(
  overrides: Partial<Pick<IAdminMembershipManagement, "admins" | "operations">> = {},
): IAdminMembershipManagement {
  return {
    scope: { network: "testnet", contractId: ESCROW_CONTRACT_ID },
    admins: [],
    operations: [],
    ...overrides,
  } as IAdminMembershipManagement;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(AdminAdminsPage)),
  );
}

describe("AdminAdminsPage membership flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchManagement.mockResolvedValue(management());
  });

  afterEach(() => {
    cleanup();
  });

  it("grants a dispute admin end to end: start, sign on chain, record hash, verify, refresh", async () => {
    const operation = membershipOperation();
    mocks.startOperation.mockResolvedValue({ operation });
    mocks.addDisputeAdminOnChain.mockImplementation(async ({ onSigned }) => {
      await onSigned({ transactionHash: "a".repeat(64), transactionValidUntil: 1_900_000_000 });
    });
    mocks.recoverOperation.mockResolvedValue({
      operation: { ...operation, status: "succeeded", transactionHash: "a".repeat(64) },
    });
    renderPage();
    expect(await screen.findByText("No additional dispute admins yet.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Stellar wallet"), {
      target: { value: TARGET_WALLET.toLowerCase() },
    });
    fireEvent.click(screen.getByRole("button", { name: "Grant Access" }));

    expect(await screen.findByText("Dispute admin granted.")).toBeTruthy();
    expect(mocks.startOperation).toHaveBeenCalledWith({
      wallet: TARGET_WALLET,
      action: "grant",
      operationId: expect.stringMatching(`^dispute-admin:grant:${TARGET_WALLET}:`),
    });
    expect(mocks.addDisputeAdminOnChain).toHaveBeenCalledWith(
      expect.objectContaining({
        escrowContractId: ESCROW_CONTRACT_ID,
        sourceAddress: OWNER_WALLET,
        platformAdmin: OWNER_WALLET,
        disputeAdmin: TARGET_WALLET,
        walletType: "external_wallet",
        operationId: operation.operationId,
      }),
    );
    expect(mocks.removeDisputeAdminOnChain).not.toHaveBeenCalled();
    expect(mocks.recordSigned).toHaveBeenCalledWith(
      operation.operationId,
      "a".repeat(64),
      1_900_000_000,
    );
    expect(mocks.recoverOperation).toHaveBeenCalledWith(operation.operationId);
    expect(mocks.failBeforeSubmission).not.toHaveBeenCalled();
    expect(mocks.fetchManagement.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect((screen.getByLabelText("Stellar wallet") as HTMLInputElement).value).toBe("");
  });

  it("marks the operation failed without reconciling when the wallet rejects before signing", async () => {
    const operation = membershipOperation({ action: "revoke" });
    mocks.startOperation.mockResolvedValue({ operation });
    mocks.removeDisputeAdminOnChain.mockRejectedValue(new Error("User declined the request."));
    mocks.failBeforeSubmission.mockResolvedValue({ operation: { ...operation, status: "failed" } });
    renderPage();
    await screen.findByText("No additional dispute admins yet.");

    fireEvent.change(screen.getByLabelText("Stellar wallet"), {
      target: { value: TARGET_WALLET },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revoke Access" }));

    expect(await screen.findByText("User declined the request.")).toBeTruthy();
    expect(mocks.failBeforeSubmission).toHaveBeenCalledWith(
      operation.operationId,
      "User declined the request.",
    );
    expect(mocks.recordSigned).not.toHaveBeenCalled();
    expect(mocks.recoverOperation).not.toHaveBeenCalled();
    expect(mocks.addDisputeAdminOnChain).not.toHaveBeenCalled();
    expect(screen.queryByText(/Dispute admin revoked/)).toBeNull();
  });

  it("reconciles a submitted operation from its saved hash without resubmitting to the chain", async () => {
    const submitted = membershipOperation({
      status: "submitted",
      transactionHash: "b".repeat(64),
    });
    mocks.fetchManagement.mockResolvedValue(
      management({
        admins: [
          {
            _id: "membership-1",
            _creationTime: 1,
            network: "testnet",
            contractId: ESCROW_CONTRACT_ID,
            wallet: TARGET_WALLET,
            accessState: "active",
            updatedAt: 1,
          } as IAdminMembershipManagement["admins"][number],
        ],
        operations: [submitted],
      }),
    );
    mocks.recoverOperation.mockResolvedValue({ operation: submitted, status: "pending" });
    renderPage();

    const reconcile = await screen.findByRole("button", { name: "Reconcile" });
    expect(screen.getByText("Can access disputes")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Transaction/ }).getAttribute("href")).toBe(
      `https://stellar.expert/explorer/testnet/tx/${"b".repeat(64)}`,
    );
    fireEvent.click(reconcile);

    expect(
      await screen.findByText(
        "The saved transaction is still pending. Recovery will not submit it again.",
      ),
    ).toBeTruthy();
    expect(mocks.recoverOperation).toHaveBeenCalledWith(submitted.operationId);
    expect(mocks.addDisputeAdminOnChain).not.toHaveBeenCalled();
    expect(mocks.removeDisputeAdminOnChain).not.toHaveBeenCalled();
    expect(mocks.startOperation).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.fetchManagement).toHaveBeenCalledTimes(2));
  });
});
