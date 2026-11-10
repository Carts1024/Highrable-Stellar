import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const publicationModeEnum = createStringEnum(["freelancer", "client"] as const);
const visibilityEnum = createStringEnum([
  "visible",
  "moderation_hidden",
  "author_deleted",
] as const);
const reportTargetEnum = createStringEnum(["post", "comment"] as const);
const reportReasonEnum = createStringEnum([
  "spam",
  "harassment",
  "inappropriate_content",
  "other",
] as const);
const reportStatusEnum = createStringEnum(["open", "reviewed", "dismissed"] as const);
const moderationActionEnum = createStringEnum(["hide", "restore", "dismiss_report"] as const);
const requestOperationEnum = createStringEnum([
  "create_post",
  "create_comment",
  "moderation_action",
] as const);
const rateLimitOperationEnum = createStringEnum([
  "post",
  "comment",
  "like",
  "report",
  "upload",
] as const);

export const publicationModeValidator = publicationModeEnum.validator;
export const newsfeedVisibilityValidator = visibilityEnum.validator;
export const newsfeedReportTargetValidator = reportTargetEnum.validator;
export const newsfeedReportReasonValidator = reportReasonEnum.validator;
export const newsfeedReportStatusValidator = reportStatusEnum.validator;
export const newsfeedModerationActionValidator = moderationActionEnum.validator;
export const newsfeedRequestOperationValidator = requestOperationEnum.validator;
export const newsfeedRateLimitOperationValidator = rateLimitOperationEnum.validator;

export type TNewsfeedPublicationMode = Infer<typeof publicationModeValidator>;
export type TNewsfeedVisibility = Infer<typeof newsfeedVisibilityValidator>;
export type TNewsfeedReportTarget = Infer<typeof newsfeedReportTargetValidator>;
export type TNewsfeedReportReason = Infer<typeof newsfeedReportReasonValidator>;
export type TNewsfeedReportStatus = Infer<typeof newsfeedReportStatusValidator>;
export type TNewsfeedModerationAction = Infer<typeof newsfeedModerationActionValidator>;
export type TNewsfeedRequestOperation = Infer<typeof newsfeedRequestOperationValidator>;
export type TNewsfeedRateLimitOperation = Infer<typeof newsfeedRateLimitOperationValidator>;

export const photoInput = v.object({ uploadId: v.id("newsfeedUploads"), description: v.string() });
export const newsfeedCleanupCursors = defineTable({ cursor: v.union(v.string(), v.null()) });
export const newsfeedUploads = defineTable({
  ownerId: v.id("users"),
  sessionId: v.string(),
  walletAddress: v.string(),
  credentialHash: v.string(),
  credentialExpiresAt: v.number(),
  state: v.union(
    v.literal("reserved"),
    v.literal("transferring"),
    v.literal("ready"),
    v.literal("attached"),
    v.literal("cancelled"),
  ),
  expiresAt: v.number(),
  storageId: v.optional(v.id("_storage")),
  format: v.optional(v.string()),
  size: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  postId: v.optional(v.id("newsfeedPosts")),
})
  .index("by_owner", ["ownerId"])
  .index("by_owner_unattached_expiration", ["ownerId", "postId", "expiresAt"])
  .index("by_expiration", ["expiresAt"])
  .index("by_storage", ["storageId"])
  .index("by_post", ["postId"]);
export const newsfeedMediaGrants = defineTable({
  credentialHash: v.string(),
  mediaId: v.id("newsfeedUploads"),
  sessionId: v.string(),
  walletAddress: v.string(),
  moderation: v.boolean(),
  expiresAt: v.number(),
})
  .index("by_hash", ["credentialHash"])
  .index("by_expiration", ["expiresAt"]);
export const newsfeedPosts = defineTable({
  photos: v.optional(v.array(photoInput)),
  authorUserId: v.id("users"),
  publicationMode: publicationModeValidator,
  text: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  visibility: newsfeedVisibilityValidator,
  likeCount: v.number(),
  commentCount: v.number(),
})
  .index("by_visibility_createdAt", ["visibility", "createdAt"])
  .index("by_author_createdAt", ["authorUserId", "createdAt"])
  .index("by_createdAt", ["createdAt"]);

export const newsfeedComments = defineTable({
  postId: v.id("newsfeedPosts"),
  authorUserId: v.id("users"),
  publicationMode: publicationModeValidator,
  text: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  visibility: newsfeedVisibilityValidator,
})
  .index("by_post_visibility_createdAt", ["postId", "visibility", "createdAt"])
  .index("by_post_createdAt", ["postId", "createdAt"])
  .index("by_author_createdAt", ["authorUserId", "createdAt"]);

export const newsfeedPostLikes = defineTable({
  postId: v.id("newsfeedPosts"),
  userId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_post_user", ["postId", "userId"])
  .index("by_user_post", ["userId", "postId"]);

export const newsfeedReports = defineTable({
  reporterUserId: v.id("users"),
  targetType: newsfeedReportTargetValidator,
  targetId: v.union(v.id("newsfeedPosts"), v.id("newsfeedComments")),
  reason: newsfeedReportReasonValidator,
  explanation: v.optional(v.string()),
  status: newsfeedReportStatusValidator,
  createdAt: v.number(),
  reviewedAt: v.optional(v.number()),
  reviewedByUserId: v.optional(v.id("users")),
})
  .index("by_status_createdAt", ["status", "createdAt"])
  .index("by_reporter_target", ["reporterUserId", "targetType", "targetId"])
  .index("by_target_status", ["targetType", "targetId", "status"]);

export const newsfeedModerationActions = defineTable({
  actorUserId: v.id("users"),
  targetType: newsfeedReportTargetValidator,
  targetId: v.union(v.id("newsfeedPosts"), v.id("newsfeedComments")),
  action: newsfeedModerationActionValidator,
  reason: v.string(),
  createdAt: v.number(),
  previousVisibility: v.optional(newsfeedVisibilityValidator),
  newVisibility: v.optional(newsfeedVisibilityValidator),
  reportId: v.optional(v.id("newsfeedReports")),
  requestId: v.string(),
})
  .index("by_target_createdAt", ["targetType", "targetId", "createdAt"])
  .index("by_request", ["actorUserId", "requestId"])
  .index("by_createdAt", ["createdAt"]);

export const newsfeedRequestDeduplication = defineTable({
  userId: v.id("users"),
  operation: newsfeedRequestOperationValidator,
  requestId: v.string(),
  payloadFingerprint: v.string(),
  resultType: v.union(v.literal("post"), v.literal("comment"), v.literal("moderation_action")),
  resultId: v.string(),
  createdAt: v.number(),
})
  .index("by_user_operation_request", ["userId", "operation", "requestId"])
  .index("by_createdAt", ["createdAt"]);

export const newsfeedRateLimitWindows = defineTable({
  userId: v.id("users"),
  operation: newsfeedRateLimitOperationValidator,
  windowStartedAt: v.number(),
  count: v.number(),
}).index("by_user_operation", ["userId", "operation"]);
