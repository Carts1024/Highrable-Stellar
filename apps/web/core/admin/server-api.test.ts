import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { createAdminErrorResponse } from "./server-api";

describe("admin Convex error mapping", () => {
  it("maps structured NOT_FOUND errors to HTTP 404", async () => {
    const response = createAdminErrorResponse(
      new ConvexError({ code: "NOT_FOUND", message: "Dispute not found." }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Dispute not found." });
  });

  it("maps structured forbidden errors without inspecting message text", async () => {
    const response = createAdminErrorResponse(
      new ConvexError({ code: "FORBIDDEN", message: "Any server-provided explanation." }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Any server-provided explanation." });
  });
});
