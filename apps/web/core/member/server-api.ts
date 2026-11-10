import { getMemberServiceSecret, createMemberConvexClient } from "@/core/wallet/server/convex";
import {
  requireWalletRequestContext,
  WalletRequestAuthError,
} from "@/core/wallet/server/request-auth";
import { SameOriginError } from "@/core/wallet/server/same-origin";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";

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

  const message = error instanceof Error ? error.message : "Member request failed.";
  const status = /already|taken|conflict/i.test(message)
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
