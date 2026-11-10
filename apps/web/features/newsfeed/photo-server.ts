import { randomBytes, createHash } from "node:crypto";

import { env } from "@/core/config/env";
import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { TConvexId as Id } from "@repo/convex-client";

import { assertNewsfeedTextEnabled, NewsfeedAccessError } from "./server";
export async function authorizePhotoRead(request: NextRequest, moderation: boolean) {
  try {
    const member = await requireMember(request);
    const body = z.object({ mediaId: z.string() }).parse(await request.json());
    const { token, credentialHash, url } = photoCredential();
    await createMemberConvexClient().mutation(api.newsfeed.photos.authorizeRead, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      mediaId: body.mediaId as Id<"newsfeedUploads">,
      moderation,
      credentialHash,
    });
    return noStore(NextResponse.json({ token, url }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export function photoCredential() {
  assertNewsfeedTextEnabled();
  if (!env.NEWSFEED_PHOTOS_ENABLED) throw new NewsfeedAccessError("Photos unavailable.");
  const token = randomBytes(32).toString("hex");
  const credentialHash = createHash("sha256").update(token).digest("hex");
  const url = process.env.NEWSFEED_CONVEX_HTTP_URL;
  if (!url) throw new Error("NEWSFEED_CONVEX_HTTP_URL is not configured.");
  return { token, credentialHash, url: new URL("/newsfeed/photos", url).toString() };
}
