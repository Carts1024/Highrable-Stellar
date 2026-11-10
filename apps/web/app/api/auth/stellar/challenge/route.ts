import { env } from "@/core/config/env";
import {
  AUTH_BROWSER_BINDING_COOKIE_NAME,
  AUTH_CHALLENGE_COOKIE_NAME,
  CHALLENGE_TTL_MS,
  buildExternalChallengeMessage,
  createOpaqueId,
  getClientAddress,
} from "@/core/wallet/server/auth-store";
import { createMemberConvexClient, getMemberServiceSecret } from "@/core/wallet/server/convex";
import { assertSameOrigin } from "@/core/wallet/server/same-origin";
import { TChallengeRequestSchema } from "@/core/wallet/validation";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const payload = TChallengeRequestSchema.parse((await request.json()) as unknown);
    const browserBinding =
      request.cookies.get(AUTH_BROWSER_BINDING_COOKIE_NAME)?.value ?? createOpaqueId();
    const now = Date.now();
    const expiresAt = now + CHALLENGE_TTL_MS;
    const nonce = createOpaqueId();
    const challengeId = createOpaqueId();
    const message = buildExternalChallengeMessage({
      address: payload.address,
      nonce,
      issuedAt: now,
      expiresAt,
    });
    const convex = createMemberConvexClient();
    const serviceSecret = getMemberServiceSecret();
    const rate = await convex.mutation(api.auth.consumeRateLimit, {
      serviceSecret,
      key: `challenge:${getClientAddress(request)}:${payload.address}`,
      limit: 5,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many authentication attempts. Try again in a minute." },
        { status: 429 },
      );
    }

    await convex.mutation(api.auth.createChallenge, {
      serviceSecret,
      challengeId,
      nonce,
      message,
      walletAddress: payload.address,
      walletType: "external_wallet",
      authMethod: "external_wallet",
      browserBinding,
      expiresAt,
    });

    const response = NextResponse.json(
      { nonce, message, expiresAt: new Date(expiresAt).toISOString() },
      { status: 200 },
    );
    response.cookies.set({
      name: AUTH_BROWSER_BINDING_COOKIE_NAME,
      value: browserBinding,
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set({
      name: AUTH_CHALLENGE_COOKIE_NAME,
      value: challengeId,
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: Math.floor(CHALLENGE_TTL_MS / 1000),
      expires: new Date(expiresAt),
    });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid challenge request payload." }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Cross-origin")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Failed to create Stellar auth challenge.");
    return NextResponse.json(
      { error: "Authentication service is unavailable. Try again shortly." },
      { status: 503 },
    );
  }
}
