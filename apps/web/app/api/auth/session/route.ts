import { noStore } from "@/core/member/server-api";
import { AUTH_SESSION_COOKIE_NAME } from "@/core/wallet/server/auth-store";
import { createMemberConvexClient, getMemberServiceSecret } from "@/core/wallet/server/convex";
import { getPersistedSessionFromRequest } from "@/core/wallet/server/persisted-session";
import { assertSameOrigin, SameOriginError } from "@/core/wallet/server/same-origin";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionId) {
    return noStore(
      NextResponse.json({ authenticated: false, status: "anonymous" }, { status: 200 }),
    );
  }

  try {
    const result = await getPersistedSessionFromRequest(request);
    if (!result) {
      const response = noStore(
        NextResponse.json({ authenticated: false, status: "expired" }, { status: 200 }),
      );
      response.cookies.set({
        name: AUTH_SESSION_COOKIE_NAME,
        value: "",
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
      return response;
    }

    return noStore(
      NextResponse.json(
        {
          authenticated: true,
          status: "authenticated",
          address: result.session.walletAddress,
          walletType: result.session.walletType,
          authMethod: result.session.authMethod,
          expiresAt: new Date(result.session.expiresAt).toISOString(),
          profile: result.session.profile,
          onboardingEligible: Boolean(
            result.session.profile?.onboardingCompletedAt && result.session.profile.name?.trim(),
          ),
        },
        { status: 200 },
      ),
    );
  } catch {
    return noStore(
      NextResponse.json(
        { authenticated: false, status: "error", error: "Authentication service is unavailable." },
        { status: 503 },
      ),
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return noStore(NextResponse.json({ error: error.message }, { status: error.status }));
    }
    throw error;
  }
  const sessionId = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value?.trim();
  try {
    if (sessionId) {
      await createMemberConvexClient().mutation(api.auth.revokeSession, {
        serviceSecret: getMemberServiceSecret(),
        sessionId,
      });
    }
  } catch {
    // Always clear the browser credential even when the backend is unavailable.
  }

  const response = noStore(NextResponse.json({ authenticated: false, status: "anonymous" }));
  response.cookies.set({
    name: AUTH_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
