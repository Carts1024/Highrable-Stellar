import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const adminContext = requireAdminRequestContext(request);
    const capabilities = await createAdminConvexClient().query(api.admin.getAdminCapabilities, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
    });
    if (!capabilities.isDisputeAdmin) {
      return noStore(
        NextResponse.json(
          { error: "This wallet does not have dispute admin access." },
          { status: 403 },
        ),
      );
    }
    return noStore(NextResponse.json(capabilities, { status: 200 }));
  } catch (error) {
    return noStore(createAdminErrorResponse(error));
  }
}
