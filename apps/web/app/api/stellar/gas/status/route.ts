import { createAdminConvexClient } from "@/core/admin/server-api";
import { readBoundedJson, RequestBodyError } from "@/core/stellar/server/request-body";
import {
  GasConfigurationError,
  GasStatusBodySchema,
  applicationStatusForGasResult,
  createVeloGasClient,
  recoverGasStatus,
  toPendingGasResponse,
  toSafeGasResponse,
} from "@/core/stellar/server/velo-gas";
import {
  requireWalletRequestContext,
  WalletRequestAuthError,
} from "@/core/wallet/server/request-auth";
import { VeloError } from "@carts1024/velo-sdk";
import { api } from "@repo/convex-client/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
const MAX_STATUS_REQUEST_BYTES = 4 * 1024;

function errorResponse(error: unknown): NextResponse {
  if (
    error instanceof WalletRequestAuthError ||
    error instanceof GasConfigurationError ||
    error instanceof RequestBodyError
  ) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid Gas Station status request." }, { status: 400 });
  }

  if (error instanceof VeloError) {
    return NextResponse.json(
      {
        error: "Velo Gas Station status request failed.",
        ...(error.code ? { code: error.code } : {}),
      },
      { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 502 },
    );
  }

  return NextResponse.json({ error: "Gas status request failed." }, { status: 502 });
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = requireWalletRequestContext(request);
    const body = GasStatusBodySchema.parse(
      await readBoundedJson(request, MAX_STATUS_REQUEST_BYTES),
    );
    const convex = createAdminConvexClient();
    const existing = await convex.query(api.transactions.getGasRecoveryRecord, {
      walletAddress,
      clientRequestId: body.operationId,
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Authorized transaction operation was not found." },
        { status: 404 },
      );
    }

    if (!existing.gasRequestId || !existing.gasTransactionHash) {
      return NextResponse.json(
        { error: "No Gas Station recovery identity is stored." },
        { status: 409 },
      );
    }

    const outcome = await recoverGasStatus({
      velo: createVeloGasClient(),
      identity: {
        requestId: existing.gasRequestId,
        transactionHash: existing.gasTransactionHash,
      },
      operationId: body.operationId,
      observeUntilTerminal: body.observeUntilTerminal,
    });
    const safeResult = outcome.result
      ? toSafeGasResponse(body.operationId, outcome.result)
      : toPendingGasResponse(body.operationId, outcome.identity);

    await convex.mutation(api.transactions.recordGasExecution, {
      walletAddress,
      clientRequestId: body.operationId,
      status: applicationStatusForGasResult(safeResult.status),
      gasStatus: safeResult.status,
      gasRequestId: safeResult.requestId,
      gasTransactionHash: safeResult.transactionHash,
      ...(safeResult.outerTransactionHash
        ? { gasOuterTransactionHash: safeResult.outerTransactionHash }
        : {}),
      gasActualFeeStroops: safeResult.actualFeeStroops,
      gasReconciliationRequired: safeResult.reconciliationRequired,
      ...(safeResult.outerTransactionHash
        ? {
            txHash: safeResult.outerTransactionHash,
            transactionHash: safeResult.outerTransactionHash,
          }
        : {}),
    });

    return NextResponse.json(safeResult, { status: outcome.pending ? 202 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
