import { getMemberServiceSecret, createMemberConvexClient } from "@/core/wallet/server/convex";
import {
  requireWalletRequestContext,
  WalletRequestAuthError,
} from "@/core/wallet/server/request-auth";
import { SameOriginError } from "@/core/wallet/server/same-origin";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { NextRequest } from "next/server";

export async function requireMember(request: NextRequest) {
  return await requireWalletRequestContext(request);
}

export function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Vary", "Cookie");
  return response;
}

export function memberErrorResponse(error: unknown): NextResponse {
  if (error instanceof SameOriginError) {
    return noStore(NextResponse.json({ error: error.message }, { status: error.status }));
  }
  if (error instanceof WalletRequestAuthError) {
    return noStore(NextResponse.json({ error: error.message }, { status: error.status }));
  }

  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    const status = error.status;
    if ([400, 401, 403, 404, 409, 429, 503].includes(status)) {
      return noStore(NextResponse.json({ error: error.message }, { status }));
    }
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return noStore(NextResponse.json({ error: "Invalid request payload." }, { status: 400 }));
  }

  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data;
    if (typeof data === "object" && data !== null && "code" in data) {
      const code = data.code;
      const statusByCode: Record<string, number> = {
        BAD_REQUEST: 400,
        NOT_FOUND: 404,
        FORBIDDEN: 403,
        CONFLICT: 409,
        RATE_LIMIT: 429,
      };
      if (typeof code === "string" && code in statusByCode) {
        const message =
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Member request failed.";
        return noStore(NextResponse.json({ error: message }, { status: statusByCode[code] }));
      }
    }
  }

  const message = error instanceof Error ? error.message : "Member request failed.";
  const status = /rate limit|try again in a minute|too many/i.test(message)
    ? 429
    : /unavailable|not found/i.test(message)
      ? 404
      : /forbidden|restricted|not allowed|complete your named profile/i.test(message)
        ? 403
        : /already|taken|conflict/i.test(message)
          ? 409
          : /required|invalid|expired|upload|profile|onboarding|registration/i.test(message)
            ? 400
            : 500;
  return noStore(NextResponse.json({ error: message }, { status }));
}

export function memberServiceArgs() {
  return { serviceSecret: getMemberServiceSecret() };
}

export { api, createMemberConvexClient };
