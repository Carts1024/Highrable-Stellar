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
  "chat_message",
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

export const ATTACHMENT_TYPES = attachmentTypeEnum.map;
export const ATTACHMENT_OWNER_ROLES = attachmentOwnerRoleEnum.map;
export const ATTACHMENT_PARENT_TYPES = attachmentParentTypeEnum.map;
export const ATTACHMENT_VISIBILITIES = attachmentVisibilityEnum.map;
export const ATTACHMENT_STATUSES = attachmentStatusEnum.map;

export const attachmentTypeValidator = attachmentTypeEnum.validator;
export const attachmentOwnerRoleValidator = attachmentOwnerRoleEnum.validator;
export const attachmentParentTypeValidator = attachmentParentTypeEnum.validator;
export const attachmentVisibilityValidator = attachmentVisibilityEnum.validator;
export const attachmentStatusValidator = attachmentStatusEnum.validator;

export type TAttachmentType = Infer<typeof attachmentTypeValidator>;
export type TAttachmentOwnerRole = Infer<typeof attachmentOwnerRoleValidator>;
export type TAttachmentParentType = Infer<typeof attachmentParentTypeValidator>;
export type TAttachmentVisibility = Infer<typeof attachmentVisibilityValidator>;
export type TAttachmentStatus = Infer<typeof attachmentStatusValidator>;

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
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_parent", ["parentType", "parentId", "status"])
  .index("by_uploader", ["uploadedByWallet", "status"])
  .index("by_storageId", ["storageId"]);
