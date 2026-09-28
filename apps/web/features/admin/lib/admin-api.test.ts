import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminApiError, fetchAdminSession } from "./admin-api";

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
});
