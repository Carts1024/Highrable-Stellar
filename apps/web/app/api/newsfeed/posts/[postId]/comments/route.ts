import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import {
  assertNewsfeedId,
  assertNewsfeedTextEnabled,
  getNewsfeedCursor,
} from "@/features/newsfeed/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client/server";
import type { NextRequest } from "next/server";

const CreateCommentSchema = z.object({
  requestId: z.string().trim().min(1).max(128),
  publicationMode: z.enum(["freelancer", "client"]),
  text: z.string(),
});

export const runtime = "nodejs";

async function getPostId(context: { params: Promise<{ postId: string }> }) {
  return assertNewsfeedId((await context.params).postId, "postId") as TConvexId<"newsfeedPosts">;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const result = await createMemberConvexClient().query(api.newsfeed.listComments, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId: await getPostId(context),
      paginationOpts: { numItems: 20, cursor: getNewsfeedCursor(request) ?? null },
    });
    if (!result) {
      return noStore(NextResponse.json({ error: "Post is unavailable." }, { status: 404 }));
    }
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const body = CreateCommentSchema.parse((await request.json()) as unknown);
    const postId = await getPostId(context);
    const result = await createMemberConvexClient().mutation(api.newsfeed.createComment, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId,
      ...body,
    });
    return noStore(
      NextResponse.json(
        { commentId: result.commentId, duplicate: result.duplicate },
        { status: 201 },
      ),
    );
  } catch (error) {
    return memberErrorResponse(error);
  }
}
