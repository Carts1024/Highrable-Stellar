import {
  AUTH_CHALLENGE_COOKIE_NAME,
  CHALLENGE_TTL_MS,
  createChallenge,
} from "@/core/wallet/server/auth-store";
import { env } from "@/core/config/env";
import { TChallengeRequestSchema } from "@/core/wallet/validation";
import { NextResponse } from "next/server";

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
  } catch {
    return NextResponse.json({ error: "Invalid challenge request payload." }, { status: 400 });
  }
}
