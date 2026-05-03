import { createChallenge } from "@/core/wallet/server/auth-store";
import { TChallengeRequestSchema } from "@/core/wallet/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const payload = TChallengeRequestSchema.parse(body);
    const challenge = createChallenge(payload.address);

    return NextResponse.json(challenge, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Invalid challenge request payload." }, { status: 400 });
  }
}
