import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import { assertNewsfeedId } from "@/features/newsfeed/server";
import { NextResponse, type NextRequest } from "next/server";

import type { TConvexId as Id } from "@repo/convex-client";
async function handle(
  request: NextRequest,
  context: { params: Promise<{ uploadId: string }> },
  cancel: boolean,
) {
  try {
    const member = await requireMember(request);
    const uploadId = assertNewsfeedId((await context.params).uploadId) as Id<"newsfeedUploads">;
    const args = {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      uploadId,
    };
    const client = createMemberConvexClient();
    const result = cancel
      ? await client.mutation(api.newsfeed.photos.cancel, args)
      : await client.query(api.newsfeed.photos.status, args);
    return noStore(NextResponse.json(result ?? { cancelled: true }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
export const GET = (request: NextRequest, context: { params: Promise<{ uploadId: string }> }) =>
  handle(request, context, false);
export const DELETE = (request: NextRequest, context: { params: Promise<{ uploadId: string }> }) =>
  handle(request, context, true);
