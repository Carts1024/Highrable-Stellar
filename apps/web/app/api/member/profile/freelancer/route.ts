import { memberErrorResponse, memberServiceArgs, noStore, requireMember, api, createMemberConvexClient } from "@/core/member/server-api";
import type { TConvexStorageId } from "@repo/convex-client";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const FreelancerProfileSchema = z.object({
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
    const body = FreelancerProfileSchema.parse((await request.json()) as unknown);
    const { avatarStorageId, ...profileBody } = body;
    const result = await createMemberConvexClient().mutation(api.profiles.updateFreelancerProfile, {
      ...memberServiceArgs(),
      walletAddress: member.walletAddress,
      ...profileBody,
      ...(avatarStorageId ? { avatarStorageId: avatarStorageId as TConvexStorageId } : {}),
    });
    return noStore(NextResponse.json({ profile: result }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
