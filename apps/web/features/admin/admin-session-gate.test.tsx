// @vitest-environment jsdom

import { AdminApiError } from "@/features/admin/lib/admin-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ButtonHTMLAttributes, ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  wallet: {
    authSession: null as { address: string; token: string; expiresAt: string } | null,
    authenticateWallet: vi.fn<() => Promise<void>>(),
    logoutWallet: vi.fn(),
    walletState: {
      status: "connected" as "connected" | "idle",
      walletAddress: `G${"A".repeat(55)}` as string | null,
      isConnected: true as boolean,
      isConnecting: false as boolean,
    },
  },
  identity: {
    walletType: "external_wallet" as const,
    activeWalletMode: "external_wallet" as const,
  },
}));

vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => runtime.wallet,
}));

vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => runtime.identity,
}));

vi.mock("@/features/common", () => ({
  RouteCallout: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
  RoutePanel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("section", undefined, children),
  RoutePanelHeader: ({
    title,
    description,
  }: {
    readonly title: string;
    readonly description: string;
  }) => createElement("header", undefined, createElement("h1", undefined, title), description),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement("button", props, children),
}));

import { AdminSessionGate, useAdminSessionAccess } from "./admin-session-gate";

function response(status: number, body: unknown): Response {
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

function renderGate(requiredCapability: "owner" | "dispute" = "dispute") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AdminSessionGate requiredCapability={requiredCapability}>
        <div data-testid="protected-content">Protected dispute console</div>
      </AdminSessionGate>
    </QueryClientProvider>,
  );

  return { ...rendered, queryClient };
}

describe("AdminSessionGate", () => {
  beforeEach(() => {
    runtime.wallet.walletState = {
      status: "connected",
      walletAddress: `G${"A".repeat(55)}`,
      isConnected: true,
      isConnecting: false,
    };
    runtime.wallet.authSession = null;
    runtime.wallet.authenticateWallet.mockReset();
    runtime.wallet.logoutWallet.mockReset();
    runtime.identity.walletType = "external_wallet";
    runtime.identity.activeWalletMode = "external_wallet";
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps protected content unmounted until server verification succeeds", async () => {
    const pending = createDeferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));

    renderGate();

    expect(screen.queryByTestId("protected-content")).toBeNull();
    expect(screen.getByRole("heading", { name: "Checking admin access" })).toBeTruthy();

    pending.resolve(
      response(200, {
        adminWallet: runtime.wallet.walletState.walletAddress,
        isOwner: true,
        isDisputeAdmin: true,
      }),
    );

    await waitFor(() => expect(screen.getByTestId("protected-content")).toBeTruthy());
  });

  it("shows forbidden access and never trusts a database-role-shaped client state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(403, { error: "Admin access is forbidden." })),
    );

    renderGate();

    expect(await screen.findByRole("heading", { name: "Admin access forbidden" })).toBeTruthy();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("keeps malformed successful sessions closed until a manual retry returns a valid session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, {
          adminWallet: runtime.wallet.walletState.walletAddress,
          isOwner: "true",
          isDisputeAdmin: true,
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          adminWallet: runtime.wallet.walletState.walletAddress,
          isOwner: true,
          isDisputeAdmin: true,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderGate();

    expect(await screen.findByRole("heading", { name: "Admin access check failed" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("protected-content")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry access check" }));

    await waitFor(() => expect(screen.getByTestId("protected-content")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("authenticates the connected wallet when the signed session belongs to another wallet", async () => {
    const connectedWallet = runtime.wallet.walletState.walletAddress;
    const previousWallet = `G${"B".repeat(55)}`;
    runtime.wallet.authenticateWallet.mockResolvedValue();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response(200, {
            adminWallet: previousWallet,
            isOwner: true,
            isDisputeAdmin: true,
          }),
        )
        .mockResolvedValueOnce(
          response(200, {
            adminWallet: connectedWallet,
            isOwner: false,
            isDisputeAdmin: true,
          }),
        ),
    );

    renderGate();

    expect(
      await screen.findByText(
        "The signed session belongs to a different wallet. Authenticate the connected external wallet to check its admin access.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("protected-content")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Authenticate Wallet" }));

    await waitFor(() => expect(screen.getByTestId("protected-content")).toBeTruthy());
    expect(runtime.wallet.authenticateWallet).toHaveBeenCalledTimes(1);
  });

  it("disables duplicate authentication and rechecks access after authentication", async () => {
    const authenticate = createDeferred<void>();
    runtime.wallet.authenticateWallet.mockReturnValue(authenticate.promise);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(401, { error: "Authentication required." }))
        .mockResolvedValueOnce(
          response(200, {
            adminWallet: runtime.wallet.walletState.walletAddress,
            isOwner: true,
            isDisputeAdmin: true,
          }),
        ),
    );

    renderGate();
    const button = await screen.findByRole("button", { name: "Authenticate Wallet" });
    fireEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);

    authenticate.resolve();
    await waitFor(() => expect(screen.getByTestId("protected-content")).toBeTruthy());
    expect(runtime.wallet.authenticateWallet).toHaveBeenCalledTimes(1);
  });

  it("clears protected content on disconnect and ignores an earlier identity response", async () => {
    const first = createDeferred<Response>();
    const second = createDeferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);

    const rendered = renderGate();
    runtime.wallet.walletState = {
      status: "connected",
      walletAddress: `G${"B".repeat(55)}`,
      isConnected: true,
      isConnecting: false,
    };
    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: rendered.queryClient },
        createElement(
          AdminSessionGate,
          null,
          createElement("div", { "data-testid": "protected-content" }, "Protected dispute console"),
        ),
      ),
    );

    expect(screen.queryByTestId("protected-content")).toBeNull();
    first.resolve(
      response(200, {
        adminWallet: `G${"A".repeat(55)}`,
        isOwner: true,
        isDisputeAdmin: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByTestId("protected-content")).toBeNull();
    second.resolve(
      response(200, {
        adminWallet: `G${"B".repeat(55)}`,
        isOwner: false,
        isDisputeAdmin: true,
      }),
    );
    await waitFor(() => expect(screen.getByTestId("protected-content")).toBeTruthy());

    runtime.wallet.walletState = {
      status: "idle",
      walletAddress: null,
      isConnected: false,
      isConnecting: false,
    };
    rendered.rerender(
      createElement(
        QueryClientProvider,
        { client: rendered.queryClient },
        createElement(
          AdminSessionGate,
          null,
          createElement("div", { "data-testid": "protected-content" }, "Protected dispute console"),
        ),
      ),
    );
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("removes protected content when an API 401 is reported by a child", async () => {
    function ProtectedChild() {
      const { handleProtectedApiError } = useAdminSessionAccess();
      return createElement(
        "button",
        { onClick: () => handleProtectedApiError(new AdminApiError(401, "Session expired.")) },
        "Invalidate session",
      );
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(200, {
          adminWallet: runtime.wallet.walletState.walletAddress,
          isOwner: true,
          isDisputeAdmin: true,
        }),
      ),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AdminSessionGate, null, createElement(ProtectedChild)),
      ),
    );

    await screen.findByRole("button", { name: "Invalidate session" });
    fireEvent.click(screen.getByRole("button", { name: "Invalidate session" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Authentication required" })).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "Invalidate session" })).toBeNull();
  });

  it("keeps owner-only pages closed to a dispute admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(200, {
          adminWallet: runtime.wallet.walletState.walletAddress,
          isOwner: false,
          isDisputeAdmin: true,
        }),
      ),
    );

    renderGate("owner");

    expect(await screen.findByRole("heading", { name: "Admin access forbidden" })).toBeTruthy();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });
});
