import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const ParamsSchema = z.object({ operationId: z.string().min(8).max(160) });
const BodySchema = z.object({ errorMessage: z.string().trim().min(1).max(1000) });

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ operationId: string }> },
) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const { operationId } = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse((await request.json()) as unknown);
    const operation = await createAdminConvexClient().mutation(
      api.admin.failDisputeAdminOperationBeforeSubmission,
      {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        operationId,
        errorMessage: body.errorMessage,
      },
    );
    return NextResponse.json({ operation }, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
