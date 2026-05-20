import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { walletTypeValidator } from "../users/schema";

const deadlineParentTypeEnum = createStringEnum(["micro_gig", "milestone"] as const);
const deadlineReminderTypeEnum = createStringEnum([
  "deadline_24h",
  "deadline_6h",
  "deadline_1h",
  "deadline_overdue",
] as const);
const deadlineReminderStatusEnum = createStringEnum([
  "pending",
  "sent",
  "skipped",
  "failed",
] as const);
const notificationTypeEnum = createStringEnum([
  "deadline_warning",
  "deadline_overdue",
  "revision_requested",
  "revision_submitted",
  "revision_limit_reached",
  "preview_submitted",
  "preview_accepted",
  "dispute_opened",
  "dispute_on_chain_marked",
  "dispute_on_chain_mark_failed",
  "dispute_evidence_added",
  "dispute_response_added",
  "dispute_status_changed",
  "cancellation_requested",
  "cancellation_freelancer_responded",
  "cancellation_approved",
  "cancellation_on_chain_started",
  "cancellation_on_chain_succeeded",
  "cancellation_on_chain_failed",
  "cancellation_blocked",
  "cancellation_withdrawn",
  "cancellation_expired",
] as const);

export const deadlineParentTypeValidator = deadlineParentTypeEnum.validator;
export const deadlineReminderTypeValidator = deadlineReminderTypeEnum.validator;
export const deadlineReminderStatusValidator = deadlineReminderStatusEnum.validator;
export const notificationTypeValidator = notificationTypeEnum.validator;

export type TDeadlineParentType = Infer<typeof deadlineParentTypeValidator>;
export type TDeadlineReminderType = Infer<typeof deadlineReminderTypeValidator>;
export type TDeadlineReminderStatus = Infer<typeof deadlineReminderStatusValidator>;
export type TNotificationType = Infer<typeof notificationTypeValidator>;

export const deadlineReminders = defineTable({
  parentType: deadlineParentTypeValidator,
  parentId: v.string(),
  jobId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  clientWallet: v.string(),
  freelancerWallet: v.optional(v.string()),
  reminderType: deadlineReminderTypeValidator,
  scheduledFor: v.number(),
  sentAt: v.optional(v.number()),
  status: deadlineReminderStatusValidator,
  recipientWallets: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_parent", ["parentType", "parentId"])
  .index("by_parent_reminder", ["parentType", "parentId", "reminderType"])
  .index("by_status_scheduledFor", ["status", "scheduledFor"]);

export const notifications = defineTable({
  recipientWallet: v.string(),
  recipientWalletType: v.optional(walletTypeValidator),
  type: notificationTypeValidator,
  title: v.string(),
  body: v.string(),
  parentType: deadlineParentTypeValidator,
  parentId: v.string(),
  jobId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_recipient", ["recipientWallet", "createdAt"])
  .index("by_recipient_readAt", ["recipientWallet", "readAt"])
  .index("by_parent", ["parentType", "parentId"]);

export const deadlineAuditEvents = defineTable({
  parentType: deadlineParentTypeValidator,
  parentId: v.string(),
  oldDeadlineAt: v.optional(v.number()),
  newDeadlineAt: v.number(),
  changedByWallet: v.string(),
  changedByWalletType: v.optional(walletTypeValidator),
  reason: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_parent", ["parentType", "parentId"])
  .index("by_changedByWallet", ["changedByWallet", "createdAt"]);
