import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TEscrowTransactionType } from "./schema";
import type { TEscrowTxField, TJobStatusPatch } from "./types";

import { ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
  requirePositiveNumber,
} from "../_shared/input";
import { TRANSACTION_TYPES } from "../transactions/schema";

const TX_TYPE_TO_ESCROW_FIELD_MAP: Record<TEscrowTransactionType, TEscrowTxField> = {
  [TRANSACTION_TYPES.create_escrow]: "createTxHash",
  [TRANSACTION_TYPES.fund_escrow]: "fundTxHash",
  [TRANSACTION_TYPES.assign_freelancer]: "assignTxHash",
  [TRANSACTION_TYPES.submit_work]: "submitTxHash",
  [TRANSACTION_TYPES.release_payment]: "releaseTxHash",
  [TRANSACTION_TYPES.cancel_escrow]: "cancelTxHash",
  [TRANSACTION_TYPES.mark_disputed]: "disputeTxHash",
};

const ESCROW_TO_JOB_STATUS_MAP: Record<
  "funded" | "submitted" | "released" | "cancelled" | "disputed",
  TJobStatusPatch
> = {
  funded: "funded",
  submitted: "submitted",
  released: "completed",
  cancelled: "cancelled",
  disputed: "disputed",
};

export function sanitizeEscrowId(escrowId: string): string {
  return requireNonEmptyString(escrowId, "escrowId");
}

export function sanitizeEscrowWallet(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export function sanitizeEscrowAmount(amount: number): number {
  return requirePositiveNumber(amount, "amount");
}

export function sanitizeEscrowAsset(asset: string): string {
  return requireNonEmptyString(asset, "asset");
}

export function sanitizeOptionalTxHash(txHash: string | undefined): string | undefined {
  return optionalNonEmptyString(txHash, "txHash");
}

export async function getEscrowByEscrowId(ctx: QueryCtx, escrowId: string) {
  return await ctx.db
    .query("escrows")
    .withIndex("by_escrowId", (q) => q.eq("escrowId", escrowId))
    .unique();
}

export async function getEscrowByEscrowIdOrThrow(ctx: MutationCtx, escrowId: string) {
  const escrow = await getEscrowByEscrowId(ctx, escrowId);
  if (!escrow) {
    throw new NotFoundError("Escrow not found.");
  }

  return escrow;
}

export async function assertEscrowCreationAllowed(
  ctx: MutationCtx,
  params: {
    jobId: Id<"jobs">;
    escrowId: string;
    clientWallet: string;
    freelancerWallet?: string;
  },
) {
  const job = await ctx.db.get(params.jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }

  // TODO: Replace walletAddress trust with signed wallet session/auth.
  if (job.clientWallet !== params.clientWallet) {
    throw new ForbiddenError("clientWallet must match the job client.");
  }

  if (
    params.freelancerWallet !== undefined &&
    job.selectedFreelancerWallet !== params.freelancerWallet
  ) {
    throw new ForbiddenError("freelancerWallet must match selectedFreelancerWallet on the job.");
  }

  const existingEscrowByEscrowId = await getEscrowByEscrowId(ctx, params.escrowId);
  if (existingEscrowByEscrowId) {
    throw new ConflictError("Escrow with this escrowId already exists.");
  }

  const existingEscrowByJob = await ctx.db
    .query("escrows")
    .withIndex("by_jobId", (q) => q.eq("jobId", params.jobId))
    .take(1);
  if (existingEscrowByJob.length > 0) {
    throw new ConflictError("Escrow for this job already exists.");
  }

  return job;
}

export function getEscrowTxFieldByType(type: TEscrowTransactionType): TEscrowTxField {
  return TX_TYPE_TO_ESCROW_FIELD_MAP[type];
}

export function getJobStatusFromEscrowStatus(
  escrowStatus: "funded" | "submitted" | "released" | "cancelled" | "disputed",
): TJobStatusPatch {
  return ESCROW_TO_JOB_STATUS_MAP[escrowStatus];
}
