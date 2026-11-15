import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import { photoCredential } from "@/features/newsfeed/photo-server";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const UploadSchema = z.object({ kind: z.enum(["photo", "video"]).default("photo") });

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember(request);
    const body = UploadSchema.parse(await request.json().catch(() => ({})));
    const { token, credentialHash, url } = photoCredential(body.kind);
    const result = await createMemberConvexClient().mutation(api.newsfeed.photos.reserve, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      credentialHash,
      kind: body.kind,
    });
    return noStore(
      NextResponse.json({ ...result, token, url: `${url}?uploadId=${result.uploadId}` }),
    );
  } catch (error) {
    return memberErrorResponse(error);
  }
}
