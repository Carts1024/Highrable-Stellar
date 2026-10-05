// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/features/admin/components/admin-operations-ui", () => ({
  AdminSection: ({ title, children }: { readonly title: string; readonly children?: ReactNode }) =>
    createElement("section", undefined, createElement("h2", undefined, title), children),
  AdminMetricRail: ({ items }: { readonly items: readonly { label: string; value: number }[] }) =>
    createElement(
      "div",
      undefined,
      items.map((item) => `${item.label}: ${item.value}`),
    ),
  AdminDisputeQueue: ({
    disputes,
    emptyState,
  }: {
    readonly disputes: readonly { disputeId: string; title: string }[];
    readonly emptyState: ReactNode;
  }) =>
    disputes.length > 0
      ? createElement(
          "div",
          { "data-testid": "protected-queue-records" },
          disputes.map((dispute) => createElement("p", { key: dispute.disputeId }, dispute.title)),
        )
      : emptyState,
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
    runtime.wallet.authSession = null;
    runtime.wallet.authenticateWallet.mockReset();
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
