import { api } from "@repo/convex-client/server";

import { createMemberConvexClient, getMemberServiceSecret } from "./convex";
import { AUTH_SESSION_COOKIE_NAME } from "./auth-store";

import type { TAuthSessionRecord } from "./session-types";
import type { NextRequest } from "next/server";

export async function getPersistedSession(sessionId: string): Promise<TAuthSessionRecord | null> {
  const result = await createMemberConvexClient().query(api.auth.getSession, {
    serviceSecret: getMemberServiceSecret(),
    sessionId,
  });
  return result as TAuthSessionRecord | null;
}

export async function getPersistedSessionFromRequest(
  request: NextRequest,
): Promise<{ sessionId: string; session: TAuthSessionRecord } | null> {
  const sessionId = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionId) {
    return null;
  }
  const session = await getPersistedSession(sessionId);
  return session ? { sessionId, session } : null;
}
