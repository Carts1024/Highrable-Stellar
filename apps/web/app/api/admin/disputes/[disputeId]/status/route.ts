import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client/server";
import type { NextRequest } from "next/server";

const ParamsSchema = z.object({
  disputeId: z.string().min(1),
});

const BodySchema = z.object({
  status: z.enum(["under_review", "awaiting_client_response", "awaiting_freelancer_response"]),
  message: z.string().trim().min(1).max(4000).optional(),
});

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> },
) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const client = createAdminConvexClient();
    const params = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse((await request.json()) as unknown);

    await client.mutation(api.admin.changeDisputeReviewStatus, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      disputeId: params.disputeId as TConvexId<"disputes">,
      status: body.status,
      ...(body.message ? { message: body.message } : {}),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
