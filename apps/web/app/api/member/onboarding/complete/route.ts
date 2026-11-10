import { memberErrorResponse, memberServiceArgs, noStore, requireMember, api, createMemberConvexClient } from "@/core/member/server-api";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const member = await requireMember(request);
    const result = await createMemberConvexClient().mutation(api.users.completeOnboarding, {
      ...memberServiceArgs(),
      walletAddress: member.walletAddress,
    });
    return noStore(NextResponse.json({ userId: result }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
