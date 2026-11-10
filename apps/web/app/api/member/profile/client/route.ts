import { memberErrorResponse, memberServiceArgs, noStore, requireMember, api, createMemberConvexClient } from "@/core/member/server-api";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const ClientProfileSchema = z.object({
  name: z.string().optional(),
  companyName: z.string().optional(),
  bio: z.string().optional(),
  websiteUrl: z.string().optional(),
  location: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const member = await requireMember(request);
    const body = ClientProfileSchema.parse((await request.json()) as unknown);
    const result = await createMemberConvexClient().mutation(api.profiles.updateClientProfile, {
      ...memberServiceArgs(),
      walletAddress: member.walletAddress,
      ...body,
    });
    return noStore(NextResponse.json({ profile: result }, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
