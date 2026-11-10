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
export async function POST(request: NextRequest) {
  try {
    const member = await requireMember(request);
    const { token, credentialHash, url } = photoCredential();
    const result = await createMemberConvexClient().mutation(api.newsfeed.photos.reserve, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      credentialHash,
    });
    return noStore(
      NextResponse.json({ ...result, token, url: `${url}?uploadId=${result.uploadId}` }),
    );
  } catch (error) {
    return memberErrorResponse(error);
  }
}
