import { createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
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
    const { adminWallet } = requireAdminRequestContext(request);
    return noStore(NextResponse.json({ adminWallet }, { status: 200 }));
  } catch (error) {
    return noStore(createAdminErrorResponse(error));
  }
}
