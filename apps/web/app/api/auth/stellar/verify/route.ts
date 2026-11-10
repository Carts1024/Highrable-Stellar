import { env } from "@/core/config/env";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { NextRequest } from "next/server";

import {
  AUTH_BROWSER_BINDING_COOKIE_NAME,
  AUTH_CHALLENGE_COOKIE_NAME,
  AUTH_SESSION_COOKIE_NAME,
  createOpaqueId,
  getClientAddress,
} from "@/core/wallet/server/auth-store";
import { createMemberConvexClient, getMemberServiceSecret } from "@/core/wallet/server/convex";
import { assertSameOrigin } from "@/core/wallet/server/same-origin";
import { verifyStellarMessageSignature } from "@/core/wallet/server/signature";
import { TVerifyRequestSchema } from "@/core/wallet/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const payload = TVerifyRequestSchema.parse((await request.json()) as unknown);
    const challengeId = request.cookies.get(AUTH_CHALLENGE_COOKIE_NAME)?.value;
    const browserBinding = request.cookies.get(AUTH_BROWSER_BINDING_COOKIE_NAME)?.value;
    if (!challengeId || !browserBinding) {
      return NextResponse.json({ error: "Challenge not found or expired." }, { status: 401 });
    }

    const convex = createMemberConvexClient();
    const serviceSecret = getMemberServiceSecret();
    const rate = await convex.mutation(api.auth.consumeRateLimit, {
      serviceSecret,
      key: `verify:${getClientAddress(request)}:${payload.address}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many authentication attempts. Try again in a minute." },
        { status: 429 },
      );
    }

    const challenge = await convex.query(api.auth.getChallenge, {
      serviceSecret,
      challengeId,
      browserBinding,
    });
    if (
      !challenge ||
      challenge.authMethod !== "external_wallet" ||
      challenge.message !== payload.message ||
      challenge.nonce !== payload.nonce ||
      challenge.walletAddress !== payload.address ||
      challenge.expiresAt <= Date.now()
    ) {
      return NextResponse.json({ error: "Challenge payload mismatch or expiration." }, { status: 401 });
    }

    if (
      !verifyStellarMessageSignature({
        address: payload.address,
        message: payload.message,
        signature: payload.signature,
      })
    ) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const sessionId = createOpaqueId();
    const session = await convex.mutation(api.auth.consumeChallengeAndCreateSession, {
      serviceSecret,
      challengeId,
      browserBinding,
      walletAddress: payload.address,
      walletType: "external_wallet",
      authMethod: "external_wallet",
      nonce: payload.nonce,
      sessionId,
    });
    const persistedSession = await convex.query(api.auth.getSession, {
      serviceSecret,
      sessionId,
    });
    const response = NextResponse.json(
      {
        address: session.walletAddress,
        walletType: "external_wallet",
        authMethod: "external_wallet",
        expiresAt: new Date(session.expiresAt).toISOString(),
        profile: persistedSession?.profile ?? null,
      },
      { status: 200 },
    );
    response.cookies.set({
      name: AUTH_SESSION_COOKIE_NAME,
      value: sessionId,
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 24 * 60 * 60,
      expires: new Date(session.expiresAt),
    });
    response.cookies.set({
      name: AUTH_CHALLENGE_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: 0,
      expires: new Date(0),
    });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Cross-origin")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && /already been used|not found|expired|mismatch/i.test(error.message)) {
      return NextResponse.json({ error: "Challenge not found, expired, or already used." }, { status: 401 });
    }
    console.error("Failed to verify Stellar authentication.");
    return NextResponse.json(
      { error: "Authentication service is unavailable. Try again shortly." },
      { status: 503 },
    );
  }
}
