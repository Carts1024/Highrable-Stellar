import { env } from "@/core/config/env";
import {
  AUTH_CHALLENGE_COOKIE_NAME,
  CHALLENGE_TTL_MS,
  createChallenge,
} from "@/core/wallet/server/auth-store";
import { TChallengeRequestSchema } from "@/core/wallet/validation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = TChallengeRequestSchema.parse(body);
    const challenge = createChallenge(payload.address);
    const { challengeToken, ...publicChallenge } = challenge;

    const response = NextResponse.json(publicChallenge, { status: 200 });
    response.cookies.set({
      name: AUTH_CHALLENGE_COOKIE_NAME,
      value: challengeToken,
      httpOnly: true,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
      path: "/api/auth/stellar",
      maxAge: Math.floor(CHALLENGE_TTL_MS / 1000),
      expires: new Date(challenge.expiresAt),
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid challenge request payload." }, { status: 400 });
    }

    console.error("Failed to create Stellar auth challenge.", error);

    const message =
      error instanceof Error && error.message.includes("WALLET_SESSION_SECRET")
        ? "Authentication session secret is not configured."
        : "Failed to create Stellar auth challenge.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
