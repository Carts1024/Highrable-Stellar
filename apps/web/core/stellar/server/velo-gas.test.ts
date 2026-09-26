import { VeloGasSubmissionUnknownError, VeloGasWaitError } from "@carts1024/velo-sdk";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { GasExecutionIdentity, GasSubmitResult, Velo } from "@carts1024/velo-sdk";

import { AUTH_SESSION_COOKIE_NAME, createSessionToken } from "../../wallet/server/auth-store";
import {
  requireWalletRequestContext,
  WalletRequestAuthError,
} from "../../wallet/server/request-auth";
import {
  GasSubmissionBodySchema,
  applicationStatusForGasResult,
  isSuccessfulGasResult,
  recoverGasStatus,
  sponsorAndObserveGas,
  toPendingGasResponse,
  toSafeGasResponse,
} from "./velo-gas";

function gasResult(status: GasSubmitResult["status"]): GasSubmitResult {
  return {
    object: "gas_submit_result",
    requestId: "gas-request-1",
    transactionHash: "inner-hash-1",
    outerTransactionHash: status === "succeeded" ? "outer-hash-1" : null,
    status,
    reservedStroops: "1000",
    actualFeeStroops: status === "succeeded" ? "42" : null,
    expiresAt: "2026-09-26T00:00:00.000Z",
    reconciliationRequired: status === "submission_unknown",
  };
}

function fakeVelo(overrides: Partial<Velo["gas"]> = {}): Velo {
  return {
    gas: {
      sponsor: vi.fn(),
      submit: vi.fn(),
      getStatus: vi.fn(),
      waitForResult: vi.fn(),
      sponsorAndSubmit: vi.fn(),
      ...overrides,
    },
  } as unknown as Velo;
}

describe("Velo Gas Station boundary", () => {
  it("requires the signed wallet session before the server handoff", () => {
    const request = new NextRequest("http://localhost/api/stellar/gas/submit");

    expect(() => requireWalletRequestContext(request)).toThrow(WalletRequestAuthError);

    const walletAddress = `G${"A".repeat(55)}`;
    const session = createSessionToken(walletAddress);
    const authenticatedRequest = new NextRequest("http://localhost/api/stellar/gas/submit", {
      headers: {
        cookie: `${AUTH_SESSION_COOKIE_NAME}=${session.token}`,
      },
    });

    expect(requireWalletRequestContext(authenticatedRequest)).toEqual({ walletAddress });
  });

  it("bounds and validates the signed handoff payload", () => {
    expect(
      GasSubmissionBodySchema.safeParse({
        operationId: "escrow:create:123",
        signedTransactionXdr: "AAAA",
      }).success,
    ).toBe(true);

    expect(
      GasSubmissionBodySchema.safeParse({
        operationId: "contains spaces",
        signedTransactionXdr: "AAAA",
      }).success,
    ).toBe(false);

    expect(
      GasSubmissionBodySchema.safeParse({
        operationId: "escrow:create:123",
        signedTransactionXdr: "A".repeat(100_001),
      }).success,
    ).toBe(false);
  });

  it("uses one idempotent sponsor handoff and only status recovery after it", async () => {
    const sponsorAndSubmit = vi.fn().mockResolvedValue(gasResult("submitted"));
    const waitForResult = vi.fn().mockResolvedValue(gasResult("succeeded"));
    const velo = fakeVelo({ sponsorAndSubmit, waitForResult });

    const outcome = await sponsorAndObserveGas({
      velo,
      operationId: "escrow:create:123",
      signedTransactionXdr: "signed-xdr",
      observeUntilTerminal: true,
    });

    expect(sponsorAndSubmit).toHaveBeenCalledTimes(1);
    expect(sponsorAndSubmit).toHaveBeenCalledWith(
      "signed-xdr",
      expect.objectContaining({
        idempotencyKey: "highrable-gas:escrow:create:123",
        correlationId: "escrow:create:123",
      }),
    );
    expect(waitForResult).toHaveBeenCalledTimes(1);
    expect(waitForResult).toHaveBeenCalledWith(
      { requestId: "gas-request-1", transactionHash: "inner-hash-1" },
      expect.any(Object),
    );
    expect(outcome.result?.status).toBe("succeeded");
    expect(outcome.pending).toBe(false);
  });

  it("persists a recovery identity when submission outcome is unknown", async () => {
    const identity: GasExecutionIdentity = {
      requestId: "gas-request-unknown",
      transactionHash: "inner-hash-unknown",
    };
    const sponsorAndSubmit = vi
      .fn()
      .mockRejectedValue(new VeloGasSubmissionUnknownError(identity, "timeout"));
    const waitForResult = vi.fn().mockRejectedValue(new VeloGasWaitError(identity, "timeout"));
    const velo = fakeVelo({ sponsorAndSubmit, waitForResult });

    const outcome = await sponsorAndObserveGas({
      velo,
      operationId: "escrow:create:unknown",
      signedTransactionXdr: "signed-xdr",
      observeUntilTerminal: true,
    });

    expect(sponsorAndSubmit).toHaveBeenCalledTimes(1);
    expect(waitForResult).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ identity, pending: true });
    expect(toPendingGasResponse("escrow:create:unknown", identity)).toMatchObject({
      requestId: identity.requestId,
      transactionHash: identity.transactionHash,
      status: "submission_unknown",
      outerTransactionHash: null,
      actualFeeStroops: null,
      reconciliationRequired: true,
    });
  });

  it("recovers by identity-only status calls without accepting XDR", async () => {
    const identity: GasExecutionIdentity = {
      requestId: "gas-request-recover",
      transactionHash: "inner-hash-recover",
    };
    const getStatus = vi.fn().mockResolvedValue(gasResult("succeeded"));
    const velo = fakeVelo({ getStatus });

    const outcome = await recoverGasStatus({
      velo,
      identity,
      operationId: "escrow:create:recover",
      observeUntilTerminal: false,
    });

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(getStatus).toHaveBeenCalledWith(identity, expect.any(Object));
    expect(outcome.result?.status).toBe("succeeded");
    expect(outcome.pending).toBe(false);
  });

  it("treats only succeeded as success and preserves both hashes safely", () => {
    const result = gasResult("succeeded");
    expect(isSuccessfulGasResult(result)).toBe(true);
    expect(applicationStatusForGasResult("succeeded")).toBe("success");
    expect(applicationStatusForGasResult("submitted")).toBe("pending");
    expect(applicationStatusForGasResult("failed")).toBe("failed");
    expect(toSafeGasResponse("escrow:create:123", result)).toEqual({
      operationId: "escrow:create:123",
      requestId: "gas-request-1",
      transactionHash: "inner-hash-1",
      outerTransactionHash: "outer-hash-1",
      status: "succeeded",
      actualFeeStroops: "42",
      reconciliationRequired: false,
    });
  });
});
