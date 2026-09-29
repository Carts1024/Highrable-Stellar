import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const OperationSchema = z.object({
  wallet: TStellarPublicKeySchema,
  action: z.enum(["grant", "revoke"]),
  operationId: z.string().trim().min(8).max(160),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const result = await createAdminConvexClient().query(api.admin.listDisputeAdmins, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
    });
    const response = NextResponse.json(result, { status: 200 });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch (error) {
    const response = createAdminErrorResponse(error);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const body = OperationSchema.parse((await request.json()) as unknown);
    const operation = await createAdminConvexClient().mutation(
      api.admin.startDisputeAdminOperation,
      {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        wallet: body.wallet,
        action: body.action,
        operationId: body.operationId,
      },
    );
    return NextResponse.json({ operation }, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
