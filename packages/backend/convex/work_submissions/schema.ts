import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { deadlineStatusValidator } from "../jobs/schema";
import { walletTypeValidator } from "../users/schema";

const workSubmissionParentTypeEnum = createStringEnum([
  "micro_gig",
  "milestone",
  "escrow",
  "job",
] as const);

const workSubmissionStatusEnum = createStringEnum([
  "draft",
  "submitted",
  "anchoring",
  "anchored",
  "anchor_failed",
  "cancelled",
] as const);

const workSubmissionOnChainStatusEnum = createStringEnum([
  "not_submitted",
  "pending",
  "confirmed",
  "failed",
] as const);

export const workSubmissionParentTypeValidator = workSubmissionParentTypeEnum.validator;
export const workSubmissionStatusValidator = workSubmissionStatusEnum.validator;
export const workSubmissionOnChainStatusValidator = workSubmissionOnChainStatusEnum.validator;

export type TWorkSubmissionParentType = Infer<typeof workSubmissionParentTypeValidator>;
export type TWorkSubmissionStatus = Infer<typeof workSubmissionStatusValidator>;
export type TWorkSubmissionOnChainStatus = Infer<typeof workSubmissionOnChainStatusValidator>;

export default defineTable({
  parentType: workSubmissionParentTypeValidator,
  parentId: v.string(),
  jobId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  onChainEscrowId: v.optional(v.string()),
  clientWallet: v.string(),
  freelancerWallet: v.string(),
  freelancerWalletType: v.optional(walletTypeValidator),
  submittedByWallet: v.string(),
  submittedByWalletType: walletTypeValidator,
  notes: v.string(),
  attachmentIds: v.array(v.id("attachments")),
  normalizedManifest: v.optional(v.any()),
  proofHash: v.optional(v.string()),
  hashAlgorithm: v.literal("sha256"),
  hashEncoding: v.literal("hex"),
  proofVersion: v.literal("v1"),
  status: workSubmissionStatusValidator,
  onChainStatus: workSubmissionOnChainStatusValidator,
  transactionHash: v.optional(v.string()),
  stellarExpertUrl: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  deadlineAt: v.optional(v.number()),
  deadlineStatus: v.optional(deadlineStatusValidator),
  submittedLate: v.optional(v.boolean()),
  anchoredAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  anchorErrorMessage: v.optional(v.string()),
  metadata: v.optional(v.any()),
})
  .index("by_parent", ["parentType", "parentId", "status"])
  .index("by_escrow", ["onChainEscrowId", "status"])
  .index("by_convex_escrow", ["escrowId", "status"])
  .index("by_job", ["jobId", "status"])
  .index("by_milestone", ["milestoneId", "status"])
  .index("by_freelancer", ["freelancerWallet", "status"])
  .index("by_submitter", ["submittedByWallet", "status"])
  .index("by_proofHash", ["proofHash"]);
