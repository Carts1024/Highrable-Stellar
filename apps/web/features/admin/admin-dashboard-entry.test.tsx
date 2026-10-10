// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React, { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ButtonHTMLAttributes, ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  router: {
    replace: vi.fn(),
  },
  wallet: {
    authSession: null as { address: string; token: string; expiresAt: string } | null,
    authenticateWallet: vi.fn<() => Promise<void>>(),
    logoutWallet: vi.fn(),
    walletState: {
      status: "connected" as "connected" | "idle" | "connecting",
      walletAddress: `G${"A".repeat(55)}` as string | null,
      isConnected: true,
      isConnecting: false,
    },
  },
  identity: {
    walletType: "external_wallet" as "external_wallet" | "passkey_smart_account",
    activeWalletMode: "external_wallet" as "external_wallet" | "passkey_smart_account",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => runtime.router,
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

vi.mock("./admin-dashboard-page", () => ({
  AdminDashboardContent: () =>
    createElement("div", { "data-testid": "platform-dashboard" }, "Platform dashboard"),
}));

import { AdminDashboardEntry } from "./admin-dashboard-entry";

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderEntry() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDashboardEntry />
    </QueryClientProvider>,
  );
}

function ownerSession(overrides: Record<string, unknown> = {}) {
  return {
    adminWallet: runtime.wallet.walletState.walletAddress,
    isOwner: true,
    isDisputeAdmin: true,
    ...overrides,
  };
}

describe("AdminDashboardEntry", () => {
  beforeEach(() => {
    runtime.router.replace.mockReset();
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

  it("redirects a verified dispute-only admin without mounting platform metrics", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, ownerSession({ isOwner: false })));
    vi.stubGlobal("fetch", fetchMock);

    renderEntry();

    await waitFor(() => expect(runtime.router.replace).toHaveBeenCalledWith("/admin/disputes"));
    expect(screen.queryByTestId("platform-dashboard")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/session");
  });

  it("keeps the verified owner on the platform dashboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, ownerSession()));
    vi.stubGlobal("fetch", fetchMock);

    renderEntry();

    expect(await screen.findByTestId("platform-dashboard")).toBeTruthy();
    expect(runtime.router.replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pending authentication", response(401, { error: "Authentication required." })],
    [
      "an unauthorized wallet",
      response(200, ownerSession({ isOwner: false, isDisputeAdmin: false })),
    ],
  ])("does not navigate or mount metrics for %s", async (_caseName, sessionResponse) => {
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse);
    vi.stubGlobal("fetch", fetchMock);

    renderEntry();

    expect(
      await screen.findByRole("heading", {
        name: /Authentication required|Admin access forbidden/,
      }),
    ).toBeTruthy();
    expect(runtime.router.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("platform-dashboard")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not navigate or mount metrics while the signed session belongs to another wallet", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, ownerSession({ adminWallet: `G${"B".repeat(55)}` })));
    vi.stubGlobal("fetch", fetchMock);

    renderEntry();

    expect(
      await screen.findByRole("heading", { name: "Authenticate connected admin wallet" }),
    ).toBeTruthy();
    expect(runtime.router.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("platform-dashboard")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not check admin access or navigate in passkey mode", async () => {
    runtime.identity.walletType = "passkey_smart_account";
    runtime.identity.activeWalletMode = "passkey_smart_account";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderEntry();

    expect(
      await screen.findByRole("heading", { name: "Use an external admin wallet" }),
    ).toBeTruthy();
    expect(runtime.router.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("platform-dashboard")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
