import type { QueryCtx } from "../_generated/server";

import { BadRequestError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";

export function sanitizeTransactionWallet(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export function sanitizeOptionalTransactionRef(value: string | undefined, fieldName: string) {
  return optionalNonEmptyString(value, fieldName);
}

export function sanitizeRequiredTxHash(txHash: string): string {
  return requireNonEmptyString(txHash, "txHash");
}

export function assertTransactionLookupKey(txHash?: string, clientRequestId?: string): void {
  if (!txHash && !clientRequestId) {
    throw new BadRequestError("Either txHash or clientRequestId is required.");
  }
}

export async function getTransactionByLookup(
  ctx: QueryCtx,
  txHash?: string,
  clientRequestId?: string,
) {
  let transaction = null;

  if (txHash) {
    transaction = await ctx.db
      .query("transactions")
      .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
      .unique();
  }

  if (!transaction && clientRequestId) {
    transaction = await ctx.db
      .query("transactions")
      .withIndex("by_clientRequestId", (q) => q.eq("clientRequestId", clientRequestId))
      .unique();
  }

  return transaction;
}

export async function getTransactionByLookupOrThrow(
  ctx: QueryCtx,
  txHash?: string,
  clientRequestId?: string,
) {
  const transaction = await getTransactionByLookup(ctx, txHash, clientRequestId);
  if (!transaction) {
    throw new NotFoundError("Transaction not found for provided identifier.");
  }

  return transaction;
}
