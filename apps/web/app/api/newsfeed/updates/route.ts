import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import { assertNewsfeedTextEnabled } from "@/features/newsfeed/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const since = Number(request.nextUrl.searchParams.get("since"));
    if (!Number.isSafeInteger(since) || since <= 0) {
      return noStore(NextResponse.json({ error: "since is required." }, { status: 400 }));
    }
    const result = await createMemberConvexClient().query(api.newsfeed.checkForNewerPosts, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      since,
    });
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
