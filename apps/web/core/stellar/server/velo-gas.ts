import { Velo, VeloGasSubmissionUnknownError, VeloGasWaitError } from "@carts1024/velo-sdk";
import { FeeBumpTransaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { z } from "zod";

import type { GasExecutionIdentity, GasSubmitResult } from "@carts1024/velo-sdk";

import { env } from "../../config/env";

export const GAS_TIMEOUT_MS = 10_000;
export const GAS_STATUS_TIMEOUT_MS = 8_000;
export const MAX_GAS_REQUEST_BYTES = 128 * 1024;
export const MAX_SIGNED_TRANSACTION_XDR_LENGTH = 100_000;
export const VELO_GAS_TESTNET_API_KEY_PATTERN = /^tg_test_[a-f0-9]{32}$/i;

export const GasSubmissionBodySchema = z.object({
  operationId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9._:-]+$/, "Invalid operation ID."),
  signedTransactionXdr: z
    .string()
    .trim()
    .min(1)
    .max(MAX_SIGNED_TRANSACTION_XDR_LENGTH)
    .regex(/^[A-Za-z0-9+/=]+$/, "Invalid signed transaction XDR."),
});

export const GasStatusBodySchema = z.object({
  operationId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9._:-]+$/, "Invalid operation ID."),
  observeUntilTerminal: z.boolean().optional().default(false),
});

export type TGasExecutionStatus =
  | "claimed"
  | "submission_unknown"
  | "submitted"
  | "succeeded"
  | "failed"
  | "cancelled";

export type TSafeGasResponse = {
  operationId: string;
  requestId: string;
  transactionHash: string;
  outerTransactionHash: string | null;
  status: TGasExecutionStatus;
  actualFeeStroops: string | null;
  reconciliationRequired: boolean;
};

export class GasConfigurationError extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "GasConfigurationError";
  }
}

export class GasTransactionValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "GasTransactionValidationError";
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase();
}

export function assertVeloGasTestnet(): void {
  if (env.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") {
    throw new GasConfigurationError("Velo Gas Station is available only on Stellar Testnet.");
  }

  if (env.VELO_GAS_ENV && env.VELO_GAS_ENV !== "testnet") {
    throw new GasConfigurationError("VELO_GAS_ENV must be set to testnet for Gas Station.");
  }
}

export function validateVeloGasApiKey(apiKey: string): string {
  const normalized = apiKey.trim();

  if (!VELO_GAS_TESTNET_API_KEY_PATTERN.test(normalized)) {
    throw new GasConfigurationError(
      "VELO_GAS_API_KEY must be a Gas Station Testnet key beginning with tg_test_.",
    );
  }

  return normalized;
}

export function createVeloGasClient(): Velo {
  assertVeloGasTestnet();

  const configuredApiKey = env.VELO_GAS_API_KEY?.trim();
  const baseUrl = env.VELO_GAS_BASE_URL?.trim() || env.VELO_BASE_URL?.trim();

  if (!configuredApiKey) {
    throw new GasConfigurationError("Configure the Gas Station VELO_GAS_API_KEY on the server.");
  }

  const config = {
    apiKey: validateVeloGasApiKey(configuredApiKey),
    environment: "testnet",
    timeoutMs: GAS_TIMEOUT_MS,
    ...(baseUrl ? { baseUrl } : {}),
  } as const;

  return new Velo(config);
}

export function validateSignedSorobanTransaction(
  signedTransactionXdr: string,
  expectedSourceAddress: string,
): void {
  if (signedTransactionXdr.length > MAX_SIGNED_TRANSACTION_XDR_LENGTH) {
    throw new GasTransactionValidationError("Signed transaction XDR is too large.");
  }

  let transaction: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    transaction = TransactionBuilder.fromXDR(
      signedTransactionXdr,
      env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    );
  } catch {
    throw new GasTransactionValidationError("Signed transaction XDR is invalid.");
  }

  if (transaction instanceof FeeBumpTransaction) {
    throw new GasTransactionValidationError("Fee-bump envelopes are not accepted for sponsorship.");
  }

  if (normalizeAddress(transaction.source) !== normalizeAddress(expectedSourceAddress)) {
    throw new GasTransactionValidationError(
      "Signed transaction source does not match the wallet session.",
    );
  }

  if (transaction.signatures.length === 0) {
    throw new GasTransactionValidationError("Signed transaction must contain a wallet signature.");
  }

  if (
    transaction.operations.length !== 1 ||
    transaction.operations[0]?.type !== "invokeHostFunction"
  ) {
    throw new GasTransactionValidationError(
      "Gas sponsorship accepts exactly one Soroban invokeHostFunction operation.",
    );
  }
}

export function isTerminalGasStatus(status: TGasExecutionStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

export function isSuccessfulGasResult(result: Pick<GasSubmitResult, "status">): boolean {
  return result.status === "succeeded";
}

export function toSafeGasResponse(operationId: string, result: GasSubmitResult): TSafeGasResponse {
  return {
    operationId,
    requestId: result.requestId,
    transactionHash: result.transactionHash,
    outerTransactionHash: result.outerTransactionHash,
    status: result.status,
    actualFeeStroops: result.actualFeeStroops,
    reconciliationRequired: result.reconciliationRequired || !isTerminalGasStatus(result.status),
  };
}

export function toPendingGasResponse(
  operationId: string,
  identity: GasExecutionIdentity,
): TSafeGasResponse {
  return {
    operationId,
    requestId: identity.requestId,
    transactionHash: identity.transactionHash,
    outerTransactionHash: null,
    status: "submission_unknown",
    actualFeeStroops: null,
    reconciliationRequired: true,
  };
}

export function applicationStatusForGasResult(
  status: TGasExecutionStatus,
): "pending" | "success" | "failed" {
  if (status === "succeeded") {
    return "success";
  }

  if (status === "failed" || status === "cancelled") {
    return "failed";
  }

  return "pending";
}

export async function sponsorAndObserveGas(input: {
  velo: Velo;
  operationId: string;
  signedTransactionXdr: string;
  observeUntilTerminal?: boolean;
}): Promise<{ result?: GasSubmitResult; identity: GasExecutionIdentity; pending: boolean }> {
  const idempotencyKey = `highrable-gas:${input.operationId}`;
  let result: GasSubmitResult;

  try {
    result = await input.velo.gas.sponsorAndSubmit(input.signedTransactionXdr, {
      idempotencyKey,
      correlationId: input.operationId,
      timeoutMs: GAS_TIMEOUT_MS,
    });
  } catch (error) {
    if (!(error instanceof VeloGasSubmissionUnknownError)) {
      throw error;
    }

    const identity = error.recovery;
    try {
      result = await input.velo.gas.waitForResult(identity, {
        timeoutMs: GAS_STATUS_TIMEOUT_MS,
        maxAttempts: 6,
        initialDelayMs: 250,
        maxDelayMs: 2_000,
        correlationId: input.operationId,
      });
    } catch (waitError) {
      if (!(waitError instanceof VeloGasWaitError)) {
        throw waitError;
      }

      return { identity, pending: true };
    }

    return {
      result,
      identity: { requestId: result.requestId, transactionHash: result.transactionHash },
      pending: !isTerminalGasStatus(result.status),
    };
  }

  if (input.observeUntilTerminal && !isTerminalGasStatus(result.status)) {
    try {
      result = await input.velo.gas.waitForResult(
        { requestId: result.requestId, transactionHash: result.transactionHash },
        {
          timeoutMs: GAS_STATUS_TIMEOUT_MS,
          maxAttempts: 6,
          initialDelayMs: 250,
          maxDelayMs: 2_000,
          correlationId: input.operationId,
        },
      );
    } catch (waitError) {
      if (!(waitError instanceof VeloGasWaitError)) {
        throw waitError;
      }

      return {
        result,
        identity: { requestId: result.requestId, transactionHash: result.transactionHash },
        pending: true,
      };
    }
  }

  return {
    result,
    identity: { requestId: result.requestId, transactionHash: result.transactionHash },
    pending: !isTerminalGasStatus(result.status),
  };
}

export async function recoverGasStatus(input: {
  velo: Velo;
  identity: GasExecutionIdentity;
  operationId: string;
  observeUntilTerminal: boolean;
}): Promise<{ result?: GasSubmitResult; identity: GasExecutionIdentity; pending: boolean }> {
  try {
    const result = input.observeUntilTerminal
      ? await input.velo.gas.waitForResult(input.identity, {
          timeoutMs: GAS_STATUS_TIMEOUT_MS,
          maxAttempts: 6,
          initialDelayMs: 250,
          maxDelayMs: 2_000,
          correlationId: input.operationId,
        })
      : await input.velo.gas.getStatus(input.identity, {
          timeoutMs: 5_000,
          correlationId: input.operationId,
        });

    return {
      result,
      identity: { requestId: result.requestId, transactionHash: result.transactionHash },
      pending: !isTerminalGasStatus(result.status),
    };
  } catch (error) {
    if (error instanceof VeloGasWaitError) {
      return { identity: error.recovery, pending: true };
    }

    throw error;
  }
}
