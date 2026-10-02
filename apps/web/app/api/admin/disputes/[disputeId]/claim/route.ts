import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client/server";
import type { NextRequest } from "next/server";

const ParamsSchema = z.object({ disputeId: z.string().min(1) });

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> },
) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const { disputeId } = ParamsSchema.parse(await context.params);
    const result = await createAdminConvexClient().mutation(api.admin.claimDispute, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      disputeId: disputeId as TConvexId<"disputes">,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
