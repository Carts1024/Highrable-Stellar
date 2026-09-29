import {
  readDisputedEscrowStatus,
  verifyAdminChainOperation,
} from "@/core/admin/chain-verification";
import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { TConvexId } from "@repo/convex-client/server";
import type { NextRequest } from "next/server";

const ParamsSchema = z.object({ disputeId: z.string().min(1) });
const ResolutionStatusSchema = z.enum([
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
]);
const BodySchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("started"),
    status: ResolutionStatusSchema,
    freelancerShareBps: z.number().int().min(0).max(10_000),
    operationId: z.string().trim().min(8).max(160),
    resolutionNote: z.string().trim().min(1).max(2000).optional(),
  }),
  z.object({
    phase: z.literal("signed"),
    operationId: z.string().trim().min(8).max(160),
    transactionHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
    transactionValidUntil: z.number().int().positive(),
  }),
  z.object({
    phase: z.literal("failed"),
    operationId: z.string().trim().min(8).max(160),
    errorMessage: z.string().trim().min(1).max(4000),
  }),
  z.object({
    phase: z.enum(["succeeded", "reconcile"]),
    operationId: z.string().trim().min(8).max(160),
  }),
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        operationId: body.operationId,
        ...(body.resolutionNote ? { resolutionNote: body.resolutionNote } : {}),
      });
      return NextResponse.json({ success: true, phase: body.phase, result }, { status: 200 });
    }

    if (body.phase === "signed") {
      const result = await client.mutation(api.admin.recordDisputeResolutionSigned, {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        operationId: body.operationId,
        transactionHash: body.transactionHash.toLowerCase(),
        transactionValidUntil: body.transactionValidUntil,
      });
      return NextResponse.json({ success: true, phase: body.phase, result }, { status: 200 });
    }

    if (body.phase === "failed") {
      const result = await client.mutation(api.admin.recordDisputeResolutionFailed, {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        operationId: body.operationId,
        errorMessage: body.errorMessage,
      });
      return NextResponse.json({ success: true, phase: body.phase, result }, { status: 200 });
    }

    const attempt = await client.query(api.admin.getSettlementAttemptByOperation, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      operationId: body.operationId,
    });
    if (!attempt || attempt.disputeId !== disputeId) {
      return NextResponse.json(
        { error: "Settlement attempt not found for this dispute." },
        { status: 404 },
      );
    }
    if (!attempt.transactionHash && attempt.status === "started") {
      const result = await client.mutation(api.admin.recordDisputeResolutionFailed, {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        operationId: attempt.operationId,
        errorMessage: "No signed transaction was persisted, so no settlement was submitted.",
      });
      return NextResponse.json({ status: "failed", result }, { status: 200 });
    }
    if (!attempt.transactionHash || attempt.transactionValidUntil === undefined) {
      return NextResponse.json(
        { error: "No signed transaction exists for this settlement attempt." },
        { status: 409 },
      );
    }

    const chainResult = await verifyAdminChainOperation({
      transactionHash: attempt.transactionHash,
      transactionValidUntil: attempt.transactionValidUntil,
      network: attempt.network,
      contractId: attempt.contractId,
      expected: {
        method: "resolve_dispute",
        actorWallet: attempt.actorWallet,
        escrowId: attempt.onChainEscrowId,
        freelancerShareBps: attempt.freelancerShareBps,
      },
    });

    if (chainResult === "pending") {
      const result = await client.mutation(api.admin.recordDisputeResolutionSubmissionUnknown, {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        operationId: attempt.operationId,
        errorMessage: "Stellar has not confirmed the persisted settlement transaction yet.",
      });
      return NextResponse.json({ status: "pending", result }, { status: 202 });
    }

    const onChainEscrow = await readDisputedEscrowStatus({
      sourceAddress: adminContext.adminWallet,
      escrowId: attempt.onChainEscrowId,
      network: attempt.network,
      contractId: attempt.contractId,
    });
    if (
      onChainEscrow.client === attempt.actorWallet.toUpperCase() ||
      onChainEscrow.freelancer === attempt.actorWallet.toUpperCase()
    ) {
      return NextResponse.json(
        { error: "The settlement actor is an escrow participant." },
        { status: 409 },
      );
    }

    if (chainResult === "succeeded") {
      const expectedStatus = attempt.freelancerShareBps === 0 ? "Cancelled" : "Released";
      if (onChainEscrow.status !== expectedStatus) {
        return NextResponse.json(
          {
            error:
              "The transaction succeeded, but current escrow state does not match its settlement.",
          },
          { status: 409 },
        );
      }
      const result = await client.mutation(api.admin.recordDisputeResolutionSucceeded, {
        adminWallet: adminContext.adminWallet,
        adminApiSecret: adminContext.adminApiSecret,
        operationId: attempt.operationId,
        transactionHash: attempt.transactionHash,
        transactionValidUntil: attempt.transactionValidUntil,
      });
      return NextResponse.json({ status: "succeeded", result }, { status: 200 });
    }

    if (onChainEscrow.status !== "Disputed") {
      return NextResponse.json(
        {
          error:
            "The settlement transaction failed or expired, but escrow state changed independently.",
        },
        { status: 409 },
      );
    }
    const result = await client.mutation(api.admin.recordDisputeResolutionFailed, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      operationId: attempt.operationId,
      transactionHash: attempt.transactionHash,
      errorMessage:
        chainResult === "expired"
          ? "The signed settlement transaction expired without settling the disputed escrow."
          : "The settlement transaction failed on Stellar.",
    });
    return NextResponse.json({ status: "failed", result }, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
