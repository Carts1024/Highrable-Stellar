import {
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
  api,
  createMemberConvexClient,
} from "@/core/member/server-api";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const AvatarUploadSchema = z.object({
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const member = await requireMember(request);
    const body = AvatarUploadSchema.parse((await request.json()) as unknown);
    const result = await createMemberConvexClient().mutation(api.users.generateAvatarUploadUrl, {
      ...memberServiceArgs(),
      walletAddress: member.walletAddress,
      ...body,
    });
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
