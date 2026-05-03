import { consumeChallenge, createSessionToken } from "@/core/wallet/server/auth-store";
import { verifyStellarMessageSignature } from "@/core/wallet/server/signature";
import { TVerifyRequestSchema } from "@/core/wallet/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = TVerifyRequestSchema.parse(body);

    const challengeResult = consumeChallenge({
      address: payload.address,
      message: payload.message,
      nonce: payload.nonce,
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
      name: "highrable_auth_session",
      value: session.token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expiresAt),
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  }
}
