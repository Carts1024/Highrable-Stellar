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

import type { TConvexStorageId } from "@repo/convex-client";
import type { NextRequest } from "next/server";

const FinalizeAvatarSchema = z.object({ uploadToken: z.string(), storageId: z.string() });

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const member = await requireMember(request);
    const body = FinalizeAvatarSchema.parse((await request.json()) as unknown);
    const storageId = await createMemberConvexClient().mutation(api.users.finalizeAvatarUpload, {
      ...memberServiceArgs(),
      walletAddress: member.walletAddress,
      uploadToken: body.uploadToken,
      storageId: body.storageId as TConvexStorageId,
    });
    return noStore(NextResponse.json({ storageId }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
