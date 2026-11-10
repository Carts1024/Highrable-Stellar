import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import { assertNewsfeedId, assertNewsfeedTextEnabled } from "@/features/newsfeed/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client/server";
import type { NextRequest } from "next/server";

const CreateReportSchema = z.object({
  requestId: z.string().trim().min(1).max(128),
  targetType: z.enum(["post", "comment"]),
  targetId: z.string().trim().min(1).max(128),
  reason: z.enum(["spam", "harassment", "inappropriate_content", "other"]),
  explanation: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const body = CreateReportSchema.parse((await request.json()) as unknown);
    const targetId = assertNewsfeedId(body.targetId, "targetId");
    const result = await createMemberConvexClient().mutation(api.newsfeed.createReport, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      requestId: body.requestId,
      targetType: body.targetType,
      targetId:
        body.targetType === "post"
          ? (targetId as TConvexId<"newsfeedPosts">)
          : (targetId as TConvexId<"newsfeedComments">),
      reason: body.reason,
      ...(body.explanation !== undefined ? { explanation: body.explanation } : {}),
    });
    return noStore(NextResponse.json(result, { status: 201 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
