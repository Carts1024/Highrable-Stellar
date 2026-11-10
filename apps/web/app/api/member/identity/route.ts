import { memberErrorResponse, memberServiceArgs, noStore, requireMember, api, createMemberConvexClient } from "@/core/member/server-api";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const member = await requireMember(request);
    await createMemberConvexClient().mutation(api.users.recordWalletIdentity, {
      ...memberServiceArgs(),
      walletAddress: member.walletAddress,
      walletType: member.walletType,
    });
    return noStore(NextResponse.json({ ok: true }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
