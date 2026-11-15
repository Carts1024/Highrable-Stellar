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
    const { token, credentialHash, url } = photoCredential("photo");
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

export function photoCredential(kind: "photo" | "video" = "photo") {
  assertNewsfeedTextEnabled();
  if (kind === "video" ? !env.NEWSFEED_VIDEO_ENABLED : !env.NEWSFEED_PHOTOS_ENABLED)
    throw new NewsfeedAccessError(`${kind === "video" ? "Videos" : "Photos"} unavailable.`);
  const token = randomBytes(32).toString("hex");
  const credentialHash = createHash("sha256").update(token).digest("hex");
  const url = process.env.NEWSFEED_CONVEX_HTTP_URL;
  if (!url) throw new Error("NEWSFEED_CONVEX_HTTP_URL is not configured.");
  return {
    token,
    credentialHash,
    url: new URL(`/newsfeed/${kind === "video" ? "videos" : "photos"}`, url).toString(),
  };
}

export async function streamProtectedVideo(
  request: NextRequest,
  mediaId: string,
  moderation: boolean,
) {
  try {
    const member = await requireMember(request);
    const { token, credentialHash, url } = photoCredential("video");
    await createMemberConvexClient().mutation(api.newsfeed.photos.authorizeRead, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      mediaId: mediaId as Id<"newsfeedUploads">,
      moderation,
      credentialHash,
    });
    const origin =
      (process.env.NEWSFEED_APP_ORIGINS ?? "").split(",")[0]?.trim() || request.nextUrl.origin;
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: origin,
        ...(request.headers.get("Range") ? { Range: request.headers.get("Range")! } : {}),
      },
      cache: "no-store",
      signal: request.signal,
    });
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Type": upstream.headers.get("Content-Type") ?? "video/mp4",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Range",
    });
    for (const name of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return memberErrorResponse(error);
  }
}
