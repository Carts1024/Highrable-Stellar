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

const ProfileDraftSchema = z.object({
  firstName: z.string(),
  middleName: z.string().optional(),
  lastName: z.string(),
  publicHandle: z.string(),
  coreSkills: z.array(z.string()),
  discordHandle: z.string().optional(),
  xHandle: z.string().optional(),
  githubUsername: z.string().optional(),
  avatarStorageId: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const member = await requireMember(request);
    const body = ProfileDraftSchema.parse((await request.json()) as unknown);
    const { avatarStorageId, ...profileBody } = body;
    const result = await createMemberConvexClient().mutation(api.users.saveProfileDraft, {
      ...memberServiceArgs(),
      walletAddress: member.walletAddress,
      walletType: member.walletType,
      ...profileBody,
      ...(avatarStorageId ? { avatarStorageId: avatarStorageId as TConvexStorageId } : {}),
    });
    return noStore(NextResponse.json({ userId: result }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
