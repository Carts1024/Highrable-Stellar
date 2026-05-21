import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const client = createAdminConvexClient();

    const metrics = await client.query(api.admin.getAdminDashboardMetrics, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
    });

    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
