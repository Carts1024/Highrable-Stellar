import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

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
import { getPasskeyWebAuthnConfig, resolveOnChainPasskeyCredential } from "@/core/wallet/server/passkey";
import { env } from "@/core/config/env";

const VerifySchema = z.object({
  address: z.string().regex(/^C[A-Z2-7]{55}$/),
  credentialId: z.string(),
  response: z.record(z.string(), z.unknown()),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const payload = VerifySchema.parse((await request.json()) as unknown);
    const challengeId = request.cookies.get(AUTH_CHALLENGE_COOKIE_NAME)?.value;
    const browserBinding = request.cookies.get(AUTH_BROWSER_BINDING_COOKIE_NAME)?.value;
    if (!challengeId || !browserBinding) {
      return NextResponse.json({ error: "Passkey challenge not found or expired." }, { status: 401 });
    }

    const convex = createMemberConvexClient();
    const serviceSecret = getMemberServiceSecret();
    const rate = await convex.mutation(api.auth.consumeRateLimit, {
      serviceSecret,
      key: `passkey-verify:${getClientAddress(request)}:${payload.address}`,
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
      challenge.authMethod !== "passkey" ||
      challenge.walletAddress !== payload.address ||
      challenge.credentialId !== payload.credentialId ||
      !challenge.webauthnChallenge ||
      challenge.expiresAt <= Date.now()
    ) {
      return NextResponse.json({ error: "Passkey challenge payload mismatch or expiration." }, { status: 401 });
    }

    const credential = await resolveOnChainPasskeyCredential({
      address: payload.address,
      credentialId: payload.credentialId,
    });
    const { rpID, expectedOrigin } = getPasskeyWebAuthnConfig();
    const verification = await verifyAuthenticationResponse({
      response: payload.response as never,
      expectedChallenge: challenge.webauthnChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: Uint8Array.from(credential.publicKey),
        counter: 0,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) {
      return NextResponse.json({ error: "Passkey verification was not accepted." }, { status: 401 });
    }

    const sessionId = createOpaqueId();
    const session = await convex.mutation(api.auth.consumeChallengeAndCreateSession, {
      serviceSecret,
      challengeId,
      browserBinding,
      walletAddress: payload.address,
      walletType: "passkey_smart_account",
      authMethod: "passkey",
      nonce: challenge.nonce,
      sessionId,
    });
    const persistedSession = await convex.query(api.auth.getSession, {
      serviceSecret,
      sessionId,
    });
    const response = NextResponse.json(
      {
        address: session.walletAddress,
        walletType: "passkey_smart_account",
        authMethod: "passkey",
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid passkey verification payload." }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Cross-origin")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Passkey authentication is unavailable." },
      { status: 401 },
    );
  }
}
