import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import {
  assertNewsfeedTextEnabled,
  getNewsfeedCursor,
  getNewsfeedCutoff,
} from "@/features/newsfeed/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const CreatePostSchema = z.object({
  photos: z
    .array(z.object({ uploadId: z.string(), description: z.string() }))
    .max(4)
    .optional(),
  requestId: z.string().trim().min(1).max(128),
  publicationMode: z.enum(["freelancer", "client"]),
  text: z.string(),
});

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const cutoff = getNewsfeedCutoff(request);
    const page = await createMemberConvexClient().query(api.newsfeed.listPosts, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      paginationOpts: { numItems: 20, cursor: getNewsfeedCursor(request) ?? null },
      ...(cutoff !== undefined ? { firstPageCutoff: cutoff } : {}),
    });
    return noStore(NextResponse.json(page, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const body = CreatePostSchema.parse((await request.json()) as unknown);
    const result = await createMemberConvexClient().mutation(api.newsfeed.createPost, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      ...body,
      photos: body.photos?.map((photo) => ({
        ...photo,
        uploadId: photo.uploadId as import("@repo/convex-client").TConvexId<"newsfeedUploads">,
      })),
    });
    const post = await createMemberConvexClient().query(api.newsfeed.getPost, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      postId: result.postId,
    });
    return noStore(NextResponse.json({ post, duplicate: result.duplicate }, { status: 201 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
