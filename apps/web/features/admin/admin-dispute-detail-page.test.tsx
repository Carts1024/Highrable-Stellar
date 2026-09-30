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
    walletState: {
      isConnected: true,
      isTestnet: true,
      canWriteContracts: true,
    },
    signTransaction: vi.fn(),
  },
  protectedApiError: vi.fn(),
  stellar: {
    markDisputedOnChain: vi.fn(),
    resolveDisputeOnChain: vi.fn(),
  },
  queryClient: null as QueryClient | null,
}));

vi.mock("@/features/admin/admin-session-gate", () => ({
  ADMIN_QUERY_KEY: ["admin"],
  AdminSessionGate: ({ children }: { readonly children: ReactNode }) => children,
  useAdminSessionAccess: () => ({
    verifiedWallet: `G${"A".repeat(55)}`,
    isOwner: false,
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
    walletType: "external_wallet" as const,
  }),
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => runtime.wallet,
}));

vi.mock("@/core/config/stellar-contracts", () => ({
  getRequiredEscrowActionConfig: () => ({
    rpcUrl: "http://localhost",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: `C${"A".repeat(55)}`,
  }),
}));

vi.mock("@/core/stellar/escrow-contract", () => ({
  getPlatformAdminOnChain: vi.fn(),
  markDisputedOnChain: runtime.stellar.markDisputedOnChain,
  resolveDisputeOnChain: runtime.stellar.resolveDisputeOnChain,
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
  escrow: null,
};

const adminWallet = `G${"A".repeat(55)}`;

function createActiveDetail(
  overrides: {
    readonly dispute?: Record<string, unknown>;
    readonly timeline?: readonly Record<string, unknown>[];
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
  };
}

describe("AdminDisputeDetailPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    runtime.protectedApiError.mockReset();
    runtime.stellar.markDisputedOnChain.mockReset();
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
    vi.stubGlobal("fetch", fetchMock);

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
    expect(invalidateQueueSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "disputes", adminWallet],
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
      vi.stubGlobal("fetch", fetchMock);

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
});
