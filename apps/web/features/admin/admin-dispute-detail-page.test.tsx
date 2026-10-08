// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  OptionHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const runtime = vi.hoisted(() => ({
  wallet: {
    address: `G${"A".repeat(55)}`,
    walletType: "external_wallet" as "external_wallet" | "passkey_smart_account",
    walletState: {
      isConnected: true,
      isTestnet: true,
      canWriteContracts: true,
    },
    signTransaction: vi.fn(),
  },
  protectedApiError: vi.fn(),
  session: {
    isOwner: false,
  },
  stellar: {
    markDisputedOnChain: vi.fn(),
    isDisputeAdminOnChain: vi.fn().mockResolvedValue(true),
    resolveDisputeOnChain: vi.fn(),
  },
  queryClient: null as QueryClient | null,
}));

vi.mock("@/features/admin/admin-session-gate", () => ({
  ADMIN_QUERY_KEY: ["admin"],
  AdminSessionGate: ({ children }: { readonly children: ReactNode }) => children,
  useAdminSessionAccess: () => ({
    verifiedWallet: `G${"A".repeat(55)}`,
    isOwner: runtime.session.isOwner,
    isDisputeAdmin: true,
    handleProtectedApiError: runtime.protectedApiError,
  }),
}));

vi.mock("@/features/admin/components/admin-operations-ui", () => ({
  AdminSection: ({ title, children }: { readonly title: string; readonly children?: ReactNode }) =>
    createElement("section", null, createElement("h2", null, title), children),
}));

vi.mock("@/features/common", () => ({
  ProductPageHero: ({ title }: { readonly title: ReactNode }) => createElement("h1", null, title),
  RouteCallout: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
  RouteEmptyState: ({ description }: { readonly description: ReactNode }) =>
    createElement("p", null, description),
  sanitizeMultilineInput: (value: string) => value,
  showWarningToast: vi.fn(),
}));

vi.mock("@/features/disputes", () => ({
  DisputeOnChainStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, `Chain: ${status}`),
  DisputeStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, status),
}));

vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({
    walletAddress: runtime.wallet.address,
    walletType: runtime.wallet.walletType,
  }),
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => runtime.wallet,
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
  getPlatformAdminOnChain: vi.fn(),
  isDisputeAdminOnChain: runtime.stellar.isDisputeAdminOnChain,
  markDisputedOnChain: runtime.stellar.markDisputedOnChain,
  resolveDisputeOnChain: runtime.stellar.resolveDisputeOnChain,
}));

vi.mock("@/core/stellar/explorer", () => ({
  getTxExplorerUrl: vi.fn(
    (transactionHash: string) => `https://stellar.expert/testnet/tx/${transactionHash}`,
  ),
}));
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

vi.mock("@repo/ui/components/highrable/v2-marketing", () => ({
  HighrableV2Metric: ({ label, value }: { readonly label: string; readonly value: ReactNode }) =>
    createElement("div", null, `${label}: ${value}`),
  SectionLabel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("span", null, children),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    variant: _variant,
    size: _size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly asChild?: boolean;
    readonly variant?: string;
    readonly size?: string;
  }) =>
    asChild && isValidElement(children)
      ? cloneElement(children, props)
      : createElement("button", props, children),
}));
vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => createElement("input", props),
}));
vi.mock("@repo/ui/components/ui/native-select", () => ({
  NativeSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => createElement("select", props),
  NativeSelectOption: ({ children, ...props }: OptionHTMLAttributes<HTMLOptionElement>) =>
    createElement("option", props, children),
}));
vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) =>
    createElement("textarea", props),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => createElement("span"),
  ExternalLink: () => createElement("span"),
  RotateCcw: () => createElement("span"),
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

import { AdminDisputeDetailPage } from "./admin-dispute-detail-page";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function withSettlementAcknowledgments(fetchMock: ReturnType<typeof vi.fn>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const nextResponse = (await fetchMock(input, init)) as Response | undefined;
    if (!nextResponse || !String(input).endsWith("/resolve") || !init?.body) {
      return nextResponse;
    }

    const request = JSON.parse(String(init.body)) as {
      readonly phase?: string;
      readonly operationId?: string;
      readonly transactionHash?: string;
    };
    if (request.phase !== "started" && request.phase !== "signed") {
      return nextResponse;
    }

    const body = (await nextResponse.json()) as {
      readonly phase?: string;
      readonly result?: Record<string, unknown>;
    };
    if (body.phase !== request.phase || !body.result) {
      return response(body, nextResponse.status);
    }

    const result = {
      ...body.result,
      operationId: request.operationId,
      ...(request.phase === "signed" && request.transactionHash
        ? { transactionHash: request.transactionHash }
        : {}),
    };
    return response({ ...body, result }, nextResponse.status);
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function renderDetail(disputeId = "dispute-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  runtime.queryClient = queryClient;

  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AdminDisputeDetailPage, { disputeId }),
    ),
  );
}

function rerenderDetail(
  rendered: { readonly rerender: (ui: ReactNode) => void },
  disputeId = "dispute-1",
): void {
  rendered.rerender(
    createElement(
      QueryClientProvider,
      { client: runtime.queryClient as QueryClient },
      createElement(AdminDisputeDetailPage, { disputeId }),
    ),
  );
}

function getReviewStatusSelect(): HTMLSelectElement {
  const control = screen.getByLabelText("Review status");
  if (!(control instanceof HTMLSelectElement)) {
    throw new Error("Expected review status select.");
  }
  return control;
}

function getReviewMessageInput(): HTMLTextAreaElement {
  const control = screen.getByLabelText("Optional review message");
  if (!(control instanceof HTMLTextAreaElement)) {
    throw new Error("Expected review message textarea.");
  }
  return control;
}

const resolvedDetail = {
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
    title: "Missing deliverable",
    description: "The deliverable was not provided.",
    evidenceAttachmentIds: [],
    relatedWorkSubmissionIds: [],
    relatedRevisionRequestIds: [],
    status: "resolved_client",
    onChainStatus: "marked",
    onChainEscrowId: "escrow-on-chain-1",
    openedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    resolutionNote: "Client refunded after review.",
    attachments: [],
  },
  timeline: [],
  assignmentEvents: [],
  settlementAttempts: [],
  job: null,
  milestone: null,
  escrow: { status: "disputed" },
};

const adminWallet = `G${"A".repeat(55)}`;

function createActiveDetail(
  overrides: {
    readonly dispute?: Record<string, unknown>;
    readonly timeline?: readonly Record<string, unknown>[];
    readonly settlementAttempts?: readonly Record<string, unknown>[];
  } = {},
) {
  return {
    ...resolvedDetail,
    dispute: {
      ...resolvedDetail.dispute,
      status: "open",
      assignedAdminWallet: adminWallet,
      ...overrides.dispute,
    },
    timeline: overrides.timeline ?? [],
    settlementAttempts: overrides.settlementAttempts ?? [],
  };
}

const secondAdminWallet = `G${"C".repeat(55)}`;
const historicalAdminWallet = `G${"D".repeat(55)}`;

function ownerMembership() {
  return {
    admins: [
      { wallet: adminWallet.toLowerCase(), accessState: "active" },
      { wallet: adminWallet, accessState: "active" },
      { wallet: secondAdminWallet, accessState: "active" },
      { wallet: historicalAdminWallet, accessState: "revoked" },
      { wallet: "GCLIENT", accessState: "active" },
      { wallet: "GFREELANCER", accessState: "active" },
    ],
    operations: [],
  };
}

function createAttachment(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    _id: id,
    _creationTime: 1,
    type: "pdf",
    name: `${id}.pdf`,
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
    url: null,
    ...overrides,
  };
}

describe("AdminDisputeDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    runtime.wallet.address = adminWallet;
    runtime.wallet.walletType = "external_wallet";
    runtime.wallet.walletState.isConnected = true;
    runtime.wallet.walletState.isTestnet = true;
    runtime.wallet.walletState.canWriteContracts = true;
    runtime.wallet.signTransaction.mockReset();
    runtime.protectedApiError.mockReset();
    runtime.session.isOwner = false;
    runtime.stellar.markDisputedOnChain.mockReset();
    runtime.stellar.isDisputeAdminOnChain.mockReset();
    runtime.stellar.isDisputeAdminOnChain.mockResolvedValue(true);
    runtime.stellar.resolveDisputeOnChain.mockReset();
  });

  it("renders the detail loading state before the HTTP read resolves", () => {
    let resolveResponse!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
      ),
    );

    renderDetail();

    expect(screen.getByRole("alert").textContent).toContain("Loading dispute detail");
    resolveResponse(response(resolvedDetail));
  });

  it.each([
    [400, "This dispute request is invalid."],
    [401, "Admin authentication is required before this dispute can be read."],
    [403, "Admin access is forbidden for this dispute request."],
    [404, "Dispute not found."],
  ])("distinguishes HTTP %s detail failures", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: message }, status)));

    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(message);
    });
  });

  it.each(["resolved_client", "resolved_freelancer", "split_resolution", "cancelled"])(
    "makes %s disputes read-only",
    async (status) => {
      const terminalDetail = {
        ...resolvedDetail,
        dispute: { ...resolvedDetail.dispute, status },
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(terminalDetail)));

      renderDetail();

      expect(await screen.findByText("No timeline events yet.")).toBeTruthy();
      expect(screen.queryByText("Moderator workflow")).toBeNull();
      expect(screen.queryByRole("button", { name: "Resolve On-Chain" })).toBeNull();
    },
  );

  it.each([
    ["under_review", "under_review"],
    ["awaiting_client_response", "awaiting_client_response"],
    ["awaiting_freelancer_response", "awaiting_freelancer_response"],
    ["open", "under_review"],
  ])("initializes review selection for %s as %s", async (status, expectedStatus) => {
    const detail = createActiveDetail({ dispute: { status } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(detail)));

    renderDetail();

    const reviewSelect = await screen.findByLabelText("Review status");
    if (!(reviewSelect instanceof HTMLSelectElement)) {
      throw new Error("Expected review status select.");
    }
    expect(reviewSelect.value).toBe(expectedStatus);
    expect(reviewSelect.querySelectorAll("option")).toHaveLength(3);
  });

  it.each([
    [undefined, "Unassigned"],
    [`G${"B".repeat(55)}`, "Other assigned admin"],
    [adminWallet, "Assigned participant"],
  ])("hides review controls for %s", async (assignedAdminWallet, _caseName) => {
    const detail = createActiveDetail({
      dispute: {
        assignedAdminWallet,
        ...(assignedAdminWallet === adminWallet ? { clientWallet: adminWallet } : {}),
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(detail)));

    renderDetail();

    await screen.findByText("No timeline events yet.");
    expect(screen.queryByText("Moderator workflow")).toBeNull();
  });

  it("does not render claim for participant or terminal cases", async () => {
    const participantDetail = createActiveDetail({
      dispute: { assignedAdminWallet: undefined, clientWallet: adminWallet },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(participantDetail)));

    renderDetail();

    await screen.findByText("No timeline events yet.");
    expect(screen.queryByRole("button", { name: "Claim Case" })).toBeNull();

    cleanup();
    const terminalDetail = createActiveDetail({
      dispute: { assignedAdminWallet: undefined, status: "resolved_client" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(terminalDetail)));
    renderDetail();

    await screen.findByText("No timeline events yet.");
    expect(screen.queryByRole("button", { name: "Claim Case" })).toBeNull();
  });

  it("filters duplicate and participant assignees and disables unavailable history", async () => {
    runtime.session.isOwner = true;
    const detail = createActiveDetail({
      dispute: { assignedAdminWallet: historicalAdminWallet },
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/admin/admins"
        ? Promise.resolve(response(ownerMembership()))
        : Promise.resolve(response(detail)),
    );
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();

    const assignment = await screen.findByLabelText("Assign case to dispute admin");
    if (!(assignment instanceof HTMLSelectElement)) {
      throw new Error("Expected detail assignment select.");
    }

    expect(assignment.disabled).toBe(false);
    expect(Array.from(assignment.options).map((option) => option.value)).toEqual([
      "",
      historicalAdminWallet,
      adminWallet,
      secondAdminWallet,
    ]);
    expect(assignment.options[1]?.disabled).toBe(true);
    expect(
      Array.from(assignment.options).filter((option) => option.value === adminWallet),
    ).toHaveLength(1);
    expect(Array.from(assignment.options).some((option) => option.value === "GCLIENT")).toBe(false);
    expect(Array.from(assignment.options).some((option) => option.value === "GFREELANCER")).toBe(
      false,
    );
  });

  it("requires a successful membership read before enabling detail assignment", async () => {
    runtime.session.isOwner = true;
    let resolveMembership!: (value: Response) => void;
    const membership = new Promise<Response>((resolve) => {
      resolveMembership = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/admin/admins"
        ? membership
        : Promise.resolve(response(createActiveDetail())),
    );
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();

    const assignment = await screen.findByLabelText("Assign case to dispute admin");
    expect(assignment).toHaveProperty("disabled", true);
    expect(
      screen.getByText(/Assignment remains disabled until membership is verified/),
    ).toBeTruthy();

    resolveMembership(response({ error: "Membership read failed." }, 500));
    await waitFor(() => {
      expect(screen.getByText(/Eligible dispute admins could not be loaded/)).toBeTruthy();
    });
    expect(assignment).toHaveProperty("disabled", true);
  });

  it.each([
    [
      "active settlement",
      createActiveDetail({ settlementAttempts: [{ _id: "attempt-1", status: "submitted" }] }),
      true,
    ],
    ["terminal case", createActiveDetail({ dispute: { status: "resolved_client" } }), false],
  ])("applies assignment lock rules for %s", async (_label, detail, shouldDisable) => {
    runtime.session.isOwner = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/admin/admins"
        ? Promise.resolve(response(ownerMembership()))
        : Promise.resolve(response(detail)),
    );
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();

    const assignment = await screen.findByLabelText("Assign case to dispute admin");
    expect(assignment).toHaveProperty("disabled", shouldDisable);
    if (shouldDisable) {
      expect(
        screen.getByText(/Reassignment is disabled while a settlement attempt is active/),
      ).toBeTruthy();
    }
  });

  it("posts exact detail assignment payloads and refreshes both assignment and status data", async () => {
    runtime.session.isOwner = true;
    const initialDetail = createActiveDetail();
    const updatedDetail = createActiveDetail({
      dispute: { assignedAdminWallet: secondAdminWallet },
    });
    let detailRead = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/admins") {
        return Promise.resolve(response(ownerMembership()));
      }
      if (url.endsWith("/assignment")) {
        expect(init?.body).toBe(JSON.stringify({ assignedAdminWallet: secondAdminWallet }));
        return Promise.resolve(response({ assignedAdminWallet: secondAdminWallet }));
      }
      detailRead += 1;
      return Promise.resolve(response(detailRead === 1 ? initialDetail : updatedDetail));
    });
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();
    const queryClient = runtime.queryClient;
    if (!queryClient) {
      throw new Error("Expected detail query client.");
    }
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const assignment = await screen.findByLabelText("Assign case to dispute admin");
    fireEvent.change(assignment, { target: { value: secondAdminWallet } });

    expect(await screen.findByText("Case assignment updated.")).toBeTruthy();
    expect((assignment as HTMLSelectElement).value).toBe(secondAdminWallet);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, {
      queryKey: ["admin", "disputes", adminWallet],
      refetchType: "none",
    });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
      queryKey: ["admin", "dispute", adminWallet, "dispute-1"],
      refetchType: "none",
    });
  });

  it("preserves backend assignment conflicts and never repeats a rejected write", async () => {
    runtime.session.isOwner = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/admins") {
        return Promise.resolve(response(ownerMembership()));
      }
      if (url.endsWith("/assignment")) {
        return Promise.resolve(response({ error: "A settlement attempt is active." }, 409));
      }
      return Promise.resolve(response(createActiveDetail()));
    });
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();
    const assignment = await screen.findByLabelText("Assign case to dispute admin");
    fireEvent.change(assignment, { target: { value: secondAdminWallet } });

    expect(await screen.findByText("A settlement attempt is active.")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/assignment")),
    ).toHaveLength(1);
  });

  it("offers read-only detail recovery after assignment succeeds but refresh fails", async () => {
    runtime.session.isOwner = true;
    let detailRead = 0;
    const updatedDetail = createActiveDetail({
      dispute: { assignedAdminWallet: secondAdminWallet },
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/admins") {
        return Promise.resolve(response(ownerMembership()));
      }
      if (url.endsWith("/assignment")) {
        return Promise.resolve(response({ assignedAdminWallet: secondAdminWallet }));
      }
      detailRead += 1;
      return detailRead === 1
        ? Promise.resolve(response(createActiveDetail()))
        : detailRead === 2
          ? Promise.resolve(response({ error: "Detail refresh failed." }, 400))
          : Promise.resolve(response(updatedDetail));
    });
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();
    const assignment = await screen.findByLabelText("Assign case to dispute admin");
    fireEvent.change(assignment, { target: { value: secondAdminWallet } });

    expect(await screen.findByText(/assignment was saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      ((await screen.findByLabelText("Assign case to dispute admin")) as HTMLSelectElement).value,
    ).toBe(secondAdminWallet);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/assignment")),
    ).toHaveLength(1);
  });

  it("resets the local review selection when the case changes", async () => {
    const firstDetail = createActiveDetail({
      dispute: { _id: "dispute-1", status: "under_review" },
    });
    const secondDetail = createActiveDetail({
      dispute: { _id: "dispute-2", status: "awaiting_freelancer_response" },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(firstDetail))
      .mockResolvedValueOnce(response(secondDetail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    const rendered = renderDetail("dispute-1");
    const reviewSelect = await screen.findByLabelText("Review status");
    if (!(reviewSelect instanceof HTMLSelectElement)) {
      throw new Error("Expected review status select.");
    }
    fireEvent.change(reviewSelect, { target: { value: "awaiting_client_response" } });
    expect(reviewSelect.value).toBe("awaiting_client_response");

    const queryClient = runtime.queryClient;
    if (!queryClient) {
      throw new Error("Expected detail query client.");
    }

    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AdminDisputeDetailPage, { disputeId: "dispute-2" }),
      ),
    );

    await waitFor(() => {
      expect(getReviewStatusSelect().value).toBe("awaiting_freelancer_response");
    });
  });

  it("submits exact review payloads, refreshes returned status/timeline, and skips Stellar", async () => {
    const initialDetail = createActiveDetail({ dispute: { status: "under_review" } });
    const updatedDetail = createActiveDetail({
      dispute: { status: "awaiting_client_response" },
      timeline: [
        {
          _id: "event-1",
          message: "Client response requested.",
          createdAt: 1_700_000_200_000,
          attachments: [],
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(initialDetail))
      .mockResolvedValueOnce(response({ success: true }))
      .mockResolvedValueOnce(response(updatedDetail));
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();
    const queryClient = runtime.queryClient;
    if (!queryClient) {
      throw new Error("Expected detail query client.");
    }
    const invalidateQueueSpy = vi.spyOn(queryClient, "invalidateQueries");

    await screen.findByText("Moderator workflow");
    fireEvent.change(screen.getByLabelText("Review status"), {
      target: { value: "awaiting_client_response" },
    });
    fireEvent.change(screen.getByLabelText("Optional review message"), {
      target: { value: "Please provide the missing acceptance details." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/admin/disputes/dispute-1/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            status: "awaiting_client_response",
            message: "Please provide the missing acceptance details.",
          }),
        }),
      );
    });
    expect(await screen.findByText("Client response requested.")).toBeTruthy();
    expect(getReviewMessageInput().value).toBe("");
    expect(getReviewStatusSelect().value).toBe("awaiting_client_response");
    expect(invalidateQueueSpy).toHaveBeenNthCalledWith(1, {
      queryKey: ["admin", "disputes", adminWallet],
      refetchType: "none",
    });
    expect(invalidateQueueSpy).toHaveBeenNthCalledWith(2, {
      queryKey: ["admin", "dispute", adminWallet, "dispute-1"],
      refetchType: "none",
    });
    expect(runtime.stellar.markDisputedOnChain).not.toHaveBeenCalled();
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
  });

  it.each(["under_review", "awaiting_client_response", "awaiting_freelancer_response"])(
    "permits a same-status review submission for %s",
    async (status) => {
      const detail = createActiveDetail({ dispute: { status } });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response(detail))
        .mockResolvedValueOnce(response({ success: true }))
        .mockResolvedValueOnce(response(detail));
      vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

      renderDetail();
      await screen.findByText("Moderator workflow");
      fireEvent.click(screen.getByRole("button", { name: "Update Status" }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenNthCalledWith(
          2,
          "/api/admin/disputes/dispute-1/status",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ status }),
          }),
        );
      });
      expect(await screen.findByText("Dispute review status updated.")).toBeTruthy();
    },
  );

  it("disables duplicate status submissions while the write is pending", async () => {
    const initialDetail = createActiveDetail();
    const updatedDetail = createActiveDetail({
      dispute: { status: "under_review" },
    });
    let resolveStatus!: (value: Response) => void;
    const pendingStatus = new Promise<Response>((resolve) => {
      resolveStatus = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(initialDetail))
      .mockReturnValueOnce(pendingStatus)
      .mockResolvedValueOnce(response(updatedDetail));
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();
    await screen.findByText("Moderator workflow");
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Update Status" }).getAttribute("disabled"),
      ).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveStatus(response({ success: true }));
    expect(await screen.findByText("Dispute review status updated.")).toBeTruthy();
  });

  it("preserves review drafts after a rejected write", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(createActiveDetail()))
      .mockResolvedValueOnce(response({ error: "Write rejected." }, 403));
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();
    await screen.findByText("Moderator workflow");
    fireEvent.change(screen.getByLabelText("Review status"), {
      target: { value: "awaiting_freelancer_response" },
    });
    fireEvent.change(screen.getByLabelText("Optional review message"), {
      target: { value: "Keep this draft." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Write rejected.");
    });
    expect(getReviewStatusSelect().value).toBe("awaiting_freelancer_response");
    expect(getReviewMessageInput().value).toBe("Keep this draft.");
    expect(runtime.protectedApiError).toHaveBeenCalled();
  });

  it("offers a read retry after a successful write has an unsuccessful refresh", async () => {
    const initialDetail = createActiveDetail();
    const refreshedDetail = createActiveDetail({
      dispute: { status: "awaiting_freelancer_response" },
      timeline: [
        {
          _id: "event-2",
          message: "Freelancer response requested.",
          createdAt: 1_700_000_300_000,
          attachments: [],
        },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(initialDetail))
      .mockResolvedValueOnce(response({ success: true }))
      .mockResolvedValueOnce(response({ error: "Refresh failed." }, 500))
      .mockResolvedValueOnce(response({ error: "Refresh failed." }, 500))
      .mockResolvedValueOnce(response({ error: "Refresh failed." }, 500))
      .mockResolvedValueOnce(response(refreshedDetail));
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();
    await screen.findByText("Moderator workflow");
    fireEvent.change(screen.getByLabelText("Review status"), {
      target: { value: "awaiting_freelancer_response" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("status was saved");
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Freelancer response requested.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/status"))).toHaveLength(1);
  });

  it("preserves an empty timeline and makes resolved disputes read-only", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(resolvedDetail)));

    renderDetail();

    expect(await screen.findByText("No timeline events yet.")).toBeTruthy();
    expect(screen.queryByText("Moderator workflow")).toBeNull();
    expect(screen.queryByRole("button", { name: "Resolve On-Chain" })).toBeNull();
    expect(screen.getByText(/Status: Resolved: Client/)).toBeTruthy();
  });

  it("renders case evidence independently from event evidence with descriptive links and metadata", async () => {
    const caseFile = createAttachment("case-proof", {
      name: "case-proof.pdf",
      url: "https://files.example.test/case-proof.pdf",
    });
    const externalLink = createAttachment("case-link", {
      name: "Design reference",
      type: "link",
      size: undefined,
      externalUrl: "https://example.test/design-reference",
    });
    const eventFile = createAttachment("event-proof", {
      name: "event-proof.pdf",
      url: "https://files.example.test/event-proof.pdf",
    });
    const detail = createActiveDetail({
      dispute: {
        evidenceAttachmentIds: ["case-proof", "case-link"],
        attachments: [caseFile, externalLink],
      },
      timeline: [
        {
          _id: "event-1",
          message: "Evidence was added during review.",
          createdAt: 1_700_000_200_000,
          attachmentIds: ["event-proof"],
          attachments: [eventFile],
        },
      ],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(detail)));

    renderDetail();

    expect(await screen.findByText("case-proof.pdf")).toBeTruthy();
    expect(screen.getByText("Design reference")).toBeTruthy();
    expect(screen.getByText("event-proof.pdf")).toBeTruthy();
    expect(screen.getAllByText("Uploaded by: GCLIENT")).toHaveLength(3);
    expect(screen.getAllByText("Size: 2 KB")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open case-proof.pdf" }).getAttribute("href")).toBe(
      "https://files.example.test/case-proof.pdf",
    );
    expect(screen.getByRole("link", { name: "Open Design reference" }).getAttribute("rel")).toBe(
      "noopener noreferrer",
    );
    expect(
      screen.getByRole("heading", { name: "Case evidence" }).parentElement?.textContent,
    ).toContain("case-proof.pdf");
    expect(
      screen.getByRole("heading", { name: "Case evidence" }).parentElement?.textContent,
    ).not.toContain("event-proof.pdf");
  });

  it("distinguishes empty evidence from missing, unusable, deleted, and blocked evidence", async () => {
    const detail = createActiveDetail({
      dispute: {
        evidenceAttachmentIds: ["missing", "null-url", "unsafe-link", "deleted", "blocked"],
        attachments: [
          createAttachment("null-url", { name: "No storage URL.pdf" }),
          createAttachment("unsafe-link", {
            name: "Unsafe reference",
            type: "link",
            externalUrl: "javascript:alert(1)",
          }),
          createAttachment("deleted", {
            name: "Deleted evidence.pdf",
            status: "deleted",
            url: "https://files.example.test/deleted.pdf",
          }),
          createAttachment("blocked", {
            name: "Blocked evidence.pdf",
            status: "blocked",
            url: "https://files.example.test/blocked.pdf",
          }),
        ],
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(detail)));

    renderDetail();

    expect(await screen.findAllByText("Evidence unavailable")).toHaveLength(5);
    expect(screen.queryByText("No evidence attached.")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open No storage URL.pdf" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open Unsafe reference" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open Deleted evidence.pdf" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open Blocked evidence.pdf" })).toBeNull();
  });

  it("renders an explicit empty case-evidence state", async () => {
    const detail = createActiveDetail({
      dispute: { evidenceAttachmentIds: [], attachments: [] },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(detail)));

    renderDetail();

    expect(await screen.findByText("No evidence attached.")).toBeTruthy();
  });

  it("refreshes detail evidence and status without writes or Stellar calls", async () => {
    const initialDetail = createActiveDetail({
      dispute: {
        status: "under_review",
        evidenceAttachmentIds: ["old-proof"],
        attachments: [createAttachment("old-proof", { name: "old-proof.pdf" })],
      },
    });
    const refreshedDetail = createActiveDetail({
      dispute: {
        status: "awaiting_client_response",
        evidenceAttachmentIds: ["new-proof"],
        attachments: [createAttachment("new-proof", { name: "new-proof.pdf" })],
      },
    });
    const refreshed = createDeferred<Response>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(initialDetail))
      .mockReturnValueOnce(refreshed.promise);
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();
    expect(await screen.findByText("old-proof.pdf")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh detail" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Refreshing..." }).getAttribute("disabled"),
      ).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Refreshing..." }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    refreshed.resolve(response(refreshedDetail));

    expect(await screen.findByText("new-proof.pdf")).toBeTruthy();
    expect(screen.queryByText("old-proof.pdf")).toBeNull();
    expect(screen.getByText("Awaiting Client")).toBeTruthy();
    expect(
      fetchMock.mock.calls.slice(1).every(([, init]) => (init as RequestInit).method === "GET"),
    ).toBe(true);
    expect(runtime.stellar.markDisputedOnChain).not.toHaveBeenCalled();
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
  });

  it.each([
    [404, "Dispute not found."],
    [403, "Admin access is forbidden for this dispute request."],
  ] as const)(
    "removes loaded evidence after a detail refresh returns %s",
    async (status, message) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          response(
            createActiveDetail({
              dispute: {
                evidenceAttachmentIds: ["loaded-proof"],
                attachments: [createAttachment("loaded-proof", { name: "loaded-proof.pdf" })],
              },
            }),
          ),
        )
        .mockResolvedValueOnce(response({ error: message }, status));
      vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

      renderDetail();
      expect(await screen.findByText("loaded-proof.pdf")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Refresh detail" }));

      expect((await screen.findByRole("alert")).textContent).toContain(message);
      expect(screen.queryByText("loaded-proof.pdf")).toBeNull();
      if (status === 404) {
        expect(screen.getByRole("link", { name: "Return to the dispute queue" })).toBeTruthy();
      }
    },
  );

  it("keeps a failed detail refresh recoverable", async () => {
    const recoveredDetail = createActiveDetail({
      dispute: {
        evidenceAttachmentIds: ["recovered-proof"],
        attachments: [createAttachment("recovered-proof", { name: "recovered-proof.pdf" })],
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(createActiveDetail()))
      .mockResolvedValueOnce(response({ error: "Temporary detail failure." }, 500))
      .mockResolvedValueOnce(response({ error: "Temporary detail failure." }, 500))
      .mockResolvedValueOnce(response({ error: "Temporary detail failure." }, 500))
      .mockResolvedValueOnce(response(recoveredDetail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();
    await screen.findByText("Case evidence");
    fireEvent.click(screen.getByRole("button", { name: "Refresh detail" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Temporary detail failure.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("recovered-proof.pdf")).toBeTruthy();
  });

  it.each(["", "-1", "1.5", "1e3", "5000bps", "10000"])(
    "preserves invalid split input %s and blocks settlement",
    async (input) => {
      const fetchMock = vi.fn().mockResolvedValue(response(createActiveDetail()));
      vi.stubGlobal("fetch", fetchMock);

      renderDetail();
      await screen.findByText("Resolve dispute on-chain");
      fireEvent.change(screen.getByLabelText("Resolution"), {
        target: { value: "split_resolution" },
      });

      const shareInput = screen.getByLabelText("Freelancer share in basis points");
      if (!(shareInput instanceof HTMLInputElement)) {
        throw new Error("Expected freelancer share input.");
      }
      fireEvent.change(shareInput, { target: { value: input } });

      expect(shareInput.value).toBe(input);
      expect(shareInput.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByText(/whole-number freelancer share|whole-number digits/)).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Resolve On-Chain" }).getAttribute("disabled"),
      ).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
    },
  );

  it.each(["open", "under_review", "awaiting_client_response", "awaiting_freelancer_response"])(
    "enables settlement controls for review status %s when all context is valid",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(response(createActiveDetail({ dispute: { status } }))),
      );

      renderDetail();

      const resolveButton = await screen.findByRole("button", { name: "Resolve On-Chain" });
      expect(resolveButton.getAttribute("disabled")).toBeNull();
    },
  );

  it.each([
    ["not_marked", "marked on-chain"],
    ["marking", "marked on-chain"],
    ["mark_failed", "marked on-chain"],
  ] as const)("blocks settlement while marking is %s", async (onChainStatus, explanation) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(createActiveDetail({ dispute: { onChainStatus } })));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();

    const resolveButton = await screen.findByRole("button", { name: "Resolve On-Chain" });
    expect(resolveButton.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByText(new RegExp(explanation))).toBeTruthy();
    fireEvent.click(resolveButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
  });

  it("preserves recovery controls while blocking a new settlement attempt", async () => {
    const detail = {
      ...createActiveDetail(),
      settlementAttempts: [
        {
          _id: "attempt-1",
          status: "submitted",
          actorWallet: adminWallet,
          operationId: "resolve_dispute:pending",
          transactionHash: "tx-pending",
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(response(detail));
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();

    expect(await screen.findByRole("button", { name: "Reconcile" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Resolve On-Chain" }).getAttribute("disabled"),
    ).not.toBeNull();
    expect(screen.getByText(/pending reconciliation/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
  });

  it("reconciles a pending attempt without invoking Stellar execution", async () => {
    const detail = {
      ...createActiveDetail(),
      settlementAttempts: [
        {
          _id: "attempt-1",
          status: "submitted",
          actorWallet: adminWallet,
          operationId: "resolve_dispute:pending",
          transactionHash: "a".repeat(64),
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({ status: "pending", result: { status: "submission_unknown" } }, 202),
      )
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Reconcile" }));

    expect(await screen.findByText(/Settlement is unresolved/)).toBeTruthy();
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({ phase: "reconcile", operationId: "resolve_dispute:pending" }),
      }),
    );
  });

  it("does not show settlement success for a verified failed outcome", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:dispute-1:test", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: { operationId: "resolve_dispute:dispute-1:test", transactionHash: "tx-failed" },
        }),
      )
      .mockResolvedValueOnce(response({ status: "failed", result: true }))
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly onSigned: (value: {
          readonly transactionHash: string;
          readonly transactionValidUntil: number;
        }) => Promise<void>;
      }) => {
        await args.onSigned({ transactionHash: "tx-failed", transactionValidUntil: 123 });
        return { txHash: "tx-failed" };
      },
    );

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

    expect(await screen.findByText(/Settlement failed on Stellar/)).toBeTruthy();
    expect(
      screen.queryByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeNull();
  });

  it("records simulation failure before allowing a later settlement attempt", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:dispute-1:test", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(response({ success: true, phase: "failed", result: true }))
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain.mockRejectedValueOnce(
      new Error("Transaction simulation failed: invalid escrow state"),
    );

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

    expect(await screen.findByText(/Transaction simulation failed/)).toBeTruthy();
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({ body: expect.stringContaining('"phase":"failed"') }),
    );
  });

  it("executes a new operation after failure bookkeeping succeeds", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:attempt-1", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(response({ success: true, phase: "failed", result: true }))
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:attempt-2", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: { operationId: "resolve_dispute:attempt-2", transactionHash: "b".repeat(64) },
        }),
      )
      .mockResolvedValueOnce(
        response({ status: "succeeded", result: { status: "resolved_client" } }),
      )
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain
      .mockRejectedValueOnce(new Error("Transaction simulation failed."))
      .mockImplementationOnce(
        async (args: {
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          await args.onSigned({
            transactionHash: "b".repeat(64),
            transactionValidUntil: 123,
          });
          return { txHash: "b".repeat(64) };
        },
      );

    renderDetail();
    const resolveButton = await screen.findByRole("button", { name: "Resolve On-Chain" });
    fireEvent.click(resolveButton);
    expect(await screen.findByText(/Transaction simulation failed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Resolve On-Chain" }));

    expect(
      await screen.findByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeTruthy();
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(2);
    const operationIds = runtime.stellar.resolveDisputeOnChain.mock.calls.map(
      ([args]) => (args as { readonly operationId: string }).operationId,
    );
    expect(operationIds[0]).toMatch(/^resolve_dispute:dispute-1:/);
    expect(operationIds[1]).toMatch(/^resolve_dispute:dispute-1:/);
    expect(operationIds[0]).not.toBe(operationIds[1]);
  });

  it("allows a new operation after wallet signing rejection is recorded", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const transactionHash = "b".repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:sign-rejected", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(response({ success: true, phase: "failed", result: true }))
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:sign-retry", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: { operationId: "resolve_dispute:sign-retry", transactionHash },
        }),
      )
      .mockResolvedValueOnce(
        response({ status: "succeeded", result: { status: "resolved_client" } }),
      )
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain
      .mockRejectedValueOnce(new Error("User rejected the wallet signature."))
      .mockImplementationOnce(
        async (args: {
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          await args.onSigned({ transactionHash, transactionValidUntil: 123 });
          return { txHash: transactionHash };
        },
      );

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
    expect(await screen.findByText(/User rejected the wallet signature/)).toBeTruthy();
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({ body: expect.stringContaining('"phase":"failed"') }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve On-Chain" }));

    expect(
      await screen.findByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeTruthy();
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(2);
  });

  it("permits a fresh chain attempt after a verified failed settlement outcome", async () => {
    const activeDetail = createActiveDetail({ dispute: { status: "under_review" } });
    const transactionHashOne = "1".repeat(64);
    const transactionHashTwo = "2".repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(activeDetail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:verified-failure", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: {
            operationId: "resolve_dispute:verified-failure",
            transactionHash: transactionHashOne,
          },
        }),
      )
      .mockResolvedValueOnce(response({ status: "failed", result: true }))
      .mockResolvedValueOnce(response(activeDetail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:verified-retry", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: {
            operationId: "resolve_dispute:verified-retry",
            transactionHash: transactionHashTwo,
          },
        }),
      )
      .mockResolvedValueOnce(
        response({ status: "succeeded", result: { status: "resolved_client" } }),
      )
      .mockResolvedValueOnce(response(resolvedDetail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain
      .mockImplementationOnce(
        async (args: {
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          await args.onSigned({ transactionHash: transactionHashOne, transactionValidUntil: 123 });
          return { txHash: transactionHashOne };
        },
      )
      .mockImplementationOnce(
        async (args: {
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          await args.onSigned({ transactionHash: transactionHashTwo, transactionValidUntil: 123 });
          return { txHash: transactionHashTwo };
        },
      );

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
    expect(await screen.findByText(/Settlement failed on Stellar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resolve On-Chain" }));

    expect(
      await screen.findByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeTruthy();
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(2);
  });

  it("renders coordinator phases, signed identity, explorer context, and blocks duplicate clicks", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const simulation = createDeferred<void>();
    const signing = createDeferred<void>();
    const submission = createDeferred<void>();
    const confirmation = createDeferred<void>();
    const startedRecording = createDeferred<Response>();
    const signedRecording = createDeferred<Response>();
    const finalRecording = createDeferred<Response>();
    const transactionHash = "c".repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockReturnValueOnce(startedRecording.promise)
      .mockReturnValueOnce(signedRecording.promise)
      .mockReturnValueOnce(finalRecording.promise)
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly onPhase: (phase: "simulation" | "signing" | "submission" | "confirmation") => void;
        readonly onSigned: (value: {
          readonly transactionHash: string;
          readonly transactionValidUntil: number;
        }) => Promise<void>;
      }) => {
        args.onPhase("simulation");
        await simulation.promise;
        args.onPhase("signing");
        await signing.promise;
        await args.onSigned({ transactionHash, transactionValidUntil: 123 });
        args.onPhase("submission");
        await submission.promise;
        args.onPhase("confirmation");
        await confirmation.promise;
        return { txHash: transactionHash };
      },
    );

    renderDetail();
    const resolveButton = await screen.findByRole("button", { name: "Resolve On-Chain" });
    fireEvent.click(resolveButton);
    expect(await screen.findByText("Preparing settlement")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Resolving..." }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Resolving..." }));
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(0);
    startedRecording.resolve(
      response({
        success: true,
        phase: "started",
        result: { operationId: "resolve_dispute:phase-test", freelancerShareBps: 0 },
      }),
    );
    expect(await screen.findByText("Simulating transaction")).toBeTruthy();
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(1);

    simulation.resolve();
    expect(await screen.findByText("Waiting for wallet signature")).toBeTruthy();
    signing.resolve();
    expect(await screen.findByText("Recording signed transaction")).toBeTruthy();
    expect(await screen.findByText(transactionHash)).toBeTruthy();
    signedRecording.resolve(
      response({
        success: true,
        phase: "signed",
        result: { operationId: "resolve_dispute:phase-test", transactionHash },
      }),
    );
    expect(await screen.findByText("Submitting transaction")).toBeTruthy();
    const transactionLink = screen.getByRole("link", { name: transactionHash });
    expect(transactionLink.getAttribute("href")).toBe(
      `https://stellar.expert/testnet/tx/${transactionHash}`,
    );
    submission.resolve();
    expect(await screen.findByText("Waiting for Stellar confirmation")).toBeTruthy();
    confirmation.resolve();

    expect(await screen.findByText("Recording verified settlement")).toBeTruthy();
    finalRecording.resolve(
      response({ status: "succeeded", result: { status: "resolved_client" } }),
    );
    expect(
      await screen.findByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeTruthy();
  });

  it("keeps signed context when identity recording fails and reconciles without resubmitting", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const transactionHash = "d".repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:signed-failure", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(response({ error: "Signed identity unavailable." }, 500))
      .mockResolvedValueOnce(
        response({ status: "pending", result: { status: "submission_unknown" } }, 202),
      )
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    const phases: string[] = [];
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly onPhase: (phase: "simulation" | "signing" | "submission" | "confirmation") => void;
        readonly onSigned: (value: {
          readonly transactionHash: string;
          readonly transactionValidUntil: number;
        }) => Promise<void>;
      }) => {
        args.onPhase("signing");
        phases.push("signing");
        await args.onSigned({ transactionHash, transactionValidUntil: 123 });
        phases.push("submission");
        return { txHash: transactionHash };
      },
    );

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

    expect(await screen.findByText(/Settlement is unresolved/)).toBeTruthy();
    expect(screen.getByText(transactionHash)).toBeTruthy();
    expect(phases).toEqual(["signing"]);
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        body: expect.stringContaining('"phase":"reconcile"'),
      }),
    );
  });

  it.each(["submission", "confirmation"] as const)(
    "reconciles %s uncertainty with the known hash and no second chain execution",
    async (uncertainPhase) => {
      const detail = createActiveDetail({ dispute: { status: "under_review" } });
      const transactionHash = "e".repeat(64);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response(detail))
        .mockResolvedValueOnce(
          response({
            success: true,
            phase: "started",
            result: { operationId: "resolve_dispute:uncertain", freelancerShareBps: 0 },
          }),
        )
        .mockResolvedValueOnce(
          response({
            success: true,
            phase: "signed",
            result: { operationId: "resolve_dispute:uncertain", transactionHash },
          }),
        )
        .mockResolvedValueOnce(
          response({ status: "pending", result: { status: "submission_unknown" } }, 202),
        )
        .mockResolvedValueOnce(response(detail));
      vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
      runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
        async (args: {
          readonly onPhase: (
            phase: "simulation" | "signing" | "submission" | "confirmation",
          ) => void;
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          await args.onSigned({ transactionHash, transactionValidUntil: 123 });
          args.onPhase(uncertainPhase);
          throw Object.assign(new Error(`${uncertainPhase} timed out.`), {
            txHash: transactionHash,
          });
        },
      );

      renderDetail();
      fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

      expect(await screen.findByText(/Settlement is unresolved/)).toBeTruthy();
      expect(screen.getByText(transactionHash)).toBeTruthy();
      expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/resolve"))).toHaveLength(
        3,
      );
      expect(fetchMock.mock.calls[3]?.[1]).toEqual(
        expect.objectContaining({ body: expect.stringContaining('"phase":"reconcile"') }),
      );
    },
  );

  it("recovers final-recording failure through reconciliation and refreshes terminal detail", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const transactionHash = "f".repeat(64);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:final-failure", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: { operationId: "resolve_dispute:final-failure", transactionHash },
        }),
      )
      .mockResolvedValueOnce(response({ error: "Final recording unavailable." }, 500))
      .mockResolvedValueOnce(
        response({ status: "succeeded", result: { status: "resolved_client" } }),
      )
      .mockResolvedValueOnce(response(resolvedDetail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly onSigned: (value: {
          readonly transactionHash: string;
          readonly transactionValidUntil: number;
        }) => Promise<void>;
      }) => {
        await args.onSigned({ transactionHash, transactionValidUntil: 123 });
        return { txHash: transactionHash };
      },
    );

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

    expect(await screen.findByText("No timeline events yet.")).toBeTruthy();
    expect(
      await screen.findByText("Dispute settlement was verified on Stellar and recorded."),
    ).toBeTruthy();
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[4]?.[1]).toEqual(
      expect.objectContaining({ body: expect.stringContaining('"phase":"reconcile"') }),
    );
  });

  it("keeps reconciliation recoverable and never invokes Stellar on repeated recovery failure", async () => {
    const detail = {
      ...createActiveDetail(),
      settlementAttempts: [
        {
          _id: "attempt-1",
          status: "submitted",
          actorWallet: adminWallet,
          operationId: "resolve_dispute:recovery-failure",
          transactionHash: "a".repeat(64),
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(response({ error: "Recovery unavailable." }, 500))
      .mockResolvedValueOnce(response({ error: "Recovery still unavailable." }, 500));
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Reconcile" }));
    expect(await screen.findByText(/Recovery unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reconcile" }));

    await waitFor(() => {
      expect(screen.getByText(/Recovery still unavailable/)).toBeTruthy();
    });
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/resolve"))).toHaveLength(
      2,
    );
  });

  it.each([
    ["resolved_client", "", 0],
    ["resolved_freelancer", "", 10_000],
    ["split_resolution", "1", 1],
    ["split_resolution", "9999", 9999],
  ] as const)(
    "submits the settlement boundary %s at %s bps",
    async (status, input, expectedBps) => {
      const detail = createActiveDetail({ dispute: { status: "under_review" } });
      const transactionHash = `${expectedBps}`.padStart(64, "0");
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(response(detail))
        .mockResolvedValueOnce(
          response({
            success: true,
            phase: "started",
            result: { operationId: "resolve_dispute:boundary", freelancerShareBps: expectedBps },
          }),
        )
        .mockResolvedValueOnce(
          response({
            success: true,
            phase: "signed",
            result: { operationId: "resolve_dispute:boundary", transactionHash },
          }),
        )
        .mockResolvedValueOnce(
          response({ status: "succeeded", result: { status, freelancerShareBps: expectedBps } }),
        )
        .mockResolvedValueOnce(response(detail));
      vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
      runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
        async (args: {
          readonly freelancerShareBps: number;
          readonly onSigned: (value: {
            readonly transactionHash: string;
            readonly transactionValidUntil: number;
          }) => Promise<void>;
        }) => {
          await args.onSigned({ transactionHash, transactionValidUntil: 123 });
          return { txHash: transactionHash };
        },
      );

      renderDetail();
      await screen.findByText("Resolve dispute on-chain");
      if (status !== "resolved_client") {
        fireEvent.change(screen.getByLabelText("Resolution"), { target: { value: status } });
      }
      if (status === "split_resolution") {
        fireEvent.change(screen.getByLabelText("Freelancer share in basis points"), {
          target: { value: input },
        });
      }
      fireEvent.click(screen.getByRole("button", { name: "Resolve On-Chain" }));

      await waitFor(() => {
        expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledWith(
          expect.objectContaining({ freelancerShareBps: expectedBps }),
        );
        expect(fetchMock.mock.calls[1]?.[1]).toEqual(
          expect.objectContaining({
            body: expect.stringContaining(`"freelancerShareBps":${expectedBps}`),
          }),
        );
      });
    },
  );

  it("submits the selected split basis points through the existing settlement flow", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:dispute-1:test", freelancerShareBps: 4321 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: {
            operationId: "resolve_dispute:dispute-1:test",
            transactionHash: "tx-settlement",
          },
        }),
      )
      .mockResolvedValueOnce(
        response({
          status: "succeeded",
          result: { status: "split_resolution", freelancerShareBps: 4321 },
        }),
      )
      .mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly freelancerShareBps: number;
        readonly onSigned: (value: {
          readonly transactionHash: string;
          readonly transactionValidUntil: number;
        }) => Promise<void>;
      }) => {
        await args.onSigned({ transactionHash: "tx-settlement", transactionValidUntil: 123 });
        return { txHash: "tx-settlement" };
      },
    );

    renderDetail();
    await screen.findByText("Resolve dispute on-chain");
    fireEvent.change(screen.getByLabelText("Resolution"), {
      target: { value: "split_resolution" },
    });
    fireEvent.change(screen.getByLabelText("Freelancer share in basis points"), {
      target: { value: "4321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolve On-Chain" }));

    await waitFor(() => {
      expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledWith(
        expect.objectContaining({ freelancerShareBps: 4321, walletType: "external_wallet" }),
      );
    });
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        body: expect.stringContaining('"freelancerShareBps":4321'),
      }),
    );
  });

  it("offers a read-only retry after successful settlement recording cannot refresh detail", async () => {
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "resolve_dispute:dispute-1:test", freelancerShareBps: 0 },
        }),
      )
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "signed",
          result: { operationId: "resolve_dispute:dispute-1:test", transactionHash: "tx-success" },
        }),
      )
      .mockResolvedValueOnce(
        response({ status: "succeeded", result: { status: "resolved_client" } }),
      )
      .mockResolvedValueOnce(response({ error: "Refresh failed." }, 500))
      .mockResolvedValueOnce(response({ error: "Refresh failed." }, 500))
      .mockResolvedValueOnce(response({ error: "Refresh failed." }, 500))
      .mockResolvedValueOnce(response(resolvedDetail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly onSigned: (value: {
          readonly transactionHash: string;
          readonly transactionValidUntil: number;
        }) => Promise<void>;
      }) => {
        await args.onSigned({ transactionHash: "tx-success", transactionValidUntil: 123 });
        return { txHash: "tx-success" };
      },
    );

    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));

    expect(await screen.findByText(/settlement will not be repeated/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(7);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No timeline events yet.")).toBeTruthy();
    expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it.each([
    [
      "wallet replacement",
      (): void => {
        runtime.wallet.address = secondAdminWallet;
      },
    ],
    [
      "disconnect",
      (): void => {
        runtime.wallet.walletState.isConnected = false;
      },
    ],
    [
      "network change",
      (): void => {
        runtime.wallet.walletState.isTestnet = false;
      },
    ],
    [
      "wallet mode change",
      (): void => {
        runtime.wallet.walletType = "passkey_smart_account";
      },
    ],
  ] as const)(
    "does not continue after a %s during membership preparation",
    async (_label, change) => {
      const membership = createDeferred<boolean>();
      const detail = createActiveDetail({ dispute: { status: "under_review" } });
      const fetchMock = vi.fn().mockResolvedValueOnce(response(detail));
      vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
      runtime.stellar.isDisputeAdminOnChain.mockReturnValueOnce(membership.promise);

      const rendered = renderDetail();
      fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
      await waitFor(() => {
        expect(runtime.stellar.isDisputeAdminOnChain).toHaveBeenCalledTimes(1);
      });

      change();
      rerenderDetail(rendered);
      membership.resolve(true);

      await waitFor(() => {
        expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("does not let an obsolete membership callback continue after a case replacement", async () => {
    const membership = createDeferred<boolean>();
    const firstDetail = createActiveDetail({ dispute: { status: "under_review" } });
    const secondDetail = createActiveDetail({ dispute: { _id: "dispute-2" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(firstDetail))
      .mockResolvedValueOnce(response(secondDetail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.isDisputeAdminOnChain.mockReturnValueOnce(membership.promise);

    const rendered = renderDetail("dispute-1");
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
    await waitFor(() => {
      expect(runtime.stellar.isDisputeAdminOnChain).toHaveBeenCalledTimes(1);
    });

    rerenderDetail(rendered, "dispute-2");
    membership.resolve(true);

    await waitFor(() => {
      expect(screen.getByText("Resolve dispute on-chain")).toBeTruthy();
    });
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not start Stellar execution when start recording resolves after the context changes", async () => {
    const startedRecording = createDeferred<Response>();
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockReturnValueOnce(startedRecording.promise);
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));

    const rendered = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    runtime.wallet.walletState.isTestnet = false;
    rerenderDetail(rendered);
    startedRecording.resolve(
      response({
        success: true,
        phase: "started",
        result: { operationId: "obsolete", freelancerShareBps: 0 },
      }),
    );

    await waitFor(() => {
      expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks signing when the wallet context changes before the signer runs", async () => {
    const signing = createDeferred<string>();
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "obsolete", freelancerShareBps: 0 },
        }),
      );
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.wallet.signTransaction.mockReturnValueOnce(signing.promise);
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly onPhase: (phase: "simulation" | "signing") => void;
        readonly signTransaction: (xdr: string) => Promise<string>;
      }) => {
        args.onPhase("signing");
        await args.signTransaction("prepared-xdr");
      },
    );

    const rendered = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
    await waitFor(() => {
      expect(runtime.wallet.signTransaction).toHaveBeenCalledTimes(1);
    });

    runtime.wallet.address = secondAdminWallet;
    rerenderDetail(rendered);
    signing.resolve("signed-xdr");

    await waitFor(() => {
      expect(runtime.stellar.resolveDisputeOnChain).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not submit after signed-identity recording becomes obsolete", async () => {
    const signedRecording = createDeferred<Response>();
    const transactionHash = "a".repeat(64);
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(detail))
      .mockResolvedValueOnce(
        response({
          success: true,
          phase: "started",
          result: { operationId: "obsolete", freelancerShareBps: 0 },
        }),
      )
      .mockReturnValueOnce(signedRecording.promise);
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    let submissionReached = false;
    runtime.stellar.resolveDisputeOnChain.mockImplementationOnce(
      async (args: {
        readonly onSigned: (value: {
          readonly transactionHash: string;
          readonly transactionValidUntil: number;
        }) => Promise<void>;
      }) => {
        await args.onSigned({ transactionHash, transactionValidUntil: 123 });
        submissionReached = true;
      },
    );

    const rendered = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    runtime.wallet.walletState.isConnected = false;
    rerenderDetail(rendered);
    signedRecording.resolve(
      response({
        success: true,
        phase: "signed",
        result: { operationId: "obsolete", transactionHash },
      }),
    );

    await waitFor(() => {
      expect(submissionReached).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("isolates an unmounted settlement callback", async () => {
    const membership = createDeferred<boolean>();
    const detail = createActiveDetail({ dispute: { status: "under_review" } });
    const fetchMock = vi.fn().mockResolvedValueOnce(response(detail));
    vi.stubGlobal("fetch", withSettlementAcknowledgments(fetchMock));
    runtime.stellar.isDisputeAdminOnChain.mockReturnValueOnce(membership.promise);

    const rendered = renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve On-Chain" }));
    await waitFor(() => {
      expect(runtime.stellar.isDisputeAdminOnChain).toHaveBeenCalledTimes(1);
    });
    rendered.unmount();
    membership.resolve(true);

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runtime.stellar.resolveDisputeOnChain).not.toHaveBeenCalled();
  });

  it("resets resolution drafts when switching cases", async () => {
    const firstDetail = createActiveDetail({ dispute: { _id: "dispute-1" } });
    const secondDetail = createActiveDetail({ dispute: { _id: "dispute-2" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(firstDetail))
      .mockResolvedValueOnce(response(secondDetail));
    vi.stubGlobal("fetch", fetchMock);

    const rendered = renderDetail("dispute-1");
    await screen.findByText("Resolve dispute on-chain");
    fireEvent.change(screen.getByLabelText("Resolution"), {
      target: { value: "split_resolution" },
    });
    fireEvent.change(screen.getByLabelText("Freelancer share in basis points"), {
      target: { value: "4321" },
    });
    fireEvent.change(screen.getByLabelText("Resolution note"), {
      target: { value: "Keep this settlement draft." },
    });

    const queryClient = runtime.queryClient;
    if (!queryClient) {
      throw new Error("Expected detail query client.");
    }
    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AdminDisputeDetailPage, { disputeId: "dispute-2" }),
      ),
    );

    await waitFor(() => {
      const resolution = screen.getByLabelText("Resolution");
      const share = screen.getByLabelText("Freelancer share in basis points");
      const note = screen.getByLabelText("Resolution note");
      if (
        !(resolution instanceof HTMLSelectElement) ||
        !(share instanceof HTMLInputElement) ||
        !(note instanceof HTMLTextAreaElement)
      ) {
        throw new Error("Expected resolution controls.");
      }
      expect(resolution.value).toBe("resolved_client");
      expect(share.value).toBe("0");
      expect(note.value).toBe("");
    });
  });
});
