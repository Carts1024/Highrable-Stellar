import { env } from "@/core/config/env";
import { noStore, requireMember } from "@/core/member/server-api";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (env.NEWSFEED_ENABLED !== true) {
    return noStore(NextResponse.json({ enabled: false }, { status: 404 }));
  }

  try {
    const member = await requireMember(request);
    const eligible = Boolean(
      member.profile?.onboardingCompletedAt && member.profile.name?.trim().length,
    );
    if (!eligible) {
      return noStore(
        NextResponse.json(
          {
            enabled: true,
            eligible: false,
            next: "/onboarding?next=%2Fnewsfeed",
            error: "Complete your named profile before entering Newsfeed.",
          },
          { status: 403 },
        ),
      );
    }
    return noStore(
      NextResponse.json(
        { enabled: true, eligible: true, address: member.walletAddress },
        { status: 200 },
      ),
    );
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number(error.status) : 401;
    return noStore(
      NextResponse.json(
        { enabled: true, eligible: false, error: "Verified member access is required." },
        { status: status === 503 ? 503 : 401 },
      ),
    );
  }
}
