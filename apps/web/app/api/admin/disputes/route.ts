import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const SearchSchema = z.object({
  status: z
    .enum([
      "open",
      "under_review",
      "awaiting_client_response",
      "awaiting_freelancer_response",
      "resolved_client",
      "resolved_freelancer",
      "split_resolution",
      "cancelled",
    ])
    .optional(),
  onChainStatus: z.enum(["not_marked", "marking", "marked", "mark_failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const client = createAdminConvexClient();
    const parsed = SearchSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    const disputes = await client.query(api.admin.listAdminDisputes, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.onChainStatus ? { onChainStatus: parsed.onChainStatus } : {}),
      ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
    });

    return NextResponse.json({ disputes }, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
