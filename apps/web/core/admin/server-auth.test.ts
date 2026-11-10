import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testConfig = vi.hoisted(() => ({
  adminWallet: `G${"B".repeat(55)}`,
  convexSecret: "test-convex-secret",
  getPersistedSession: vi.fn(),
  queryAdminCapabilities: vi.fn(),
}));

vi.mock("@/core/admin/server-api", async () => {
  const { NextResponse } = await import("next/server");
  return {
    createAdminConvexClient: () => ({ query: testConfig.queryAdminCapabilities }),
    createAdminErrorResponse: (error: unknown) =>
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Request failed." },
        { status: 500 },
      ),
  };
});

vi.mock("@repo/convex-client/server", () => ({
  api: { admin: { getAdminCapabilities: "admin.getAdminCapabilities" } },
}));

vi.mock("@/core/wallet/server/persisted-session", () => ({
  getPersistedSessionFromRequest: testConfig.getPersistedSession,
}));

vi.mock("@/core/config/env", () => ({
  env: {
    HIGHRABLE_ADMIN_WALLET_ADDRESS: testConfig.adminWallet,
    HIGHRABLE_ADMIN_CONVEX_SECRET: testConfig.convexSecret,
    NODE_ENV: "test",
    NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
  },
}));

vi.mock("../config/env", () => ({
  env: {
    HIGHRABLE_ADMIN_WALLET_ADDRESS: testConfig.adminWallet,
    HIGHRABLE_ADMIN_CONVEX_SECRET: testConfig.convexSecret,
    NODE_ENV: "test",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_APP_DOMAIN: "http://localhost:3000",
  },
}));

import type { TAuthSessionRecord } from "../wallet/server/session-types";

import { GET as getAdminSession } from "../../app/api/admin/session/route";
import { AUTH_SESSION_COOKIE_NAME } from "../wallet/server/auth-store";
import { requireAdminRequestContext } from "./server-auth";

const nonAdminWallet = `G${"C".repeat(55)}`;

function requestWithToken(token?: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/session", {
    headers: token ? { cookie: `${AUTH_SESSION_COOKIE_NAME}=${token}` } : undefined,
  });
}

function persistedSession(
  walletAddress: string,
  sessionId = "session-1",
): { sessionId: string; session: TAuthSessionRecord } {
  return {
    sessionId,
    session: {
      sessionId,
      walletAddress,
      walletType: "external_wallet",
      authMethod: "external_wallet",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      profile: null,
    },
  };
}

describe("admin server authorization", () => {
  beforeEach(() => {
    vi.useRealTimers();
    testConfig.getPersistedSession.mockReset();
    testConfig.queryAdminCapabilities.mockReset();
  });

  it("rejects a missing session with 401", async () => {
    await expect(requireAdminRequestContext(requestWithToken())).rejects.toThrowError(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("rejects revoked or unknown session IDs with 401", async () => {
    testConfig.getPersistedSession.mockResolvedValue(null);
    await expect(
      requireAdminRequestContext(requestWithToken("expired-session")),
    ).rejects.toThrowError(expect.objectContaining({ status: 401 }));
    await expect(
      requireAdminRequestContext(requestWithToken("tampered-session")),
    ).rejects.toThrowError(expect.objectContaining({ status: 401 }));
  });

  it("accepts a valid persisted session for an external wallet and leaves authorization to Convex", async () => {
    testConfig.getPersistedSession.mockResolvedValue(persistedSession(nonAdminWallet));

    await expect(requireAdminRequestContext(requestWithToken("session-1"))).resolves.toEqual({
      adminWallet: nonAdminWallet,
      adminApiSecret: testConfig.convexSecret,
    });
  });

  it("accepts the configured wallet without consulting the database role", async () => {
    testConfig.getPersistedSession.mockResolvedValue(persistedSession(testConfig.adminWallet));

    await expect(requireAdminRequestContext(requestWithToken("session-1"))).resolves.toEqual({
      adminWallet: testConfig.adminWallet,
      adminApiSecret: testConfig.convexSecret,
    });
  });

  it("returns verified capabilities and disables HTTP caching", async () => {
    testConfig.queryAdminCapabilities.mockResolvedValue({
      adminWallet: testConfig.adminWallet,
      isOwner: true,
      isDisputeAdmin: true,
    });
    testConfig.getPersistedSession.mockResolvedValue(persistedSession(testConfig.adminWallet));
    const response = await getAdminSession(requestWithToken("session-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      adminWallet: testConfig.adminWallet,
      isOwner: true,
      isDisputeAdmin: true,
    });
  });

  it("rejects a signed wallet without current dispute-admin capability", async () => {
    testConfig.queryAdminCapabilities.mockResolvedValue({
      adminWallet: nonAdminWallet,
      isOwner: false,
      isDisputeAdmin: false,
    });
    testConfig.getPersistedSession.mockResolvedValue(persistedSession(nonAdminWallet));
    const response = await getAdminSession(requestWithToken("session-1"));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
