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
    const post = await createMemberConvexClient().query(api.newsfeed.getPost, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId: await getPostId(context),
    });
    if (!post) {
      return noStore(NextResponse.json({ error: "Post is unavailable." }, { status: 404 }));
    }
    return noStore(NextResponse.json(post, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const body = BodySchema.parse((await request.json()) as unknown);
    const postId = await getPostId(context);
    await createMemberConvexClient().mutation(api.newsfeed.updatePost, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId,
      text: body.text,
    });
    const post = await createMemberConvexClient().query(api.newsfeed.getPost, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId,
    });
    return noStore(NextResponse.json(post, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const postId = await getPostId(context);
    await createMemberConvexClient().mutation(api.newsfeed.deletePost, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId,
    });
    return noStore(NextResponse.json({ deleted: true }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
