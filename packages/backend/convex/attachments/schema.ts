import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { walletTypeValidator } from "../users/schema";

const attachmentTypeEnum = createStringEnum([
  "image",
  "video",
  "video_link",
  "link",
  "document",
  "pdf",
  "markdown",
  "file",
] as const);

const attachmentOwnerRoleEnum = createStringEnum([
  "client",
  "freelancer",
  "admin",
  "system",
] as const);

const attachmentParentTypeEnum = createStringEnum([
  "job",
  "milestone",
  "work_submission",
  "revision_request",
  "dispute",
  "cancellation",
  "chat_message",
  "work_agreement",
  "profile",
  "unknown",
] as const);

const attachmentVisibilityEnum = createStringEnum([
  "private",
  "participants",
  "public",
  "admin_only",
] as const);

const attachmentStatusEnum = createStringEnum(["active", "deleted", "blocked"] as const);
const attachmentProtectionModeEnum = createStringEnum([
  "standard",
  "protected_preview",
  "download_restricted",
] as const);
const attachmentViewerRoleEnum = createStringEnum([
  "client",
  "assigned_freelancer",
  "dispute_participant",
  "dispute_reviewer",
  "admin",
  "owner",
  "public",
] as const);
const attachmentAccessActionEnum = createStringEnum([
  "preview_opened",
  "preview_url_generated",
  "download_requested",
  "download_allowed",
  "download_blocked",
  "copy_attempt_blocked",
  "print_attempt_blocked",
  "visibility_hidden",
  "watermark_rendered",
  "access_denied",
] as const);
const attachmentAccessResultEnum = createStringEnum(["allowed", "blocked", "failed"] as const);

export const ATTACHMENT_TYPES = attachmentTypeEnum.map;
export const ATTACHMENT_OWNER_ROLES = attachmentOwnerRoleEnum.map;
export const ATTACHMENT_PARENT_TYPES = attachmentParentTypeEnum.map;
export const ATTACHMENT_VISIBILITIES = attachmentVisibilityEnum.map;
export const ATTACHMENT_STATUSES = attachmentStatusEnum.map;
export const ATTACHMENT_PROTECTION_MODES = attachmentProtectionModeEnum.map;
export const ATTACHMENT_VIEWER_ROLES = attachmentViewerRoleEnum.map;
export const ATTACHMENT_ACCESS_ACTIONS = attachmentAccessActionEnum.map;
export const ATTACHMENT_ACCESS_RESULTS = attachmentAccessResultEnum.map;

export const attachmentTypeValidator = attachmentTypeEnum.validator;
export const attachmentOwnerRoleValidator = attachmentOwnerRoleEnum.validator;
export const attachmentParentTypeValidator = attachmentParentTypeEnum.validator;
export const attachmentVisibilityValidator = attachmentVisibilityEnum.validator;
export const attachmentStatusValidator = attachmentStatusEnum.validator;
export const attachmentProtectionModeValidator = attachmentProtectionModeEnum.validator;
export const attachmentViewerRoleValidator = attachmentViewerRoleEnum.validator;
export const attachmentAccessActionValidator = attachmentAccessActionEnum.validator;
export const attachmentAccessResultValidator = attachmentAccessResultEnum.validator;

export type TAttachmentType = Infer<typeof attachmentTypeValidator>;
export type TAttachmentOwnerRole = Infer<typeof attachmentOwnerRoleValidator>;
export type TAttachmentParentType = Infer<typeof attachmentParentTypeValidator>;
export type TAttachmentVisibility = Infer<typeof attachmentVisibilityValidator>;
export type TAttachmentStatus = Infer<typeof attachmentStatusValidator>;
export type TAttachmentProtectionMode = Infer<typeof attachmentProtectionModeValidator>;
export type TAttachmentViewerRole = Infer<typeof attachmentViewerRoleValidator>;
export type TAttachmentAccessAction = Infer<typeof attachmentAccessActionValidator>;
export type TAttachmentAccessResult = Infer<typeof attachmentAccessResultValidator>;

export const attachmentProtectionMetadataValidator = v.optional(v.any());

export default defineTable({
  storageId: v.optional(v.id("_storage")),
  externalUrl: v.optional(v.string()),
  type: attachmentTypeValidator,
  name: v.string(),
  size: v.optional(v.number()),
  mimeType: v.optional(v.string()),
  extension: v.optional(v.string()),
  uploadedByWallet: v.string(),
  uploadedByWalletType: v.optional(walletTypeValidator),
  ownerRole: attachmentOwnerRoleValidator,
  parentType: attachmentParentTypeValidator,
  parentId: v.optional(v.string()),
  visibility: attachmentVisibilityValidator,
  status: attachmentStatusValidator,
  protectionMode: v.optional(attachmentProtectionModeValidator),
  downloadAllowed: v.optional(v.boolean()),
  previewAllowed: v.optional(v.boolean()),
  watermarkEnabled: v.optional(v.boolean()),
  accessLoggingEnabled: v.optional(v.boolean()),
  allowedViewerRoles: v.optional(v.array(attachmentViewerRoleValidator)),
  expiresAt: v.optional(v.number()),
  protectedReason: v.optional(v.string()),
  createdProtectionAt: v.optional(v.number()),
  updatedProtectionAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_parent", ["parentType", "parentId", "status"])
  .index("by_uploader", ["uploadedByWallet", "status"])
  .index("by_storageId", ["storageId"]);

export const attachmentAccessLogs = defineTable({
  attachmentId: v.id("attachments"),
  parentType: attachmentParentTypeValidator,
  parentId: v.optional(v.string()),
  viewerWallet: v.optional(v.string()),
  viewerWalletType: v.optional(walletTypeValidator),
  viewerRole: v.optional(attachmentViewerRoleValidator),
  action: attachmentAccessActionValidator,
  result: attachmentAccessResultValidator,
  reason: v.optional(v.string()),
  ipHash: v.optional(v.string()),
  userAgentHash: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  createdAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_attachment", ["attachmentId", "createdAt"])
  .index("by_parent", ["parentType", "parentId", "createdAt"])
  .index("by_viewer", ["viewerWallet", "createdAt"]);
