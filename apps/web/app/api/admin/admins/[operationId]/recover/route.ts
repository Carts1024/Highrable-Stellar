import {
  readDisputeAdminMembership,
  verifyAdminChainOperation,
} from "@/core/admin/chain-verification";
import { createAdminConvexClient, createAdminErrorResponse } from "@/core/admin/server-api";
import { requireAdminRequestContext } from "@/core/admin/server-auth";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const ParamsSchema = z.object({ operationId: z.string().min(8).max(160) });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ operationId: string }> },
) {
  try {
    const adminContext = requireAdminRequestContext(request);
    const { operationId } = ParamsSchema.parse(await context.params);
    const client = createAdminConvexClient();
    const operation = await client.query(api.admin.getDisputeAdminOperation, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      operationId,
    });
    if (!operation) {
      return NextResponse.json({ error: "Membership operation not found." }, { status: 404 });
    }
    if (operation.status === "succeeded" || operation.status === "failed") {
      return NextResponse.json({ operation }, { status: 200 });
    }
    if (!operation.transactionHash || operation.transactionValidUntil === undefined) {
      return NextResponse.json(
        {
          error:
            "This operation has no signed transaction to recover. Sign it from the admin page.",
        },
        { status: 409 },
      );
    }

    const result = await verifyAdminChainOperation({
      transactionHash: operation.transactionHash,
      transactionValidUntil: operation.transactionValidUntil,
      network: operation.network,
      contractId: operation.contractId,
      expected: {
        method: operation.action === "grant" ? "add_dispute_admin" : "remove_dispute_admin",
        actorWallet: operation.actorWallet,
        targetWallet: operation.wallet,
      },
    });
    if (result === "pending") {
      return NextResponse.json({ status: "pending", operation }, { status: 202 });
    }

    if (result === "succeeded") {
      const onChainMember = await readDisputeAdminMembership({
        sourceAddress: operation.actorWallet,
        disputeAdminWallet: operation.wallet,
        network: operation.network,
        contractId: operation.contractId,
      });
      const shouldBeMember = operation.action === "grant";
      if (onChainMember !== shouldBeMember) {
        return NextResponse.json(
          {
            error:
              "The transaction succeeded, but current contract membership does not match this operation.",
          },
          { status: 409 },
        );
      }
    }

    const completed = await client.mutation(api.admin.completeDisputeAdminOperation, {
      adminWallet: adminContext.adminWallet,
      adminApiSecret: adminContext.adminApiSecret,
      operationId,
      result: result === "succeeded" ? "succeeded" : "failed",
      ...(result === "expired"
        ? { errorMessage: "The signed transaction expired without confirmation." }
        : {}),
      ...(result === "failed"
        ? { errorMessage: "The on-chain membership transaction failed." }
        : {}),
    });
    return NextResponse.json({ operation: completed }, { status: 200 });
  } catch (error) {
    return createAdminErrorResponse(error);
  }
}
