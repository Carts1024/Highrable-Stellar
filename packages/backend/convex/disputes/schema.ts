import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { walletTypeValidator } from "../users/schema";

const disputeParentTypeEnum = createStringEnum([
  "micro_gig",
  "milestone",
  "escrow",
  "job",
] as const);

const disputeReasonCategoryEnum = createStringEnum([
  "work_not_delivered",
  "work_quality_issue",
  "client_unresponsive",
  "freelancer_unresponsive",
  "missed_deadline",
  "revision_disagreement",
  "payment_release_disagreement",
  "scope_disagreement",
  "other",
] as const);

const disputeStatusEnum = createStringEnum([
  "open",
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const);

const disputeOnChainStatusEnum = createStringEnum([
  "not_marked",
  "marking",
  "marked",
  "mark_failed",
] as const);

const disputeActorRoleEnum = createStringEnum([
  "client",
  "freelancer",
  "moderator",
  "system",
] as const);

const disputeEventTypeEnum = createStringEnum([
  "dispute_opened",
  "evidence_added",
  "on_chain_mark_started",
  "on_chain_mark_succeeded",
  "on_chain_mark_failed",
  "status_changed",
  "client_response_added",
  "freelancer_response_added",
  "moderator_note_added",
  "resolution_proposed",
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const);

export const disputeParentTypeValidator = disputeParentTypeEnum.validator;
export const disputeReasonCategoryValidator = disputeReasonCategoryEnum.validator;
export const disputeStatusValidator = disputeStatusEnum.validator;
export const disputeOnChainStatusValidator = disputeOnChainStatusEnum.validator;
export const disputeActorRoleValidator = disputeActorRoleEnum.validator;
export const disputeEventTypeValidator = disputeEventTypeEnum.validator;
export const DISPUTE_STATUSES = disputeStatusEnum.map;
export const DISPUTE_ON_CHAIN_STATUSES = disputeOnChainStatusEnum.map;

export type TDisputeParentType = Infer<typeof disputeParentTypeValidator>;
export type TDisputeReasonCategory = Infer<typeof disputeReasonCategoryValidator>;
export type TDisputeStatus = Infer<typeof disputeStatusValidator>;
export type TDisputeOnChainStatus = Infer<typeof disputeOnChainStatusValidator>;
export type TDisputeActorRole = Infer<typeof disputeActorRoleValidator>;
export type TDisputeEventType = Infer<typeof disputeEventTypeValidator>;

export const ACTIVE_DISPUTE_STATUSES = [
  "open",
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
] as const satisfies readonly TDisputeStatus[];

export const disputes = defineTable({
  disputeNumber: v.string(),
  parentType: disputeParentTypeValidator,
  parentId: v.string(),
  jobId: v.optional(v.id("jobs")),
  microGigId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  onChainEscrowId: v.optional(v.string()),
  escrowContractId: v.optional(v.string()),
  clientWallet: v.string(),
  clientWalletType: v.optional(walletTypeValidator),
  freelancerWallet: v.string(),
  freelancerWalletType: v.optional(walletTypeValidator),
  openedByWallet: v.string(),
  openedByWalletType: walletTypeValidator,
  openedByRole: v.union(v.literal("client"), v.literal("freelancer")),
  reasonCategory: disputeReasonCategoryValidator,
  title: v.string(),
  description: v.string(),
  evidenceAttachmentIds: v.array(v.id("attachments")),
  relatedWorkSubmissionIds: v.array(v.id("workSubmissions")),
  relatedRevisionRequestIds: v.array(v.id("revisionRequests")),
  relatedMessageIds: v.optional(v.array(v.id("messages"))),
  relatedDeadlineEventIds: v.optional(v.array(v.id("deadlineAuditEvents"))),
  proofHash: v.optional(v.string()),
  status: disputeStatusValidator,
  onChainStatus: disputeOnChainStatusValidator,
  transactionHash: v.optional(v.string()),
  stellarExpertUrl: v.optional(v.string()),
  resolutionTxHash: v.optional(v.string()),
  resolutionStellarExpertUrl: v.optional(v.string()),
  resolvedByWallet: v.optional(v.string()),
  freelancerShareBps: v.optional(v.number()),
  freelancerPayoutAmount: v.optional(v.number()),
  clientRefundAmount: v.optional(v.number()),
  resolutionNote: v.optional(v.string()),
  openedAt: v.number(),
  markedDisputedAt: v.optional(v.number()),
  resolvedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_disputeNumber", ["disputeNumber"])
  .index("by_parent_status", ["parentType", "parentId", "status"])
  .index("by_escrow_status", ["escrowId", "status"])
  .index("by_onChainEscrow_status", ["onChainEscrowId", "status"])
  .index("by_milestone_status", ["milestoneId", "status"])
  .index("by_client", ["clientWallet", "updatedAt"])
  .index("by_freelancer", ["freelancerWallet", "updatedAt"])
  .index("by_status", ["status", "updatedAt"]);

export const disputeEvents = defineTable({
  disputeId: v.id("disputes"),
  type: disputeEventTypeValidator,
  actorWallet: v.string(),
  actorWalletType: v.union(walletTypeValidator, v.literal("system")),
  actorRole: disputeActorRoleValidator,
  message: v.string(),
  attachmentIds: v.array(v.id("attachments")),
  oldStatus: v.optional(disputeStatusValidator),
  newStatus: v.optional(disputeStatusValidator),
  transactionHash: v.optional(v.string()),
  createdAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_dispute", ["disputeId", "createdAt"])
  .index("by_type", ["type", "createdAt"]);
