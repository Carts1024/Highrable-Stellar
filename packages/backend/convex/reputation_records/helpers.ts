import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
  requirePositiveNumber,
  requireRangeNumber,
} from "../_shared/input";

export function sanitizeReputationInput(args: {
  escrowId: string;
  clientWallet: string;
  freelancerWallet: string;
  amount: number;
  rating: number;
  reviewText?: string;
  reviewHash?: string;
  txHash?: string;
}) {
  return {
    escrowId: requireNonEmptyString(args.escrowId, "escrowId"),
    clientWallet: normalizeWalletAddress(args.clientWallet),
    freelancerWallet: normalizeWalletAddress(args.freelancerWallet),
    amount: requirePositiveNumber(args.amount, "amount"),
    rating: requireRangeNumber(args.rating, "rating", 1, 5),
    reviewText: optionalNonEmptyString(args.reviewText, "reviewText"),
    reviewHash: optionalNonEmptyString(args.reviewHash, "reviewHash"),
    txHash: optionalNonEmptyString(args.txHash, "txHash"),
  };
}

export async function assertReputationCreationAllowed(
  ctx: QueryCtx,
  params: {
    escrowId: string;
    jobId: Id<"jobs">;
  },
) {
  const escrow = await ctx.db
    .query("escrows")
    .withIndex("by_escrowId", (q) => q.eq("escrowId", params.escrowId))
    .unique();

  if (!escrow) {
    throw new NotFoundError("Escrow not found.");
  }

  if (escrow.status !== "released") {
    throw new ForbiddenError("Reputation can only be recorded after escrow is released.");
  }

  if (escrow.jobId !== params.jobId) {
    throw new ForbiddenError("jobId does not match escrow jobId.");
  }

  const existingRecord = await ctx.db
    .query("reputationRecords")
    .withIndex("by_escrowId", (q) => q.eq("escrowId", params.escrowId))
    .unique();
  if (existingRecord) {
    throw new ConflictError("Reputation record already exists for this escrow.");
  }
}
