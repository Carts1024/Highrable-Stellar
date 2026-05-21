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

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> },
) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const client = createAdminConvexClient();
    const params = ParamsSchema.parse(await context.params);

    const dispute = await client.query(api.admin.getAdminDispute, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      disputeId: params.disputeId as TConvexId<"disputes">,
    });

    return NextResponse.json(dispute, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
