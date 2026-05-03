import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { TRANSACTION_TYPES } from "../transactions/schema";

const escrowStatusEnum = createStringEnum([
  "created",
  "funded",
  "submitted",
  "released",
  "cancelled",
  "disputed",
] as const);

export const ESCROW_STATUSES = escrowStatusEnum.map;
export const escrowStatusValidator = escrowStatusEnum.validator;
export const escrowTransactionTypeValidator = v.union(
  v.literal(TRANSACTION_TYPES.create_escrow),
  v.literal(TRANSACTION_TYPES.fund_escrow),
  v.literal(TRANSACTION_TYPES.submit_work),
  v.literal(TRANSACTION_TYPES.release_payment),
  v.literal(TRANSACTION_TYPES.cancel_escrow),
  v.literal(TRANSACTION_TYPES.mark_disputed),
);

export type TEscrowStatus = Infer<typeof escrowStatusValidator>;
export type TEscrowTransactionType = Infer<typeof escrowTransactionTypeValidator>;

export default defineTable({
  jobId: v.id("jobs"),
  escrowId: v.string(),
  clientWallet: v.string(),
  freelancerWallet: v.string(),
  amount: v.number(),
  asset: v.string(),
  status: escrowStatusValidator,
  createTxHash: v.optional(v.string()),
  fundTxHash: v.optional(v.string()),
  submitTxHash: v.optional(v.string()),
  releaseTxHash: v.optional(v.string()),
  cancelTxHash: v.optional(v.string()),
  disputeTxHash: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_jobId", ["jobId"])
  .index("by_escrowId", ["escrowId"])
  .index("by_clientWallet", ["clientWallet"])
  .index("by_freelancerWallet", ["freelancerWallet"])
  .index("by_status", ["status"]);
