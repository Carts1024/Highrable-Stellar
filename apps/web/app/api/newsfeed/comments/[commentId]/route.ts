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

const BodySchema = z.object({ text: z.string() });

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ commentId: string }> },
): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const body = BodySchema.parse((await request.json()) as unknown);
    const commentId = assertNewsfeedId(
      (await context.params).commentId,
      "commentId",
    ) as TConvexId<"newsfeedComments">;
    const result = await createMemberConvexClient().mutation(api.newsfeed.updateComment, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      commentId,
      text: body.text,
    });
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ commentId: string }> },
): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const commentId = assertNewsfeedId(
      (await context.params).commentId,
      "commentId",
    ) as TConvexId<"newsfeedComments">;
    await createMemberConvexClient().mutation(api.newsfeed.deleteComment, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      commentId,
    });
    return noStore(NextResponse.json({ deleted: true }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
