import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testConfig = vi.hoisted(() => ({
  adminWallet: `G${"B".repeat(55)}`,
  convexSecret: "test-convex-secret",
  sessionSecret: "test-session-secret",
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

vi.mock("@/core/config/env", () => ({
  env: {
    HIGHRABLE_ADMIN_WALLET_ADDRESS: testConfig.adminWallet,
    HIGHRABLE_ADMIN_CONVEX_SECRET: testConfig.convexSecret,
    WALLET_SESSION_SECRET: testConfig.sessionSecret,
    NODE_ENV: "test",
    NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
  },
}));

vi.mock("../config/env", () => ({
  env: {
    HIGHRABLE_ADMIN_WALLET_ADDRESS: testConfig.adminWallet,
    HIGHRABLE_ADMIN_CONVEX_SECRET: testConfig.convexSecret,
    WALLET_SESSION_SECRET: testConfig.sessionSecret,
    NODE_ENV: "test",
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_APP_DOMAIN: "http://localhost:3000",
  },
}));

import { GET as getAdminSession } from "../../app/api/admin/session/route";
import { AUTH_SESSION_COOKIE_NAME, createSessionToken } from "../wallet/server/auth-store";
import { requireAdminRequestContext } from "./server-auth";

const nonAdminWallet = `G${"C".repeat(55)}`;

function requestWithToken(token?: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/session", {
    headers: token ? { cookie: `${AUTH_SESSION_COOKIE_NAME}=${token}` } : undefined,
  });
}

describe("admin server authorization", () => {
  beforeEach(() => {
    vi.useRealTimers();
    testConfig.queryAdminCapabilities.mockReset();
  });

  it("rejects a missing session with 401", () => {
    expect(() => requireAdminRequestContext(requestWithToken())).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("rejects expired and tampered sessions with 401", () => {
    const expired = createSessionToken(testConfig.adminWallet);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
    expect(() => requireAdminRequestContext(requestWithToken(expired.token))).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
    vi.useRealTimers();

    const valid = createSessionToken(testConfig.adminWallet);
    const tampered = `${valid.token.slice(0, -1)}${valid.token.endsWith("a") ? "b" : "a"}`;
    expect(() => requireAdminRequestContext(requestWithToken(tampered))).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("accepts a valid signed session for an external wallet and leaves authorization to Convex", () => {
    const session = createSessionToken(nonAdminWallet);

    expect(requireAdminRequestContext(requestWithToken(session.token))).toEqual({
      adminWallet: nonAdminWallet,
      adminApiSecret: testConfig.convexSecret,
    });
  });

  it("accepts the configured wallet without consulting the database role", () => {
    const session = createSessionToken(testConfig.adminWallet);

    expect(requireAdminRequestContext(requestWithToken(session.token))).toEqual({
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
    const session = createSessionToken(testConfig.adminWallet);
    const response = await getAdminSession(requestWithToken(session.token));

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
    const session = createSessionToken(nonAdminWallet);
    const response = await getAdminSession(requestWithToken(session.token));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
