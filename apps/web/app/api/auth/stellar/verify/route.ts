import { env } from "@/core/config/env";
import {
  AUTH_CHALLENGE_COOKIE_NAME,
  AUTH_SESSION_COOKIE_NAME,
  consumeChallenge,
  createSessionToken,
  validateChallenge,
} from "@/core/wallet/server/auth-store";
import { verifyStellarMessageSignature } from "@/core/wallet/server/signature";
import { TVerifyRequestSchema } from "@/core/wallet/validation";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const payload = TVerifyRequestSchema.parse(body);
    const challengeToken = request.cookies.get(AUTH_CHALLENGE_COOKIE_NAME)?.value;

    if (!challengeToken) {
      return NextResponse.json({ error: "Challenge not found or expired." }, { status: 401 });
    }

    const challengeResult = validateChallenge({
      address: payload.address,
      message: payload.message,
      nonce: payload.nonce,
      challengeToken,
    });

    if (!challengeResult.valid) {
      return NextResponse.json({ error: challengeResult.error }, { status: 401 });
    }

    const validSignature = verifyStellarMessageSignature({
      address: payload.address,
      message: payload.message,
      signature: payload.signature,
    });

    if (!validSignature) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const consumeResult = consumeChallenge({
      nonce: payload.nonce,
      challengeToken,
    });

    if (!consumeResult.valid) {
      return NextResponse.json({ error: consumeResult.error }, { status: 401 });
    }

    const session = createSessionToken(payload.address);

    const response = NextResponse.json(
      {
        address: payload.address,
        token: session.token,
        expiresAt: session.expiresAt,
      },
      { status: 200 },
    );

    response.cookies.set({
      name: AUTH_SESSION_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expiresAt),
    });
    response.cookies.set({
      name: AUTH_CHALLENGE_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/api/auth/stellar",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  }
}
