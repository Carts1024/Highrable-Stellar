// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IAdminDisputeDetail,
  IAdminResolutionStartedResponse,
  IAdminResolutionSignedResponse,
  IAdminResolutionPendingResponse,
  IAdminResolutionSucceededResponse,
  TAdminReviewStatus,
  TAdminResolutionRequest,
} from "./types";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const walletA = `G${"A".repeat(55)}`;
const walletB = `G${"B".repeat(55)}`;

const runtime = vi.hoisted(() => ({
  wallet: {
    authSession: null as { address: string; token: string; expiresAt: string } | null,
    authenticateWallet: vi.fn<() => Promise<void>>(),
    logoutWallet: vi.fn(),
    address: `G${"A".repeat(55)}` as string | null,
    signTransaction: vi.fn(),
    walletState: {
      status: "connected" as "connected" | "idle",
      walletAddress: `G${"A".repeat(55)}` as string | null,
      isConnected: true,
      isConnecting: false,
      isTestnet: true,
      canWriteContracts: true,
    },
  },
  identity: {
    walletType: "external_wallet" as "external_wallet" | "passkey_smart_account",
    activeWalletMode: "external_wallet" as "external_wallet" | "passkey_smart_account",
    walletAddress: `G${"A".repeat(55)}` as string | null,
  },
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => runtime.wallet,
}));

vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => runtime.identity,
}));

vi.mock("@/features/common", () => ({
  ProductPageHero: ({ title }: { readonly title: ReactNode }) =>
    createElement("h1", undefined, title),
  RoutePanel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("section", undefined, children),
  RoutePanelHeader: ({
    title,
    description,
  }: {
    readonly title: string;
    readonly description: string;
  }) => createElement("header", undefined, createElement("h1", undefined, title), description),
  RouteCallout: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
  RouteEmptyState: ({ description }: { readonly description: ReactNode }) =>
    createElement("p", undefined, description),
  sanitizeMultilineInput: (value: string) => value,
  showWarningToast: vi.fn(),
}));

vi.mock("@/features/disputes", () => ({
  DisputeOnChainStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", undefined, status),
  DisputeStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", undefined, status),
}));

vi.mock("@repo/ui/components/highrable/v2-marketing", () => ({
  HighrableV2Metric: ({ label, value }: { readonly label: string; readonly value: ReactNode }) =>
    createElement("div", undefined, `${label}: ${value}`),
  SectionLabel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("span", undefined, children),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly asChild?: boolean;
  }) =>
    asChild && isValidElement(children)
      ? cloneElement(children, props)
      : createElement("button", props, children),
}));

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => createElement("input", props),
}));

vi.mock("@repo/ui/components/ui/native-select", () => ({
  NativeSelect: (props: Record<string, unknown>) => createElement("select", props),
  NativeSelectOption: ({ children, ...props }: { readonly children?: ReactNode }) =>
    createElement("option", props, children),
}));

vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => createElement("textarea", props),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    readonly href: string;
    readonly children?: ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredAdminContractConfig: () => ({
    rpcUrl: "http://localhost",
    network: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: `C${"A".repeat(55)}`,
  }),
}));

vi.mock("@/core/stellar/escrow-contract", () => ({
  isDisputeAdminOnChain: vi.fn().mockResolvedValue(true),
  markDisputedOnChain: vi.fn(),
  resolveDisputeOnChain: vi.fn(),
}));

vi.mock("@/core/stellar/explorer", () => ({ getTxExplorerUrl: vi.fn() }));
vi.mock("@/core/stellar/hashes", () => ({ toBytesN32Hash: vi.fn() }));
vi.mock("@/core/stellar/passkeySmartAccountExecutor", () => ({
  getPasskeyEscrowExecutionReadiness: vi.fn(),
}));
vi.mock("@/core/stellar/transaction", () => ({
  isPendingStellarTransactionError: () => false,
  normalizeStellarError: (error: unknown) => (error instanceof Error ? error.message : "Error"),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    disputes: {
      markDisputeOnChainStarted: "markDisputeOnChainStarted",
      markDisputeOnChainSucceeded: "markDisputeOnChainSucceeded",
      markDisputeOnChainFailed: "markDisputeOnChainFailed",
    },
    escrows: { updateEscrowStatus: "updateEscrowStatus" },
    milestones: { updateMilestoneEscrowStatus: "updateMilestoneEscrowStatus" },
    transactions: {
      createTransaction: "createTransaction",
      updateTransactionStatus: "updateTransactionStatus",
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue(true),
}));

import { isDisputeAdminOnChain, resolveDisputeOnChain } from "@/core/stellar/escrow-contract";
import { toBytesN32Hash } from "@/core/stellar/hashes";

import { AdminDisputeDetailPage } from "./admin-dispute-detail-page";
import { AdminDisputesPage } from "./admin-disputes-page";

type TProtectedPage = "queue" | "detail";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
}

function renderPage(page: TProtectedPage, queryClient = createQueryClient()) {
  const element =
    page === "queue"
      ? createElement(AdminDisputesPage)
      : createElement(AdminDisputeDetailPage, { disputeId: "dispute-1" });
  const rendered = render(createElement(QueryClientProvider, { client: queryClient }, element));
  return { ...rendered, queryClient };
}

const queueResponse = {
  disputes: [
    {
      disputeId: "dispute-1",
      disputeNumber: "DSP-001",
      title: "Protected queue record",
      status: "under_review",
      onChainStatus: "marked",
      reasonCategory: "work_not_delivered",
      clientWallet: "GCLIENT",
      freelancerWallet: "GFREELANCER",
      openedAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    },
  ],
};

const detailResponse = {
  dispute: {
    _id: "dispute-1",
    disputeNumber: "DSP-001",
    parentType: "job",
    parentId: "job-1",
    clientWallet: "GCLIENT",
    freelancerWallet: "GFREELANCER",
    openedByWallet: "GCLIENT",
    openedByWalletType: "external_wallet",
    openedByRole: "client",
    reasonCategory: "work_not_delivered",
    title: "Protected detail record",
    description: "Protected dispute details.",
    evidenceAttachmentIds: [],
    relatedWorkSubmissionIds: [],
    relatedRevisionRequestIds: [],
    status: "under_review",
    onChainStatus: "marked",
    onChainEscrowId: "escrow-on-chain-1",
    assignedAdminWallet: walletA,
    openedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    attachments: [],
  },
  timeline: [],
  assignmentEvents: [],
  settlementAttempts: [],
  job: null,
  milestone: null,
  escrow: { status: "disputed" },
};

const detailWithEvidenceResponse = {
  ...detailResponse,
  dispute: {
    ...detailResponse.dispute,
    evidenceAttachmentIds: ["case-proof", "case-link"],
    attachments: [
      {
        _id: "case-proof",
        _creationTime: 1,
        type: "pdf",
        name: "case-proof.pdf",
        uploadedByWallet: "GCLIENT",
        uploadedByWalletType: "external_wallet",
        ownerRole: "client",
        parentType: "dispute",
        parentId: "dispute-1",
        visibility: "participants",
        status: "active",
        size: 2048,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        url: "https://files.example.test/case-proof.pdf",
      },
      {
        _id: "case-link",
        _creationTime: 2,
        type: "link",
        name: "Case design reference",
        uploadedByWallet: "GCLIENT",
        uploadedByWalletType: "external_wallet",
        ownerRole: "client",
        parentType: "dispute",
        parentId: "dispute-1",
        visibility: "participants",
        status: "active",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
        url: null,
        externalUrl: "https://example.test/case-design-reference",
      },
    ],
  },
  timeline: [
    {
      _id: "event-1",
      message: "Event-specific evidence was added.",
      createdAt: 1_700_000_200_000,
      attachmentIds: ["event-proof"],
      attachments: [
        {
          _id: "event-proof",
          _creationTime: 3,
          type: "document",
          name: "event-proof.docx",
          uploadedByWallet: "GFREELANCER",
          uploadedByWalletType: "external_wallet",
          ownerRole: "freelancer",
          parentType: "dispute",
          parentId: "dispute-1",
          visibility: "participants",
          status: "active",
          size: 4096,
          createdAt: 1_700_000_200_000,
          updatedAt: 1_700_000_200_000,
          url: "https://files.example.test/event-proof.docx",
        },
      ],
    },
  ],
};

function sessionFor(wallet: string, isOwner = false) {
  return { adminWallet: wallet, isOwner, isDisputeAdmin: true };
}

function getRequestUrl(call: readonly unknown[]): string {
  return String(call[0]);
}

function getProtectedQueryKeys(queryClient: QueryClient): readonly (readonly unknown[])[] {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: ["admin"] })
    .map((query) => query.queryKey);
}

describe("protected administrator pages", () => {
  beforeEach(() => {
    vi.mocked(isDisputeAdminOnChain).mockReset().mockResolvedValue(true);
    vi.mocked(resolveDisputeOnChain).mockReset();
    vi.mocked(toBytesN32Hash).mockReset().mockResolvedValue(new Uint8Array(32));
    runtime.wallet.authSession = null;
    runtime.wallet.authenticateWallet.mockReset();
    runtime.wallet.signTransaction.mockReset().mockResolvedValue("signed-xdr");
    runtime.wallet.logoutWallet.mockReset();
    runtime.wallet.address = walletA;
    runtime.wallet.walletState = {
      status: "connected",
      walletAddress: walletA,
      isConnected: true,
      isConnecting: false,
      isTestnet: true,
      canWriteContracts: true,
    };
    runtime.identity.walletType = "external_wallet";
    runtime.identity.activeWalletMode = "external_wallet";
    runtime.identity.walletAddress = walletA;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("accepts a protected review journey through authorization rejection and saved-transaction recovery", async () => {
    const transactionHash = "c".repeat(64);
    const transactionValidUntil = 2_000_000_000;
    const finalVerification = createDeferred<Response>();
    const resolutionRequests: TAdminResolutionRequest[] = [];
    const statusRequests: { status: TAdminReviewStatus; message?: string }[] = [];
    let operationId = "";
    let reviewAuthorized = false;
    let pendingRecovery = false;
    let terminal = false;
    let reconciliations = 0;
    let reviewStatus: TAdminReviewStatus = "under_review";
    const terminalEvent = {
      _id: "verified-resolution-event",
      type: "dispute_resolved",
      actorWallet: walletA,
      actorRole: "moderator",
      actorWalletType: "external_wallet",
      message: "Verified client refund recorded.",
      transactionHash,
      createdAt: 1_700_000_300_000,
      attachments: [],
    };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/session") return Promise.resolve(response(sessionFor(walletA)));
      if (url === "/api/admin/disputes/dispute-1/status") {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body)) as {
          status: TAdminReviewStatus;
          message?: string;
        };
        statusRequests.push(body);
        if (!reviewAuthorized)
          return Promise.resolve(response({ error: "Review permission was revoked." }, 403));
        reviewStatus = body.status;
        return Promise.resolve(response({ success: true }));
      }
      if (url === "/api/admin/disputes/dispute-1/resolve") {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body)) as TAdminResolutionRequest;
        resolutionRequests.push(body);
        if (body.phase === "started") {
          operationId = body.operationId;
          return Promise.resolve(
            response({
              success: true,
              phase: "started",
              result: { operationId, freelancerShareBps: body.freelancerShareBps },
            } satisfies IAdminResolutionStartedResponse),
          );
        }
        expect(body.operationId).toBe(operationId);
        if (body.phase === "signed") {
          expect(body).toEqual({
            phase: "signed",
            operationId,
            transactionHash,
            transactionValidUntil,
          });
          return Promise.resolve(
            response({
              success: true,
              phase: "signed",
              result: { operationId, transactionHash },
            } satisfies IAdminResolutionSignedResponse),
          );
        }
        if (body.phase === "succeeded")
          return Promise.resolve(
            response({ error: "Settlement verification service unavailable." }, 500),
          );
        if (body.phase === "reconcile") {
          reconciliations += 1;
          if (reconciliations === 1) {
            pendingRecovery = true;
            return Promise.resolve(
              response({
                status: "pending",
                result: { status: "submission_unknown" },
              } satisfies IAdminResolutionPendingResponse),
            );
          }
          return finalVerification.promise;
        }
        throw new Error(`Unexpected settlement callback: ${body.phase}`);
      }
      if (url === "/api/admin/disputes/dispute-1") {
        return Promise.resolve(
          response({
            ...detailWithEvidenceResponse,
            dispute: {
              ...detailWithEvidenceResponse.dispute,
              status: terminal ? "resolved_client" : reviewStatus,
              ...(terminal ? { resolutionTxHash: transactionHash } : {}),
            },
            escrow: { status: terminal ? "cancelled" : "disputed" } satisfies Pick<
              NonNullable<IAdminDisputeDetail["escrow"]>,
              "status"
            >,
            timeline: terminal
              ? [...detailWithEvidenceResponse.timeline, terminalEvent]
              : detailWithEvidenceResponse.timeline,
            settlementAttempts:
              pendingRecovery && !terminal
                ? [
                    {
                      _id: "saved-attempt",
                      actorWallet: walletA,
                      operationId,
                      transactionHash,
                      status: "submission_unknown",
                    },
                  ]
                : [],
          }),
        );
      }
      if (url.startsWith("/api/admin/disputes")) {
        return Promise.resolve(
          response({
            disputes: [
              {
                ...queueResponse.disputes[0],
                assignedAdminWallet: walletA,
                status: terminal ? "resolved_client" : reviewStatus,
              },
            ],
          }),
        );
      }
      throw new Error(`Unexpected acceptance request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(resolveDisputeOnChain).mockImplementationOnce(async (args) => {
      if (!args.signTransaction || !args.onSigned)
        throw new Error("Settlement callbacks are required.");
      await args.signTransaction("prepared-settlement-xdr");
      await args.onSigned({ transactionHash, transactionValidUntil });
      return { txHash: transactionHash };
    });

    const queue = renderPage("queue");
    const reviewLink = await screen.findByRole("link", { name: "Review" });
    expect(reviewLink.getAttribute("href")).toBe("/admin/disputes/dispute-1");
    // Next.js navigation is the harness seam; mount the linked route with the same query client.
    queue.unmount();
    const detail = renderPage("detail", queue.queryClient);
    expect(await screen.findByRole("link", { name: "Open case-proof.pdf" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByRole("heading", { name: "Admin access forbidden" })).toBeTruthy();
    expect(screen.queryByText("case-proof.pdf")).toBeNull();
    expect(vi.mocked(resolveDisputeOnChain)).not.toHaveBeenCalled();
    expect(resolutionRequests).toHaveLength(0);

    reviewAuthorized = true;
    fireEvent.click(await screen.findByRole("button", { name: "Retry access check" }));
    expect(await screen.findByText("case-proof.pdf")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Review status"), {
      target: { value: "awaiting_client_response" },
    });
    fireEvent.change(screen.getByLabelText("Optional review message"), {
      target: { value: "Evidence reviewed; client response requested." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(await screen.findByText("awaiting_client_response")).toBeTruthy();
    expect(statusRequests).toEqual([
      { status: "under_review" },
      {
        status: "awaiting_client_response",
        message: "Evidence reviewed; client response requested.",
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Resolve On-Chain" }));
    expect(await screen.findByText(/Settlement is unresolved/)).toBeTruthy();
    expect(
      screen.queryByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Resolve On-Chain" }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Reconcile" }));
    await waitFor(() => expect(reconciliations).toBe(2));
    expect(vi.mocked(resolveDisputeOnChain)).toHaveBeenCalledTimes(1);
    expect(runtime.wallet.signTransaction).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeNull();

    await act(async () => {
      terminal = true;
      finalVerification.resolve(
        response({
          status: "succeeded",
          result: {
            status: "resolved_client",
            freelancerShareBps: 0,
            freelancerPayoutAmount: 0,
            clientRefundAmount: 100,
            resolutionTxHash: transactionHash,
            resolutionStellarExpertUrl: `https://stellar.expert/explorer/testnet/tx/${transactionHash}`,
          },
        } satisfies IAdminResolutionSucceededResponse),
      );
    });
    expect(
      await screen.findByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeTruthy();
    expect(await screen.findByText("Verified client refund recorded.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resolve On-Chain" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconcile" })).toBeNull();
    expect(resolutionRequests.map((request) => request.phase)).toEqual([
      "started",
      "signed",
      "succeeded",
      "reconcile",
      "reconcile",
    ]);
    expect(resolutionRequests.filter((request) => request.phase === "reconcile")).toEqual([
      { phase: "reconcile", operationId },
      { phase: "reconcile", operationId },
    ]);
    expect(vi.mocked(resolveDisputeOnChain)).toHaveBeenCalledTimes(1);

    detail.unmount();
    renderPage("queue", queue.queryClient);
    expect(await screen.findByText("resolved_client")).toBeTruthy();
  });
  it("blocks settlement after on-chain membership is revoked despite a valid protected session", async () => {
    vi.mocked(isDisputeAdminOnChain).mockResolvedValueOnce(false);
    const fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL) =>
        Promise.resolve(
          response(String(input) === "/api/admin/session" ? sessionFor(walletA) : detailResponse),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderPage("detail");

    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

    expect(
      await screen.findByText(/The connected wallet is not an active on-chain dispute admin\./),
    ).toBeTruthy();
    expect(vi.mocked(isDisputeAdminOnChain)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resolveDisputeOnChain)).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/resolve"))).toBe(false);
  });

  it.each([401, 403] as const)(
    "closes protected settlement after the start request returns %s without invoking Stellar",
    async (status) => {
      const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/admin/session") return Promise.resolve(response(sessionFor(walletA)));
        if (url.endsWith("/resolve"))
          return Promise.resolve(response({ error: "Settlement authorization revoked." }, status));
        return Promise.resolve(response(detailResponse));
      });
      vi.stubGlobal("fetch", fetchMock);
      const rendered = renderPage("detail");

      fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

      expect(
        await screen.findByRole("heading", {
          name: status === 401 ? "Authentication required" : "Admin access forbidden",
        }),
      ).toBeTruthy();
      expect(screen.queryByText("Protected detail record")).toBeNull();
      expect(vi.mocked(resolveDisputeOnChain)).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(
          rendered.queryClient.getQueryData(["admin", "dispute", walletA, "dispute-1"]),
        ).toBeUndefined(),
      );
    },
  );

  it.each(["membership", "started", "hash"] as const)(
    "abandons stale settlement after wallet switch during %s verification",
    async (pauseAt) => {
      const membership = createDeferred<boolean>();
      const started = createDeferred<Response>();
      const hash = createDeferred<Uint8Array>();
      if (pauseAt === "hash") vi.mocked(toBytesN32Hash).mockReturnValueOnce(hash.promise);
      const startedBody = {
        success: true,
        phase: "started",
        result: { operationId: "stale-operation", freelancerShareBps: 0 },
      } satisfies IAdminResolutionStartedResponse;
      const phases: string[] = [];
      if (pauseAt === "membership")
        vi.mocked(isDisputeAdminOnChain).mockReturnValueOnce(membership.promise);
      const fetchMock = vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url === "/api/admin/session")
            return Promise.resolve(response(sessionFor(runtime.wallet.address ?? walletA)));
          if (url.endsWith("/resolve")) {
            const body = JSON.parse(String(init?.body)) as TAdminResolutionRequest;
            phases.push(body.phase);
            if (body.phase === "started")
              return pauseAt === "started"
                ? started.promise
                : Promise.resolve(response(startedBody));
            return Promise.resolve(response({ success: true, phase: "failed", result: true }));
          }
          return Promise.resolve(
            response({
              ...detailResponse,
              dispute: { ...detailResponse.dispute, assignedAdminWallet: runtime.wallet.address },
            }),
          );
        });
      vi.stubGlobal("fetch", fetchMock);
      const rendered = renderPage("detail");
      fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
      await waitFor(() =>
        expect(
          pauseAt === "membership"
            ? vi.mocked(isDisputeAdminOnChain).mock.calls.length
            : pauseAt === "hash"
              ? vi.mocked(toBytesN32Hash).mock.calls.length
              : phases.length,
        ).toBe(1),
      );

      runtime.wallet.address = walletB;
      runtime.wallet.walletState.walletAddress = walletB;
      runtime.identity.walletAddress = walletB;
      rendered.rerender(
        createElement(
          QueryClientProvider,
          { client: rendered.queryClient },
          createElement(AdminDisputeDetailPage, { disputeId: "dispute-1" }),
        ),
      );
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.filter(([input]) => String(input) === "/api/admin/session"),
        ).toHaveLength(2),
      );
      await act(async () => {
        membership.resolve(true);
        started.resolve(response(startedBody));
        hash.resolve(new Uint8Array(32));
      });

      expect(vi.mocked(resolveDisputeOnChain)).not.toHaveBeenCalled();
      expect(phases.filter((phase) => phase === "started")).toHaveLength(
        pauseAt === "membership" ? 0 : 1,
      );
      expect(
        screen.queryByText("Dispute settlement was verified on Stellar and recorded."),
      ).toBeNull();
    },
  );
  it.each(["simulation", "signing", "signed_recording"] as const)(
    "does not release the submission callback after wallet change during %s",
    async (pauseAt) => {
      const signing = createDeferred<void>();
      const signedRecording = createDeferred<Response>();
      const submitted = vi.fn();
      const phases: string[] = [];
      vi.mocked(resolveDisputeOnChain).mockImplementationOnce(async (args) => {
        if (pauseAt === "simulation") await signing.promise;
        if (!args.signTransaction)
          throw new Error("External settlement requires a signing callback.");
        await args.signTransaction("prepared-xdr");
        args.onPhase?.("signing");
        if (pauseAt === "signing") await signing.promise;
        await args.onSigned?.({
          transactionHash: "a".repeat(64),
          transactionValidUntil: 2_000_000_000,
        });
        submitted();
        return { txHash: "a".repeat(64) };
      });
      const fetchMock = vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url === "/api/admin/session")
            return Promise.resolve(response(sessionFor(runtime.wallet.address ?? walletA)));
          if (url.endsWith("/resolve")) {
            const body = JSON.parse(String(init?.body)) as TAdminResolutionRequest;
            phases.push(body.phase);
            if (body.phase === "signed" && pauseAt === "signed_recording")
              return signedRecording.promise;
            if (body.phase === "started")
              return Promise.resolve(
                response({
                  success: true,
                  phase: "started",
                  result: {
                    operationId: body.operationId,
                    freelancerShareBps: body.freelancerShareBps,
                  },
                } satisfies IAdminResolutionStartedResponse),
              );
            if (body.phase === "signed")
              return Promise.resolve(
                response({
                  success: true,
                  phase: "signed",
                  result: { operationId: body.operationId, transactionHash: body.transactionHash },
                } satisfies IAdminResolutionSignedResponse),
              );
            return Promise.resolve(response({ success: true, phase: "failed", result: true }));
          }
          return Promise.resolve(
            response({
              ...detailResponse,
              dispute: { ...detailResponse.dispute, assignedAdminWallet: runtime.wallet.address },
            }),
          );
        });
      vi.stubGlobal("fetch", fetchMock);
      const rendered = renderPage("detail");
      fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
      await waitFor(() =>
        expect(
          pauseAt !== "signed_recording"
            ? vi.mocked(resolveDisputeOnChain).mock.calls.length
            : phases.filter((phase) => phase === "signed").length,
        ).toBe(1),
      );

      runtime.wallet.address = walletB;
      runtime.wallet.walletState.walletAddress = walletB;
      runtime.identity.walletAddress = walletB;
      rendered.rerender(
        createElement(
          QueryClientProvider,
          { client: rendered.queryClient },
          createElement(AdminDisputeDetailPage, { disputeId: "dispute-1" }),
        ),
      );
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.filter(([input]) => String(input) === "/api/admin/session"),
        ).toHaveLength(2),
      );
      await act(async () => {
        signing.resolve();
        signedRecording.resolve(
          response({
            success: true,
            phase: "signed",
            result: { operationId: "saved-operation", transactionHash: "a".repeat(64) },
          } satisfies IAdminResolutionSignedResponse),
        );
      });

      expect(submitted).not.toHaveBeenCalled();
      expect(phases).toEqual(pauseAt !== "signed_recording" ? ["started"] : ["started", "signed"]);
      if (pauseAt === "simulation") expect(runtime.wallet.signTransaction).not.toHaveBeenCalled();
      expect(
        screen.queryByText("Dispute settlement was verified on Stellar and recorded."),
      ).toBeNull();
    },
  );
  it.each(["queue", "detail"] as const)(
    "does not request protected %s data before session verification",
    async (page) => {
      const session = createDeferred<Response>();
      const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === "/api/admin/session") {
          return session.promise;
        }
        return Promise.resolve(response(page === "queue" ? queueResponse : detailResponse));
      });
      vi.stubGlobal("fetch", fetchMock);

      renderPage(page);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getRequestUrl(fetchMock.mock.calls[0] ?? [])).toBe("/api/admin/session");
      expect(
        screen.queryByText(page === "queue" ? "Protected queue record" : "Protected detail record"),
      ).toBeNull();

      session.resolve(response(sessionFor(walletA)));

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(([input]) =>
            getRequestUrl([input]).startsWith("/api/admin/disputes"),
          ),
        ).toBe(true);
      });
    },
  );

  it("renders assigned-admin case and event evidence through the real session gate", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(sessionFor(walletA)))
      .mockResolvedValueOnce(response(detailWithEvidenceResponse));
    vi.stubGlobal("fetch", fetchMock);

    renderPage("detail");

    expect(await screen.findByText("case-proof.pdf")).toBeTruthy();
    expect(screen.getByText("Case design reference")).toBeTruthy();
    expect(screen.getByText("event-proof.docx")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open case-proof.pdf" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Case design reference" })).toBeTruthy();
    expect(
      fetchMock.mock.calls.slice(1).every(([, init]) => (init as RequestInit).method === "GET"),
    ).toBe(true);
  });

  it.each(["queue", "detail"] as const)(
    "keeps protected %s reads closed for malformed sessions and restores them after manual retry",
    async (page) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          response({
            adminWallet: walletA,
            isOwner: "true",
            isDisputeAdmin: true,
          }),
        )
        .mockResolvedValueOnce(response(sessionFor(walletA)))
        .mockResolvedValueOnce(response(page === "queue" ? queueResponse : detailResponse));
      vi.stubGlobal("fetch", fetchMock);

      renderPage(page);

      expect(
        await screen.findByRole("heading", { name: "Admin access check failed" }),
      ).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByText(page === "queue" ? "Protected queue record" : "Protected detail record"),
      ).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Retry access check" }));

      expect(
        await screen.findByText(
          page === "queue" ? "Protected queue record" : "Protected detail record",
        ),
      ).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it("keeps both protected reads blocked when the signed session belongs to another wallet", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response(sessionFor(walletB))));
    vi.stubGlobal("fetch", fetchMock);

    const queue = renderPage("queue");
    expect(
      await screen.findByRole("heading", { name: "Authenticate connected admin wallet" }),
    ).toBeTruthy();
    expect(fetchMock.mock.calls).toHaveLength(1);
    queue.unmount();

    cleanup();
    const detail = renderPage("detail");
    expect(
      await screen.findByRole("heading", { name: "Authenticate connected admin wallet" }),
    ).toBeTruthy();
    expect(fetchMock.mock.calls).toHaveLength(2);
    detail.unmount();
    expect(
      fetchMock.mock.calls.every(([input]) => getRequestUrl([input]) === "/api/admin/session"),
    ).toBe(true);
  });

  it.each(["queue", "detail"] as const)(
    "does not check session or mount protected %s content in passkey mode",
    async (page) => {
      runtime.identity.walletType = "passkey_smart_account";
      runtime.identity.activeWalletMode = "passkey_smart_account";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      renderPage(page);

      expect(
        await screen.findByRole("heading", { name: "Use an external admin wallet" }),
      ).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        screen.queryByText(page === "queue" ? "Protected queue record" : "Protected detail record"),
      ).toBeNull();
    },
  );

  it.each([
    ["queue", 401, "Authentication required"],
    ["detail", 403, "Admin access forbidden"],
  ] as const)(
    "removes cached protected %s data after a page-level %s",
    async (page, status, heading) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response(sessionFor(walletA)))
        .mockResolvedValueOnce(response(page === "queue" ? queueResponse : detailResponse))
        .mockResolvedValueOnce(response({ error: "Protected read rejected." }, status));
      vi.stubGlobal("fetch", fetchMock);
      const rendered = renderPage(page);

      expect(
        await screen.findByText(
          page === "queue" ? "Protected queue record" : "Protected detail record",
        ),
      ).toBeTruthy();

      if (page === "queue") {
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      } else {
        await rendered.queryClient.refetchQueries({ queryKey: ["admin", "dispute"] });
      }

      expect(await screen.findByRole("heading", { name: heading })).toBeTruthy();
      await waitFor(() => {
        expect(
          screen.queryByText(
            page === "queue" ? "Protected queue record" : "Protected detail record",
          ),
        ).toBeNull();
        expect(
          getProtectedQueryKeys(rendered.queryClient).some((queryKey) =>
            queryKey.some((part) => part === "dispute" || part === "disputes"),
          ),
        ).toBe(false);
      });
    },
  );

  it.each([401, 403] as const)(
    "closes the real protected detail after a review-status mutation returns %s",
    async (status) => {
      const fetchMock = vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url === "/api/admin/session") {
            return Promise.resolve(response(sessionFor(walletA)));
          }
          if (url === "/api/admin/disputes/dispute-1") {
            return Promise.resolve(response(detailResponse));
          }
          if (url === "/api/admin/disputes/dispute-1/status") {
            expect(init?.method).toBe("POST");
            expect(init?.body).toBe(JSON.stringify({ status: "under_review" }));
            return Promise.resolve(response({ error: "Review mutation rejected." }, status));
          }
          throw new Error(`Unexpected admin request: ${url}`);
        });
      vi.stubGlobal("fetch", fetchMock);

      const rendered = renderPage("detail");
      expect(await screen.findByText("Protected detail record")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Update Status" }));

      expect(
        await screen.findByRole("heading", {
          name: status === 401 ? "Authentication required" : "Admin access forbidden",
        }),
      ).toBeTruthy();
      await waitFor(() => {
        expect(
          rendered.queryClient.getQueryData(["admin", "dispute", walletA, "dispute-1"]),
        ).toBeUndefined();
      });
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/status")),
      ).toHaveLength(1);
    },
  );

  it("cancels and removes old-wallet queue data before a late response can restore it", async () => {
    const sessionA = createDeferred<Response>();
    const queueA = createDeferred<Response>();
    const sessionB = createDeferred<Response>();
    const queueB = createDeferred<Response>();
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/session") {
        return fetchMock.mock.calls.length <= 1 ? sessionA.promise : sessionB.promise;
      }
      return fetchMock.mock.calls.length <= 2 ? queueA.promise : queueB.promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const rendered = renderPage("queue");
    sessionA.resolve(response(sessionFor(walletA)));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    runtime.wallet.address = walletB;
    runtime.wallet.walletState.walletAddress = walletB;
    runtime.identity.walletAddress = walletB;
    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: rendered.queryClient },
        createElement(AdminDisputesPage),
      ),
    );
    sessionB.resolve(response(sessionFor(walletB)));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    queueA.resolve(
      response({ disputes: [{ ...queueResponse.disputes[0], title: "Wallet A stale record" }] }),
    );
    await waitFor(() => expect(screen.queryByText("Wallet A stale record")).toBeNull());
    queueB.resolve(
      response({ disputes: [{ ...queueResponse.disputes[0], title: "Wallet B current record" }] }),
    );

    expect(await screen.findByText("Wallet B current record")).toBeTruthy();
    expect(
      rendered.queryClient.getQueryData(["admin", "disputes", walletA, "", "", "all"]),
    ).toBeUndefined();
  });

  it("does not restore late detail evidence from the previous wallet identity", async () => {
    const sessionA = createDeferred<Response>();
    const detailA = createDeferred<Response>();
    const sessionB = createDeferred<Response>();
    const detailB = createDeferred<Response>();
    let sessionReads = 0;
    let detailReads = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/session") {
        sessionReads += 1;
        return sessionReads === 1 ? sessionA.promise : sessionB.promise;
      }
      if (url.startsWith("/api/admin/disputes/")) {
        detailReads += 1;
        return detailReads === 1 ? detailA.promise : detailB.promise;
      }
      throw new Error(`Unexpected admin request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const rendered = renderPage("detail");
    sessionA.resolve(response(sessionFor(walletA)));
    await waitFor(() => expect(detailReads).toBe(1));

    runtime.wallet.address = walletB;
    runtime.wallet.walletState.walletAddress = walletB;
    runtime.identity.walletAddress = walletB;
    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: rendered.queryClient },
        createElement(AdminDisputeDetailPage, { disputeId: "dispute-1" }),
      ),
    );
    sessionB.resolve(response(sessionFor(walletB)));
    await waitFor(() => expect(detailReads).toBe(2));

    detailA.resolve(
      response({
        ...detailWithEvidenceResponse,
        dispute: { ...detailWithEvidenceResponse.dispute, title: "Stale wallet A detail" },
      }),
    );
    await waitFor(() => expect(screen.queryByText("case-proof.pdf")).toBeNull());

    detailB.resolve(
      response({
        ...detailWithEvidenceResponse,
        dispute: {
          ...detailWithEvidenceResponse.dispute,
          assignedAdminWallet: walletB,
          title: "Current wallet B detail",
        },
      }),
    );
    expect(await screen.findByText("Current wallet B detail")).toBeTruthy();
    expect(screen.getByText("case-proof.pdf")).toBeTruthy();
    expect(screen.queryByText("Stale wallet A detail")).toBeNull();
  });

  it("removes loaded detail evidence on disconnect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(sessionFor(walletA)))
      .mockResolvedValueOnce(response(detailWithEvidenceResponse));
    vi.stubGlobal("fetch", fetchMock);
    const rendered = renderPage("detail");

    expect(await screen.findByText("case-proof.pdf")).toBeTruthy();
    runtime.wallet.address = null;
    runtime.wallet.walletState = {
      status: "idle",
      walletAddress: null,
      isConnected: false,
      isConnecting: false,
      isTestnet: true,
      canWriteContracts: true,
    };
    runtime.identity.walletAddress = null;
    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: rendered.queryClient },
        createElement(AdminDisputeDetailPage, { disputeId: "dispute-1" }),
      ),
    );

    expect(await screen.findByRole("heading", { name: "Connect an admin wallet" })).toBeTruthy();
    expect(screen.queryByText("case-proof.pdf")).toBeNull();
    await waitFor(() => {
      expect(
        rendered.queryClient.getQueryData(["admin", "dispute", walletA, "dispute-1"]),
      ).toBeUndefined();
    });
  });

  it("removes protected queue cache and content on disconnect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(sessionFor(walletA)))
      .mockResolvedValueOnce(response(queueResponse));
    vi.stubGlobal("fetch", fetchMock);
    const rendered = renderPage("queue");

    expect(await screen.findByText("Protected queue record")).toBeTruthy();
    runtime.wallet.address = null;
    runtime.wallet.walletState = {
      status: "idle",
      walletAddress: null,
      isConnected: false,
      isConnecting: false,
      isTestnet: true,
      canWriteContracts: true,
    };
    runtime.identity.walletAddress = null;
    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: rendered.queryClient },
        createElement(AdminDisputesPage),
      ),
    );

    expect(await screen.findByRole("heading", { name: "Connect an admin wallet" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Protected queue record")).toBeNull();
      expect(
        rendered.queryClient.getQueryData(["admin", "disputes", walletA, "", "", "all"]),
      ).toBeUndefined();
    });
  });

  it.each([401, 403] as const)(
    "closes an owner's loaded queue when membership verification returns %s and ignores a late queue response",
    async (status) => {
      const lateQueue = createDeferred<Response>();
      let disputeReads = 0;
      let membershipReads = 0;
      const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/admin/session") {
          return Promise.resolve(response(sessionFor(walletA, true)));
        }
        if (url.startsWith("/api/admin/disputes")) {
          disputeReads += 1;
          return disputeReads === 1 ? Promise.resolve(response(queueResponse)) : lateQueue.promise;
        }
        if (url === "/api/admin/admins") {
          membershipReads += 1;
          return membershipReads === 1
            ? Promise.resolve(response({ admins: [] }))
            : Promise.resolve(response({ error: "Membership access rejected." }, status));
        }
        throw new Error(`Unexpected admin request: ${url}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      const rendered = renderPage("queue");

      expect(await screen.findByText("Protected queue record")).toBeTruthy();
      await waitFor(() => expect(membershipReads).toBe(1));

      const queueRefetch = rendered.queryClient.refetchQueries({
        queryKey: ["admin", "disputes", walletA, "", "", "all"],
      });
      await waitFor(() => expect(disputeReads).toBe(2));

      const membershipRefetch = rendered.queryClient.refetchQueries({
        queryKey: ["admin", "admins", walletA],
      });

      expect(
        await screen.findByRole("heading", {
          name: status === 401 ? "Authentication required" : "Admin access forbidden",
        }),
      ).toBeTruthy();
      expect(screen.queryByText("Protected queue record")).toBeNull();
      await waitFor(() => {
        expect(
          rendered.queryClient.getQueryData(["admin", "disputes", walletA, "", "", "all"]),
        ).toBeUndefined();
        expect(rendered.queryClient.getQueryData(["admin", "admins", walletA])).toBeUndefined();
      });

      lateQueue.resolve(
        response({
          disputes: [{ ...queueResponse.disputes[0], title: "Late protected queue record" }],
        }),
      );
      await Promise.all([queueRefetch, membershipRefetch]);
      expect(screen.queryByText("Late protected queue record")).toBeNull();
      expect(
        rendered.queryClient.getQueryData(["admin", "disputes", walletA, "", "", "all"]),
      ).toBeUndefined();
    },
  );

  it("keeps an owner's loaded queue open for a non-authorization membership failure", async () => {
    let membershipReads = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/session") {
        return Promise.resolve(response(sessionFor(walletA, true)));
      }
      if (url.startsWith("/api/admin/disputes")) {
        return Promise.resolve(response(queueResponse));
      }
      if (url === "/api/admin/admins") {
        membershipReads += 1;
        return Promise.resolve(response({ error: "Membership service failed." }, 500));
      }
      throw new Error(`Unexpected admin request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage("queue");

    expect(await screen.findByText("Protected queue record")).toBeTruthy();
    await waitFor(() => expect(membershipReads).toBe(3));
    expect(screen.getByText("Protected queue record")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Authentication required" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Admin access forbidden" })).toBeNull();
  });

  it("retries only retryable queue reads and performs no writes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(sessionFor(walletA)))
      .mockResolvedValueOnce(response({ error: "Temporary failure." }, 500))
      .mockResolvedValueOnce(response({ error: "Temporary failure." }, 500))
      .mockResolvedValueOnce(response(queueResponse));
    vi.stubGlobal("fetch", fetchMock);

    renderPage("queue");

    expect(await screen.findByText("Protected queue record")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      fetchMock.mock.calls.slice(1).every((call) => {
        const init = call[1] as RequestInit | undefined;
        return init?.method === "GET";
      }),
    ).toBe(true);
  });
});
