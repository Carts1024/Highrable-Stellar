import { env } from "@/core/config/env";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminAccessError } from "./server-auth";

const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";

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

  const message = error instanceof Error ? error.message : "Unexpected admin API error.";
  return NextResponse.json({ error: message }, { status: 500 });
}
