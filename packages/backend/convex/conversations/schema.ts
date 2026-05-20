import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { walletTypeValidator } from "../users/schema";

const conversationParentTypeEnum = createStringEnum([
  "job",
  "micro_gig",
  "milestone",
  "escrow",
  "work_submission",
  "dispute",
  "direct",
] as const);

const conversationStatusEnum = createStringEnum(["active", "archived", "locked"] as const);

const messageSenderRoleEnum = createStringEnum([
  "client",
  "freelancer",
  "admin",
  "system",
] as const);
const messageKindEnum = createStringEnum(["user", "system", "event"] as const);
const messageStatusEnum = createStringEnum(["sent", "deleted", "hidden"] as const);
const messageEventTypeEnum = createStringEnum([
  "escrow_created",
  "escrow_funded",
  "work_submitted",
  "preview_submitted",
  "preview_accepted",
  "proof_anchored",
  "work_approved",
  "escrow_released",
  "escrow_cancelled",
  "revision_requested",
  "revision_submitted",
  "deadline_warning",
  "deadline_missed",
  "dispute_opened",
  "dispute_resolved",
] as const);

export const conversationParentTypeValidator = conversationParentTypeEnum.validator;
export const conversationStatusValidator = conversationStatusEnum.validator;
export const messageSenderRoleValidator = messageSenderRoleEnum.validator;
export const messageKindValidator = messageKindEnum.validator;
export const messageStatusValidator = messageStatusEnum.validator;
export const messageEventTypeValidator = messageEventTypeEnum.validator;

export type TConversationParentType = Infer<typeof conversationParentTypeValidator>;
export type TConversationStatus = Infer<typeof conversationStatusValidator>;
export type TMessageSenderRole = Infer<typeof messageSenderRoleValidator>;
export type TMessageKind = Infer<typeof messageKindValidator>;
export type TMessageStatus = Infer<typeof messageStatusValidator>;
export type TMessageEventType = Infer<typeof messageEventTypeValidator>;

export const participantWalletTypeValidator = v.object({
  walletAddress: v.string(),
  walletType: v.optional(walletTypeValidator),
});

export const conversations = defineTable({
  parentType: conversationParentTypeValidator,
  parentId: v.string(),
  jobId: v.optional(v.id("jobs")),
  microGigId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  workSubmissionId: v.optional(v.id("workSubmissions")),
  disputeId: v.optional(v.string()),
  participantWallets: v.array(v.string()),
  participantWalletTypes: v.optional(v.array(participantWalletTypeValidator)),
  clientWallet: v.optional(v.string()),
  freelancerWallet: v.optional(v.string()),
  title: v.optional(v.string()),
  status: conversationStatusValidator,
  lastMessageId: v.optional(v.id("messages")),
  lastMessagePreview: v.optional(v.string()),
  lastMessageAt: v.optional(v.number()),
  createdByWallet: v.string(),
  createdByWalletType: v.optional(walletTypeValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_parent", ["parentType", "parentId"])
  .index("by_clientWallet", ["clientWallet", "updatedAt"])
  .index("by_freelancerWallet", ["freelancerWallet", "updatedAt"])
  .index("by_status", ["status", "updatedAt"]);

export const messages = defineTable({
  conversationId: v.id("conversations"),
  parentType: conversationParentTypeValidator,
  parentId: v.string(),
  senderWallet: v.string(),
  senderWalletType: v.union(walletTypeValidator, v.literal("system")),
  senderRole: messageSenderRoleValidator,
  kind: messageKindValidator,
  body: v.string(),
  attachmentIds: v.array(v.id("attachments")),
  replyToMessageId: v.optional(v.id("messages")),
  eventType: v.optional(messageEventTypeValidator),
  eventPayload: v.optional(v.any()),
  status: messageStatusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_conversation", ["conversationId", "createdAt"])
  .index("by_sender", ["senderWallet", "createdAt"])
  .index("by_event", ["eventType", "createdAt"]);

export const conversationReads = defineTable({
  conversationId: v.id("conversations"),
  walletAddress: v.string(),
  walletType: v.optional(walletTypeValidator),
  lastReadMessageId: v.optional(v.id("messages")),
  lastReadAt: v.number(),
  unreadCountSnapshot: v.optional(v.number()),
  updatedAt: v.number(),
})
  .index("by_conversation_wallet", ["conversationId", "walletAddress"])
  .index("by_wallet", ["walletAddress", "updatedAt"]);
