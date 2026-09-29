import { env } from "@/core/config/env";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminAccessError } from "./server-auth";

const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";

type TStructuredConvexError = {
  readonly code: "BAD_REQUEST" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT";
  readonly message?: string;
};

function getStructuredConvexError(error: unknown): TStructuredConvexError | null {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return null;
  }

  const data = error.data;
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }

  const code = data.code;
  if (
    code !== "BAD_REQUEST" &&
    code !== "NOT_FOUND" &&
    code !== "FORBIDDEN" &&
    code !== "CONFLICT"
  ) {
    return null;
  }

  return {
    code,
    message: "message" in data && typeof data.message === "string" ? data.message : undefined,
  };
}

export function createAdminConvexClient(): ConvexHttpClient {
  const convexUrl = env.NEXT_PUBLIC_CONVEX_URL.trim() || DEFAULT_CONVEX_URL;
  return new ConvexHttpClient(convexUrl, {
    logger: false,
    skipConvexDeploymentUrlCheck: env.NODE_ENV !== "production",
  });
}

export function createAdminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Invalid request payload.", details: error.issues },
      { status: 400 },
    );
  }

  const structuredError = getStructuredConvexError(error);
  if (structuredError) {
    const statusByCode = {
      BAD_REQUEST: 400,
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      CONFLICT: 409,
    } as const;

    return NextResponse.json(
      { error: structuredError.message ?? "Admin request failed." },
      { status: statusByCode[structuredError.code] },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected admin API error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
