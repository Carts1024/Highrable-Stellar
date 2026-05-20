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

const ResolutionStatusSchema = z.enum([
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
]);

const BodySchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("started"),
    status: ResolutionStatusSchema,
    freelancerShareBps: z.number().int().min(0).max(10000),
    resolutionNote: z.string().trim().min(1).max(2000).optional(),
  }),
  z.object({
    phase: z.literal("succeeded"),
    status: ResolutionStatusSchema,
    freelancerShareBps: z.number().int().min(0).max(10000),
    transactionHash: z.string().trim().min(1),
    stellarExpertUrl: z.string().url().optional(),
    resolutionNote: z.string().trim().min(1).max(2000).optional(),
  }),
  z.object({
    phase: z.literal("failed"),
    status: ResolutionStatusSchema,
    freelancerShareBps: z.number().int().min(0).max(10000),
    errorMessage: z.string().trim().min(1).max(4000),
    resolutionNote: z.string().trim().min(1).max(2000).optional(),
  }),
]);

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
    const disputeId = params.disputeId as TConvexId<"disputes">;

    if (body.phase === "started") {
      const result = await client.mutation(api.admin.recordDisputeResolutionStarted, {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        disputeId,
        status: body.status,
        freelancerShareBps: body.freelancerShareBps,
        ...(body.resolutionNote ? { resolutionNote: body.resolutionNote } : {}),
      });

      return NextResponse.json({ success: true, phase: body.phase, result }, { status: 200 });
    }

    if (body.phase === "succeeded") {
      const result = await client.mutation(api.admin.recordDisputeResolutionSucceeded, {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        disputeId,
        status: body.status,
        freelancerShareBps: body.freelancerShareBps,
        transactionHash: body.transactionHash,
        ...(body.stellarExpertUrl ? { stellarExpertUrl: body.stellarExpertUrl } : {}),
        ...(body.resolutionNote ? { resolutionNote: body.resolutionNote } : {}),
      });

      return NextResponse.json({ success: true, phase: body.phase, result }, { status: 200 });
    }

    const result = await client.mutation(api.admin.recordDisputeResolutionFailed, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      disputeId,
      status: body.status,
      freelancerShareBps: body.freelancerShareBps,
      errorMessage: body.errorMessage,
      ...(body.resolutionNote ? { resolutionNote: body.resolutionNote } : {}),
    });

    return NextResponse.json({ success: true, phase: body.phase, result }, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
