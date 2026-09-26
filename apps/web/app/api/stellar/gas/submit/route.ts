import { createAdminConvexClient } from "@/core/admin/server-api";
import { readBoundedJson, RequestBodyError } from "@/core/stellar/server/request-body";
import {
  GasConfigurationError,
  GasSubmissionBodySchema,
  GasTransactionValidationError,
  MAX_GAS_REQUEST_BYTES,
  applicationStatusForGasResult,
  createVeloGasClient,
  recoverGasStatus,
  sponsorAndObserveGas,
  toPendingGasResponse,
  toSafeGasResponse,
  validateSignedSorobanTransaction,
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

function errorResponse(error: unknown): NextResponse {
  if (error instanceof WalletRequestAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof RequestBodyError || error instanceof GasConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid Gas Station request." }, { status: 400 });
  }

  if (error instanceof GasTransactionValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof VeloError) {
    return NextResponse.json(
      { error: "Velo Gas Station request failed.", ...(error.code ? { code: error.code } : {}) },
      { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 502 },
    );
  }

  return NextResponse.json({ error: "Gas sponsorship request failed." }, { status: 502 });
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = requireWalletRequestContext(request);
    const body = GasSubmissionBodySchema.parse(
      await readBoundedJson(request, MAX_GAS_REQUEST_BYTES),
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

    if (
      existing.gasStatus === "succeeded" &&
      existing.gasRequestId &&
      existing.gasTransactionHash
    ) {
      return NextResponse.json(
        {
          operationId: body.operationId,
          requestId: existing.gasRequestId,
          transactionHash: existing.gasTransactionHash,
          outerTransactionHash: existing.gasOuterTransactionHash,
          status: existing.gasStatus,
          actualFeeStroops: existing.gasActualFeeStroops,
          reconciliationRequired: existing.gasReconciliationRequired,
        },
        { status: 200 },
      );
    }

    if (existing.gasRequestId && existing.gasTransactionHash) {
      const outcome = await recoverGasStatus({
        velo: createVeloGasClient(),
        identity: {
          requestId: existing.gasRequestId,
          transactionHash: existing.gasTransactionHash,
        },
        operationId: body.operationId,
        observeUntilTerminal: true,
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
    }

    validateSignedSorobanTransaction(body.signedTransactionXdr, walletAddress);
    const outcome = await sponsorAndObserveGas({
      velo: createVeloGasClient(),
      operationId: body.operationId,
      signedTransactionXdr: body.signedTransactionXdr,
      observeUntilTerminal: true,
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
