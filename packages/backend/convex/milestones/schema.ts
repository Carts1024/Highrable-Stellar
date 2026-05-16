import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const milestoneStatusEnum = createStringEnum([
  "draft",
  "open",
  "assigned",
  "escrow_created",
  "funded",
  "submitted",
  "released",
  "cancelled",
  "disputed",
] as const);

const applicationGateStatusEnum = createStringEnum([
  "locked",
  "open",
  "continuation_pending",
  "continuation_rejected",
  "closed",
] as const);

export const MILESTONE_STATUSES = milestoneStatusEnum.map;
export const milestoneStatusValidator = milestoneStatusEnum.validator;
export const APPLICATION_GATE_STATUSES = applicationGateStatusEnum.map;
export const applicationGateStatusValidator = applicationGateStatusEnum.validator;

export type TMilestoneStatus = Infer<typeof milestoneStatusValidator>;
export type TApplicationGateStatus = Infer<typeof applicationGateStatusValidator>;

export default defineTable({
  jobId: v.id("jobs"),
  order: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  amount: v.number(),
  asset: v.string(),
  status: milestoneStatusValidator,
  assignedFreelancerWallet: v.optional(v.string()),
  applicationGateStatus: v.optional(applicationGateStatusValidator),
  continuationOfferFreelancerWallet: v.optional(v.string()),
  continuationOfferCreatedAt: v.optional(v.number()),
  continuationOfferRespondedAt: v.optional(v.number()),
  escrowId: v.optional(v.string()),
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
  .index("by_jobId_order", ["jobId", "order"])
  .index("by_status", ["status"])
  .index("by_assignedFreelancerWallet", ["assignedFreelancerWallet"])
  .index("by_escrowId", ["escrowId"]);
