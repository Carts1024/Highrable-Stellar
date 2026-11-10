import {
  api,
  createMemberConvexClient,
  memberErrorResponse,
  memberServiceArgs,
  noStore,
  requireMember,
} from "@/core/member/server-api";
import {
  assertNewsfeedId,
  assertNewsfeedTextEnabled,
  getNewsfeedCursor,
} from "@/features/newsfeed/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client/server";
import type { NextRequest } from "next/server";

const ActionSchema = z.object({
  requestId: z.string().trim().min(1).max(128),
  targetType: z.enum(["post", "comment"]),
  targetId: z.string().trim().min(1).max(128),
  action: z.enum(["hide", "restore", "dismiss_report"]),
  reason: z.string(),
  reportId: z.string().trim().min(1).max(128).optional(),
});

const TargetTypeSchema = z.enum(["post", "comment"]);

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const rawTargetType = request.nextUrl.searchParams.get("targetType")?.trim();
    const rawTargetId = request.nextUrl.searchParams.get("targetId")?.trim();
    const targetType = rawTargetType ? TargetTypeSchema.parse(rawTargetType) : undefined;
    const targetId = rawTargetId ? assertNewsfeedId(rawTargetId, "targetId") : undefined;
    const result = await createMemberConvexClient().query(api.newsfeed.listModerationActions, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      ...(targetType ? { targetType } : {}),
      ...(targetId
        ? {
            targetId: (targetType === "post" ? targetId : targetId) as
              | TConvexId<"newsfeedPosts">
              | TConvexId<"newsfeedComments">,
          }
        : {}),
      paginationOpts: { numItems: 20, cursor: getNewsfeedCursor(request) ?? null },
    });
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertNewsfeedTextEnabled();
    const member = await requireMember(request);
    const body = ActionSchema.parse((await request.json()) as unknown);
    const targetId = assertNewsfeedId(body.targetId, "targetId");
    const reportId = body.reportId ? assertNewsfeedId(body.reportId, "reportId") : undefined;
    const result = await createMemberConvexClient().mutation(api.newsfeed.applyModerationAction, {
      ...memberServiceArgs(),
      sessionId: member.sessionId,
      walletAddress: member.walletAddress,
      requestId: body.requestId,
      targetType: body.targetType,
      targetId:
        body.targetType === "post"
          ? (targetId as TConvexId<"newsfeedPosts">)
          : (targetId as TConvexId<"newsfeedComments">),
      action: body.action,
      reason: body.reason,
      ...(reportId ? { reportId: reportId as TConvexId<"newsfeedReports"> } : {}),
    });
    return noStore(NextResponse.json(result, { status: 200 }));
  } catch (error) {
    return memberErrorResponse(error);
  }
}
