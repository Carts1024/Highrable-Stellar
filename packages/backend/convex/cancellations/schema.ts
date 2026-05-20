import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { walletTypeValidator } from "../users/schema";

const cancellationParentTypeEnum = createStringEnum([
  "micro_gig",
  "milestone",
  "escrow",
  "job",
] as const);

const cancellationTypeEnum = createStringEnum([
  "pre_funding",
  "pre_acceptance",
  "client_requested",
  "mutual_agreement",
  "overdue",
  "post_dispute",
  "admin_review",
] as const);

const cancellationReasonCategoryEnum = createStringEnum([
  "changed_requirements",
  "duplicate_work",
  "freelancer_unresponsive",
  "missed_deadline",
  "work_not_started",
  "scope_issue",
  "mutual_agreement",
  "dispute_resolution",
  "other",
] as const);

const freelancerResponseStatusEnum = createStringEnum([
  "not_required",
  "pending",
  "accepted",
  "rejected",
  "expired",
] as const);

const cancellationStatusEnum = createStringEnum([
  "draft",
  "pending_freelancer_response",
  "approved_for_cancel",
  "rejected_by_freelancer",
  "cancel_pending_on_chain",
  "cancelled_on_chain",
  "cancel_failed",
  "blocked",
  "expired",
  "withdrawn",
] as const);

const cancellationOnChainStatusEnum = createStringEnum([
  "not_required",
  "not_submitted",
  "pending",
  "confirmed",
  "failed",
] as const);

const cancellationActorRoleEnum = createStringEnum([
  "client",
  "freelancer",
  "system",
  "moderator",
] as const);

const cancellationEventTypeEnum = createStringEnum([
  "cancellation_requested",
  "eligibility_checked",
  "freelancer_response_required",
  "freelancer_accepted",
  "freelancer_rejected",
  "client_withdrew",
  "auto_allowed_overdue",
  "blocked_due_to_proof",
  "blocked_due_to_dispute",
  "on_chain_cancel_started",
  "on_chain_cancel_succeeded",
  "on_chain_cancel_failed",
  "status_changed",
] as const);

export const cancellationParentTypeValidator = cancellationParentTypeEnum.validator;
export const cancellationTypeValidator = cancellationTypeEnum.validator;
export const cancellationReasonCategoryValidator = cancellationReasonCategoryEnum.validator;
export const freelancerResponseStatusValidator = freelancerResponseStatusEnum.validator;
export const cancellationStatusValidator = cancellationStatusEnum.validator;
export const cancellationOnChainStatusValidator = cancellationOnChainStatusEnum.validator;
export const cancellationActorRoleValidator = cancellationActorRoleEnum.validator;
export const cancellationEventTypeValidator = cancellationEventTypeEnum.validator;

export type TCancellationParentType = Infer<typeof cancellationParentTypeValidator>;
export type TCancellationType = Infer<typeof cancellationTypeValidator>;
export type TCancellationReasonCategory = Infer<typeof cancellationReasonCategoryValidator>;
export type TFreelancerResponseStatus = Infer<typeof freelancerResponseStatusValidator>;
export type TCancellationStatus = Infer<typeof cancellationStatusValidator>;
export type TCancellationOnChainStatus = Infer<typeof cancellationOnChainStatusValidator>;
export type TCancellationActorRole = Infer<typeof cancellationActorRoleValidator>;
export type TCancellationEventType = Infer<typeof cancellationEventTypeValidator>;

export const ACTIVE_CANCELLATION_STATUSES = [
  "draft",
  "pending_freelancer_response",
  "approved_for_cancel",
  "cancel_pending_on_chain",
  "cancel_failed",
] as const satisfies readonly TCancellationStatus[];

export const cancellationRequests = defineTable({
  requestNumber: v.string(),
  parentType: cancellationParentTypeValidator,
  parentId: v.string(),
  jobId: v.optional(v.id("jobs")),
  microGigId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  onChainEscrowId: v.optional(v.string()),
  escrowContractId: v.optional(v.string()),
  clientWallet: v.string(),
  clientWalletType: v.optional(walletTypeValidator),
  freelancerWallet: v.optional(v.string()),
  freelancerWalletType: v.optional(walletTypeValidator),
  requestedByWallet: v.string(),
  requestedByWalletType: walletTypeValidator,
  requestedByRole: v.literal("client"),
  cancellationType: cancellationTypeValidator,
  reasonCategory: cancellationReasonCategoryValidator,
  reasonText: v.string(),
  clientWarningAccepted: v.boolean(),
  proofWarningAccepted: v.boolean(),
  freelancerResponseRequired: v.boolean(),
  freelancerResponseStatus: freelancerResponseStatusValidator,
  freelancerResponseMessage: v.optional(v.string()),
  freelancerResponseAttachmentIds: v.optional(v.array(v.id("attachments"))),
  status: cancellationStatusValidator,
  onChainStatus: cancellationOnChainStatusValidator,
  transactionHash: v.optional(v.string()),
  stellarExpertUrl: v.optional(v.string()),
  eligibilitySnapshot: v.any(),
  requestedAt: v.number(),
  respondedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_requestNumber", ["requestNumber"])
  .index("by_parent_status", ["parentType", "parentId", "status"])
  .index("by_escrow_status", ["escrowId", "status"])
  .index("by_onChainEscrow_status", ["onChainEscrowId", "status"])
  .index("by_client", ["clientWallet", "updatedAt"])
  .index("by_freelancer", ["freelancerWallet", "updatedAt"])
  .index("by_status", ["status", "updatedAt"]);

export const cancellationEvents = defineTable({
  cancellationRequestId: v.id("cancellationRequests"),
  parentType: cancellationParentTypeValidator,
  parentId: v.string(),
  escrowId: v.optional(v.id("escrows")),
  type: cancellationEventTypeValidator,
  actorWallet: v.string(),
  actorWalletType: v.union(walletTypeValidator, v.literal("system")),
  actorRole: cancellationActorRoleValidator,
  message: v.string(),
  oldStatus: v.optional(cancellationStatusValidator),
  newStatus: v.optional(cancellationStatusValidator),
  transactionHash: v.optional(v.string()),
  createdAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_cancellation", ["cancellationRequestId", "createdAt"])
  .index("by_type", ["type", "createdAt"]);
