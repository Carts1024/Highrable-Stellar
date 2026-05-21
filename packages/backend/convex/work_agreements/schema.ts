import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { walletTypeValidator } from "../users/schema";

const agreementTypeEnum = createStringEnum(["client_uploaded", "highrable_generated"] as const);
const agreementStatusEnum = createStringEnum([
  "draft",
  "pending_preview",
  "ready_to_send",
  "pending_acceptance",
  "accepted",
  "locked",
  "rejected",
  "cancelled",
] as const);
const agreementEventTypeEnum = createStringEnum([
  "agreement_draft_created",
  "client_uploaded_agreement",
  "highrable_agreement_generated",
  "agreement_previewed",
  "agreement_updated",
  "agreement_ready_to_send",
  "agreement_sent",
  "agreement_viewed_by_freelancer",
  "agreement_accepted",
  "agreement_rejected",
  "agreement_locked",
  "agreement_hash_generated",
  "agreement_guard_blocked_action",
  "client_confirmation_recorded",
  "agreement_cancelled",
] as const);
const agreementActorRoleEnum = createStringEnum(["client", "freelancer", "system"] as const);
const agreementLockedByEnum = createStringEnum(["system", "client", "escrow_funding"] as const);
const agreementLockReasonEnum = createStringEnum([
  "work_started",
  "escrow_funded",
  "manual_lock",
  "proof_enabled",
] as const);

export const AGREEMENT_TYPES = agreementTypeEnum.map;
export const AGREEMENT_STATUSES = agreementStatusEnum.map;
export const AGREEMENT_EVENT_TYPES = agreementEventTypeEnum.map;
export const AGREEMENT_ACTOR_ROLES = agreementActorRoleEnum.map;
export const AGREEMENT_LOCKED_BY = agreementLockedByEnum.map;
export const AGREEMENT_LOCK_REASONS = agreementLockReasonEnum.map;

export const agreementTypeValidator = agreementTypeEnum.validator;
export const agreementStatusValidator = agreementStatusEnum.validator;
export const agreementEventTypeValidator = agreementEventTypeEnum.validator;
export const agreementActorRoleValidator = agreementActorRoleEnum.validator;
export const agreementLockedByValidator = agreementLockedByEnum.validator;
export const agreementLockReasonValidator = agreementLockReasonEnum.validator;

export type TAgreementType = Infer<typeof agreementTypeValidator>;
export type TAgreementStatus = Infer<typeof agreementStatusValidator>;
export type TAgreementEventType = Infer<typeof agreementEventTypeValidator>;
export type TAgreementActorRole = Infer<typeof agreementActorRoleValidator>;
export type TAgreementLockedBy = Infer<typeof agreementLockedByValidator>;
export type TAgreementLockReason = Infer<typeof agreementLockReasonValidator>;

export const agreementMetadataValidator = v.optional(v.any());

export const workAgreementEvents = defineTable({
  agreementId: v.id("workAgreements"),
  jobId: v.id("jobs"),
  escrowId: v.optional(v.id("escrows")),
  type: agreementEventTypeValidator,
  actorWallet: v.string(),
  actorWalletType: v.optional(walletTypeValidator),
  actorRole: agreementActorRoleValidator,
  message: v.string(),
  oldStatus: v.optional(agreementStatusValidator),
  newStatus: v.optional(agreementStatusValidator),
  createdAt: v.number(),
  metadata: agreementMetadataValidator,
})
  .index("by_agreement", ["agreementId", "createdAt"])
  .index("by_job", ["jobId", "createdAt"]);

export default defineTable({
  agreementNumber: v.string(),
  jobId: v.id("jobs"),
  microGigId: v.optional(v.id("jobs")),
  milestoneGroupId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  onChainEscrowId: v.optional(v.string()),
  clientWallet: v.string(),
  clientWalletType: walletTypeValidator,
  freelancerWallet: v.optional(v.string()),
  freelancerWalletType: v.optional(walletTypeValidator),
  agreementType: agreementTypeValidator,
  status: agreementStatusValidator,
  title: v.string(),
  version: v.number(),
  contentMarkdown: v.optional(v.string()),
  contentHtml: v.optional(v.string()),
  sourceAttachmentId: v.optional(v.id("attachments")),
  generatedFromSnapshot: v.optional(v.any()),
  sentToFreelancerAt: v.optional(v.number()),
  acceptedByFreelancerAt: v.optional(v.number()),
  acceptedByFreelancerWallet: v.optional(v.string()),
  acceptedByFreelancerWalletType: v.optional(walletTypeValidator),
  rejectedByFreelancerAt: v.optional(v.number()),
  rejectedByFreelancerWallet: v.optional(v.string()),
  rejectedByFreelancerWalletType: v.optional(walletTypeValidator),
  rejectionReason: v.optional(v.string()),
  clientConfirmedAt: v.optional(v.number()),
  clientConfirmedByWallet: v.optional(v.string()),
  clientConfirmedByWalletType: v.optional(walletTypeValidator),
  lockedAt: v.optional(v.number()),
  lockedBy: v.optional(agreementLockedByValidator),
  lockReason: v.optional(agreementLockReasonValidator),
  immutableSnapshot: v.optional(v.any()),
  agreementHash: v.optional(v.string()),
  hashAlgorithm: v.optional(v.literal("sha256")),
  hashEncoding: v.optional(v.literal("hex")),
  acceptedSnapshotHash: v.optional(v.string()),
  lockedSnapshotHash: v.optional(v.string()),
  statusReason: v.optional(v.string()),
  paymentAmount: v.number(),
  paymentAssetContractId: v.string(),
  paymentAssetSymbol: v.string(),
  paymentAssetDecimals: v.number(),
  deadlineAt: v.optional(v.number()),
  revisionPolicy: v.optional(v.string()),
  revisionLimit: v.optional(v.union(v.number(), v.null())),
  contentProtectionEnabled: v.boolean(),
  disputePolicyVersion: v.optional(v.string()),
  cancellationPolicyVersion: v.optional(v.string()),
  createdByWallet: v.string(),
  createdByWalletType: walletTypeValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: agreementMetadataValidator,
})
  .index("by_job", ["jobId", "status"])
  .index("by_clientWallet", ["clientWallet", "createdAt"])
  .index("by_freelancerWallet", ["freelancerWallet", "createdAt"])
  .index("by_agreementNumber", ["agreementNumber"]);
