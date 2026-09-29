import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client/server";
import type { NextRequest } from "next/server";

const ParamsSchema = z.object({ disputeId: z.string().min(1) });
const BodySchema = z.object({ assignedAdminWallet: z.string().trim().min(1).nullable() });

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> },
) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const { disputeId } = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse((await request.json()) as unknown);
    const result = await createAdminConvexClient().mutation(api.admin.assignDispute, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      disputeId: disputeId as TConvexId<"disputes">,
      assignedAdminWallet: body.assignedAdminWallet,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
