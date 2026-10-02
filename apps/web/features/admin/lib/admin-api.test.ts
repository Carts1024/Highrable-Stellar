import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminApiError,
  fetchAdminDisputes,
  fetchAdminSession,
  isAdminNetworkError,
  postAdminResolution,
} from "./admin-api";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("admin API client errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([401, 403, 404, 500])("preserves HTTP status %s", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "request failed" }, status)),
    );

    await expect(fetchAdminSession()).rejects.toEqual(
      expect.objectContaining<Partial<AdminApiError>>({
        name: "AdminApiError",
        status,
        message: "request failed",
      }),
    );
  });

  it("keeps a structured response body on the typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: "Dispute not found.", details: { code: "NOT_FOUND" } }, 404),
        ),
    );

    await expect(fetchAdminSession()).rejects.toMatchObject({
      status: 404,
      details: { code: "NOT_FOUND" },
    });
  });

  it("normalizes network failures into the admin error boundary type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await fetchAdminSession().catch((nextError: unknown) => nextError);

    expect(isAdminNetworkError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 0,
      message: "Could not reach the admin API. Check your connection and retry.",
    });
  });

  it("serializes only typed dispute filters and the bounded queue limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ disputes: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAdminDisputes({
      status: "under_review",
      onChainStatus: "mark_failed",
      limit: 120,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/disputes?status=under_review&onChainStatus=mark_failed&limit=120",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it.each([
    [202, { status: "pending", result: { status: "submission_unknown" } }, "pending"],
    [200, { status: "succeeded", result: { status: "resolved_client" } }, "succeeded"],
    [200, { status: "failed", result: true }, "failed"],
  ] as const)("returns the recognized settlement outcome %s", async (status, body, outcome) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, status)));

    await expect(
      postAdminResolution("dispute-1", { phase: "reconcile", operationId: "operation-123" }),
    ).resolves.toMatchObject({ status: outcome });
  });

  it("rejects a successful HTTP response that does not identify a settlement outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true }, 200)));

    await expect(
      postAdminResolution("dispute-1", { phase: "succeeded", operationId: "operation-123" }),
    ).rejects.toMatchObject({
      name: "AdminApiError",
      message: "Admin API returned an unrecognized settlement outcome.",
    });
  });
});
