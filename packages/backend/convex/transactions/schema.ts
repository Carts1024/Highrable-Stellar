import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const transactionTypeEnum = createStringEnum([
  "create_escrow",
  "fund_escrow",
  "assign_freelancer",
  "submit_work",
  "release_payment",
  "record_reputation",
  "cancel_escrow",
  "mark_disputed",
  "wallet_transfer",
] as const);

const transactionStatusEnum = createStringEnum(["pending", "success", "failed"] as const);
const walletTypeEnum = createStringEnum(["external_wallet", "passkey_smart_account"] as const);
const feePathEnum = createStringEnum([
  "relayer",
  "classic_source_account",
  "external_wallet",
] as const);

export const TRANSACTION_TYPES = transactionTypeEnum.map;
export const TRANSACTION_STATUSES = transactionStatusEnum.map;

export const transactionTypeValidator = transactionTypeEnum.validator;
export const transactionStatusValidator = transactionStatusEnum.validator;
export const walletTypeValidator = walletTypeEnum.validator;
export const feePathValidator = feePathEnum.validator;

export type TTransactionType = Infer<typeof transactionTypeValidator>;
export type TTransactionStatus = Infer<typeof transactionStatusValidator>;
export type TWalletType = Infer<typeof walletTypeValidator>;
export type TFeePath = Infer<typeof feePathValidator>;

export default defineTable({
  walletAddress: v.string(),
  walletType: v.optional(walletTypeValidator),
  transactionHash: v.optional(v.string()),
  type: transactionTypeValidator,
  txHash: v.optional(v.string()),
  clientRequestId: v.optional(v.string()),
  escrowId: v.optional(v.string()),
  jobId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  onChainEscrowId: v.optional(v.string()),
  proofHash: v.optional(v.string()),
  recipientAddress: v.optional(v.string()),
  recipientType: v.optional(v.union(v.literal("classic_account"), v.literal("contract_account"))),
  asset: v.optional(v.union(v.literal("XLM"), v.literal("USDC"))),
  amount: v.optional(v.string()),
  network: v.optional(v.string()),
  feePath: v.optional(feePathValidator),
  sourceAccount: v.optional(v.string()),
  confirmedAt: v.optional(v.number()),
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
  .index("by_milestoneId", ["milestoneId"])
  .index("by_status", ["status"])
  .index("by_type", ["type"]);
