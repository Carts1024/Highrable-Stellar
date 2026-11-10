import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

import {
  AUTH_BROWSER_BINDING_COOKIE_NAME,
  AUTH_CHALLENGE_COOKIE_NAME,
  CHALLENGE_TTL_MS,
  createOpaqueId,
  getClientAddress,
} from "@/core/wallet/server/auth-store";
import { createMemberConvexClient, getMemberServiceSecret } from "@/core/wallet/server/convex";
import { assertSameOrigin } from "@/core/wallet/server/same-origin";
import { getPasskeyWebAuthnConfig, resolveOnChainPasskeyCredential } from "@/core/wallet/server/passkey";

const OptionsSchema = z.object({
  address: z.string().regex(/^C[A-Z2-7]{55}$/),
  credentialId: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertSameOrigin(request);
    const payload = OptionsSchema.parse((await request.json()) as unknown);
    const convex = createMemberConvexClient();
    const serviceSecret = getMemberServiceSecret();
    const rate = await convex.mutation(api.auth.consumeRateLimit, {
      serviceSecret,
      key: `passkey-options:${getClientAddress(request)}:${payload.address}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many authentication attempts. Try again in a minute." },
        { status: 429 },
      );
    }

    const credential = await resolveOnChainPasskeyCredential(payload);
    const { rpID } = getPasskeyWebAuthnConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: [{ id: credential.credentialId }],
    });
    const browserBinding =
      request.cookies.get(AUTH_BROWSER_BINDING_COOKIE_NAME)?.value ?? createOpaqueId();
    const challengeId = createOpaqueId();
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    await convex.mutation(api.auth.createChallenge, {
      serviceSecret,
      challengeId,
      nonce: createOpaqueId(),
      webauthnChallenge: options.challenge,
      walletAddress: payload.address,
      walletType: "passkey_smart_account",
      authMethod: "passkey",
      browserBinding,
      credentialId: credential.credentialId,
      expiresAt,
    });

    const response = NextResponse.json({ options }, { status: 200 });
    response.cookies.set({
      name: AUTH_BROWSER_BINDING_COOKIE_NAME,
      value: browserBinding,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set({
      name: AUTH_CHALLENGE_COOKIE_NAME,
      value: challengeId,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: Math.floor(CHALLENGE_TTL_MS / 1000),
      expires: new Date(expiresAt),
    });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid passkey authentication request." }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Cross-origin")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Passkey authentication is unavailable." },
      { status: 503 },
    );
  }
}
