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

const BodySchema = z.object({ liked: z.boolean() });

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const body = BodySchema.parse((await request.json()) as unknown);
    const postId = assertNewsfeedId(
      (await context.params).postId,
      "postId",
    ) as TConvexId<"newsfeedPosts">;
    const result = await createMemberConvexClient().mutation(api.newsfeed.setPostLike, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId,
      liked: body.liked,
    });
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
