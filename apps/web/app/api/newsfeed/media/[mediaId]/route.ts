import { memberErrorResponse } from "@/core/member/server-api";
import { streamProtectedVideo } from "@/features/newsfeed/photo-server";
import { assertNewsfeedId } from "@/features/newsfeed/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

async function handle(request: NextRequest, context: { params: Promise<{ mediaId: string }> }) {
  try {
    return await streamProtectedVideo(
      request,
      assertNewsfeedId((await context.params).mediaId, "mediaId"),
      false,
    );
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export const GET = handle;
export const HEAD = handle;
