import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const transactionTypeEnum = createStringEnum([
  "create_escrow",
  "fund_escrow",
  "submit_work",
  "release_payment",
  "record_reputation",
  "cancel_escrow",
  "mark_disputed",
] as const);

const transactionStatusEnum = createStringEnum(["pending", "success", "failed"] as const);

export const TRANSACTION_TYPES = transactionTypeEnum.map;
export const TRANSACTION_STATUSES = transactionStatusEnum.map;

export const transactionTypeValidator = transactionTypeEnum.validator;
export const transactionStatusValidator = transactionStatusEnum.validator;

export type TTransactionType = Infer<typeof transactionTypeValidator>;
export type TTransactionStatus = Infer<typeof transactionStatusValidator>;

export default defineTable({
  walletAddress: v.string(),
  type: transactionTypeValidator,
  txHash: v.optional(v.string()),
  clientRequestId: v.optional(v.string()),
  escrowId: v.optional(v.string()),
  jobId: v.optional(v.id("jobs")),
  status: transactionStatusValidator,
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
})
  .index("by_walletAddress", ["walletAddress"])
  .index("by_txHash", ["txHash"])
  .index("by_clientRequestId", ["clientRequestId"])
  .index("by_escrowId", ["escrowId"])
  .index("by_jobId", ["jobId"])
  .index("by_status", ["status"])
  .index("by_type", ["type"]);
