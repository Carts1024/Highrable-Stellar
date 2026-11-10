import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import { assertNewsfeedTextEnabled, getNewsfeedCursor } from "@/features/newsfeed/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const StatusSchema = z.enum(["open", "reviewed", "dismissed"]);

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const rawStatus = request.nextUrl.searchParams.get("status")?.trim();
    const status = rawStatus ? StatusSchema.parse(rawStatus) : undefined;
    const result = await createMemberConvexClient().query(api.newsfeed.listModerationReports, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      ...(status ? { status } : {}),
      paginationOpts: { numItems: 20, cursor: getNewsfeedCursor(request) ?? null },
    });
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
