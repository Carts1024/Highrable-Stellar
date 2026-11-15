import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import { mutation } from "../_generated/server";
import { ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  assertModerationReason,
  assertNewsfeedTextEnabled,
  assertTargetMatches,
  consumeNewsfeedRateLimit,
  requireNewsfeedActor,
  sanitizeNewsfeedText,
  sanitizeReportExplanation,
} from "./helpers";
import { enabled as photosEnabled } from "./photos";
import { enabledForKind } from "./photos";
import { photoInput, videoInput } from "./schema";
import {
  newsfeedModerationActionValidator,
  newsfeedReportReasonValidator,
  newsfeedReportTargetValidator,
  publicationModeValidator,
} from "./schema";

const sessionArgs = {
  serviceSecret: v.string(),
  sessionId: v.string(),
  walletAddress: v.string(),
};

async function getRequestDeduplication(
  ctx: MutationCtx,
  userId: Id<"users">,
  operation: "create_post" | "create_comment" | "moderation_action",
  requestId: string,
  payloadFingerprint: string,
) {
  const existing = await ctx.db
    .query("newsfeedRequestDeduplication")
    .withIndex("by_user_operation_request", (q) =>
      q.eq("userId", userId).eq("operation", operation).eq("requestId", requestId),
    )
    .unique();
  if (!existing) {
    return null;
  }
  if (existing.payloadFingerprint !== payloadFingerprint) {
    throw new ConflictError("Request ID was already used with a different payload.");
  }
  return existing;
}

function assertRequestId(requestId: string): string {
  const normalized = requestId.trim();
  if (!normalized || normalized.length > 128) {
    throw new Error("requestId is required and must be 128 characters or fewer.");
  }
  return normalized;
}

async function getTarget(
  ctx: MutationCtx,
  targetType: "post" | "comment",
  targetId: Id<"newsfeedPosts"> | Id<"newsfeedComments">,
): Promise<Doc<"newsfeedPosts"> | Doc<"newsfeedComments"> | null> {
  return targetType === "post"
    ? await ctx.db.get(targetId as Id<"newsfeedPosts">)
    : await ctx.db.get(targetId as Id<"newsfeedComments">);
}

async function countVisibleComments(
  ctx: MutationCtx,
  postId: Id<"newsfeedPosts">,
): Promise<number> {
  return (
    await ctx.db
      .query("newsfeedComments")
      .withIndex("by_post_visibility_createdAt", (q) =>
        q.eq("postId", postId).eq("visibility", "visible"),
      )
      .collect()
  ).length;
}

export const createPost = mutation({
  args: {
    ...sessionArgs,
    photos: v.optional(v.array(photoInput)),
    video: v.optional(videoInput),
    requestId: v.string(),
    publicationMode: publicationModeValidator,
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const requestId = assertRequestId(args.requestId);
    const photos = (args.photos ?? []).map((photo) => ({
      ...photo,
      description: photo.description.trim(),
    }));
    if (photos.length && args.video)
      throw new Error("A post can contain photos or one video, not both.");
    if (photos.length > 4 || new Set(photos.map((p) => p.uploadId)).size !== photos.length)
      throw new Error("Choose up to four distinct photos.");
    if (photos.some((p) => !p.description || Array.from(p.description).length > 500))
      throw new Error("Photo descriptions must contain 1–500 characters.");
    if (photos.length) photosEnabled();
    const video = args.video
      ? { ...args.video, description: args.video.description.trim() }
      : undefined;
    if (video) {
      if (!video.description || Array.from(video.description).length > 500)
        throw new Error("Video descriptions must contain 1–500 characters.");
      enabledForKind("video");
    }
    const text =
      (photos.length || video) && !args.text.trim() ? "" : sanitizeNewsfeedText(args.text);
    const payloadFingerprint = JSON.stringify({
      publicationMode: args.publicationMode,
      text,
      ...(photos.length ? { photos } : {}),
      ...(video ? { video } : {}),
    });
    const existing = await getRequestDeduplication(
      ctx,
      actor.user._id,
      "create_post",
      requestId,
      payloadFingerprint,
    );
    if (existing) {
      return { postId: existing.resultId as Id<"newsfeedPosts">, duplicate: true };
    }

    for (const photo of photos) {
      const upload = await ctx.db.get(photo.uploadId);
      if (
        !upload ||
        upload.ownerId !== actor.user._id ||
        upload.sessionId !== args.sessionId ||
        upload.state !== "ready" ||
        (upload.kind !== undefined && upload.kind !== "photo") ||
        upload.postId ||
        upload.expiresAt <= Date.now()
      )
        throw new Error("Photo upload is unavailable.");
    }
    if (video) {
      const upload = await ctx.db.get(video.uploadId);
      if (
        !upload ||
        upload.ownerId !== actor.user._id ||
        upload.sessionId !== args.sessionId ||
        upload.state !== "ready" ||
        upload.kind !== "video" ||
        upload.postId ||
        upload.expiresAt <= Date.now()
      )
        throw new Error("Video upload is unavailable.");
    }
    await consumeNewsfeedRateLimit(ctx, actor.user._id, "post");
    const now = Date.now();
    const postId = await ctx.db.insert("newsfeedPosts", {
      photos,
      ...(video ? { video } : {}),
      authorUserId: actor.user._id,
      publicationMode: args.publicationMode,
      text,
      createdAt: now,
      updatedAt: now,
      visibility: "visible",
      likeCount: 0,
      commentCount: 0,
    });
    for (const photo of photos)
      await ctx.db.patch(photo.uploadId, {
        state: "attached",
        postId,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
    if (video)
      await ctx.db.patch(video.uploadId, {
        state: "attached",
        postId,
        expiresAt: Number.MAX_SAFE_INTEGER,
      });
    await ctx.db.insert("newsfeedRequestDeduplication", {
      userId: actor.user._id,
      operation: "create_post",
      requestId,
      payloadFingerprint,
      resultType: "post",
      resultId: postId,
      createdAt: now,
    });
    return { postId, duplicate: false };
  },
});

export const updatePost = mutation({
  args: {
    ...sessionArgs,
    postId: v.id("newsfeedPosts"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const post = await ctx.db.get(args.postId);
    if (!post || post.visibility !== "visible") {
      throw new NotFoundError("Post is unavailable.");
    }
    if (post.authorUserId !== actor.user._id) {
      throw new ForbiddenError("Only the post author can edit this post.");
    }
    const text =
      (post.photos?.length || post.video) && !args.text.trim()
        ? ""
        : sanitizeNewsfeedText(args.text);
    await ctx.db.patch(post._id, { text, updatedAt: Date.now() });
    return { postId: post._id };
  },
});

export const deletePost = mutation({
  args: {
    ...sessionArgs,
    postId: v.id("newsfeedPosts"),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new NotFoundError("Post is unavailable.");
    }
    if (post.authorUserId !== actor.user._id) {
      throw new ForbiddenError("Only the post author can delete this post.");
    }
    if (post.visibility === "author_deleted") {
      return { postId: post._id, deleted: true };
    }
    await ctx.db.patch(post._id, {
      visibility: "author_deleted",
      commentCount: 0,
      updatedAt: Date.now(),
    });
    for (const photo of post.photos ?? [])
      await ctx.db.patch(photo.uploadId, { state: "cancelled", expiresAt: 0 });
    if (post.video) await ctx.db.patch(post.video.uploadId, { state: "cancelled", expiresAt: 0 });
    return { postId: post._id, deleted: true };
  },
});

export const setPostLike = mutation({
  args: {
    ...sessionArgs,
    postId: v.id("newsfeedPosts"),
    liked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const post = await ctx.db.get(args.postId);
    if (!post || post.visibility !== "visible") {
      throw new NotFoundError("Post is unavailable.");
    }
    const existing = await ctx.db
      .query("newsfeedPostLikes")
      .withIndex("by_post_user", (q) => q.eq("postId", post._id).eq("userId", actor.user._id))
      .unique();
    const currentlyLiked = Boolean(existing);
    if (currentlyLiked === args.liked) {
      return { postId: post._id, liked: currentlyLiked, likeCount: post.likeCount };
    }

    await consumeNewsfeedRateLimit(ctx, actor.user._id, "like");
    if (args.liked) {
      await ctx.db.insert("newsfeedPostLikes", {
        postId: post._id,
        userId: actor.user._id,
        createdAt: Date.now(),
      });
    } else if (existing) {
      await ctx.db.delete(existing._id);
    }
    const likeCount = Math.max(post.likeCount + (args.liked ? 1 : -1), 0);
    await ctx.db.patch(post._id, { likeCount });
    return { postId: post._id, liked: args.liked, likeCount };
  },
});

export const createComment = mutation({
  args: {
    ...sessionArgs,
    postId: v.id("newsfeedPosts"),
    requestId: v.string(),
    publicationMode: publicationModeValidator,
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const post = await ctx.db.get(args.postId);
    if (!post || post.visibility !== "visible") {
      throw new NotFoundError("Post is unavailable.");
    }
    const requestId = assertRequestId(args.requestId);
    const text = sanitizeNewsfeedText(args.text, "comment");
    const payloadFingerprint = JSON.stringify({
      postId: args.postId,
      publicationMode: args.publicationMode,
      text,
    });
    const existing = await getRequestDeduplication(
      ctx,
      actor.user._id,
      "create_comment",
      requestId,
      payloadFingerprint,
    );
    if (existing) {
      return { commentId: existing.resultId as Id<"newsfeedComments">, duplicate: true };
    }

    await consumeNewsfeedRateLimit(ctx, actor.user._id, "comment");
    const now = Date.now();
    const commentId = await ctx.db.insert("newsfeedComments", {
      postId: post._id,
      authorUserId: actor.user._id,
      publicationMode: args.publicationMode,
      text,
      createdAt: now,
      updatedAt: now,
      visibility: "visible",
    });
    await ctx.db.patch(post._id, { commentCount: post.commentCount + 1 });
    await ctx.db.insert("newsfeedRequestDeduplication", {
      userId: actor.user._id,
      operation: "create_comment",
      requestId,
      payloadFingerprint,
      resultType: "comment",
      resultId: commentId,
      createdAt: now,
    });
    return { commentId, duplicate: false };
  },
});

export const updateComment = mutation({
  args: {
    ...sessionArgs,
    commentId: v.id("newsfeedComments"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.visibility !== "visible") {
      throw new NotFoundError("Comment is unavailable.");
    }
    const post = await ctx.db.get(comment.postId);
    if (!post || post.visibility !== "visible") {
      throw new NotFoundError("Post is unavailable.");
    }
    if (comment.authorUserId !== actor.user._id) {
      throw new ForbiddenError("Only the comment author can edit this comment.");
    }
    await ctx.db.patch(comment._id, {
      text: sanitizeNewsfeedText(args.text, "comment"),
      updatedAt: Date.now(),
    });
    return { commentId: comment._id };
  },
});

export const deleteComment = mutation({
  args: {
    ...sessionArgs,
    commentId: v.id("newsfeedComments"),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new NotFoundError("Comment is unavailable.");
    }
    if (comment.authorUserId !== actor.user._id) {
      throw new ForbiddenError("Only the comment author can delete this comment.");
    }
    if (comment.visibility === "author_deleted") {
      return { commentId: comment._id, deleted: true };
    }
    const post = await ctx.db.get(comment.postId);
    if (comment.visibility === "visible" && post?.visibility === "visible") {
      await ctx.db.patch(post._id, { commentCount: Math.max(post.commentCount - 1, 0) });
    }
    await ctx.db.patch(comment._id, {
      visibility: "author_deleted",
      updatedAt: Date.now(),
    });
    return { commentId: comment._id, deleted: true };
  },
});

export const createReport = mutation({
  args: {
    ...sessionArgs,
    requestId: v.string(),
    targetType: newsfeedReportTargetValidator,
    targetId: v.union(v.id("newsfeedPosts"), v.id("newsfeedComments")),
    reason: newsfeedReportReasonValidator,
    explanation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const target = await getTarget(ctx, args.targetType, args.targetId);
    assertTargetMatches(args.targetType, target);
    if (!target || target.visibility !== "visible") {
      throw new NotFoundError("Reported content is unavailable.");
    }
    if (args.targetType === "comment") {
      const comment = target as Doc<"newsfeedComments">;
      const post = await ctx.db.get(comment.postId);
      if (!post || post.visibility !== "visible") {
        throw new NotFoundError("Reported content is unavailable.");
      }
    }

    const requestId = assertRequestId(args.requestId);
    const existingOpen = await ctx.db
      .query("newsfeedReports")
      .withIndex("by_reporter_target", (q) =>
        q
          .eq("reporterUserId", actor.user._id)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId),
      )
      .filter((q) => q.eq(q.field("status"), "open"))
      .first();
    if (existingOpen) {
      return { reportId: existingOpen._id, duplicate: true };
    }

    await consumeNewsfeedRateLimit(ctx, actor.user._id, "report");
    const explanation = sanitizeReportExplanation(args.explanation);
    const reportId = await ctx.db.insert("newsfeedReports", {
      reporterUserId: actor.user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      reason: args.reason,
      ...(explanation !== undefined ? { explanation } : {}),
      status: "open",
      createdAt: Date.now(),
    });
    return { reportId, duplicate: false, requestId };
  },
});

export const applyModerationAction = mutation({
  args: {
    ...sessionArgs,
    requestId: v.string(),
    targetType: newsfeedReportTargetValidator,
    targetId: v.union(v.id("newsfeedPosts"), v.id("newsfeedComments")),
    action: newsfeedModerationActionValidator,
    reason: v.string(),
    reportId: v.optional(v.id("newsfeedReports")),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    if (!actor.isModerator) {
      throw new ForbiddenError(
        "Newsfeed moderation access is restricted to the configured allowlist.",
      );
    }
    const requestId = assertRequestId(args.requestId);
    const reason = assertModerationReason(args.reason);
    const payloadFingerprint = JSON.stringify({
      targetType: args.targetType,
      targetId: args.targetId,
      action: args.action,
      reason,
      reportId: args.reportId ?? null,
    });
    const existing = await getRequestDeduplication(
      ctx,
      actor.user._id,
      "moderation_action",
      requestId,
      payloadFingerprint,
    );
    if (existing) {
      return { actionId: existing.resultId as Id<"newsfeedModerationActions">, duplicate: true };
    }

    const target = await getTarget(ctx, args.targetType, args.targetId);
    assertTargetMatches(args.targetType, target);
    if (!target) {
      throw new NotFoundError("Moderation target is unavailable.");
    }

    const now = Date.now();
    let previousVisibility = target.visibility;
    let newVisibility: "visible" | "moderation_hidden" | undefined;

    if (args.action === "dismiss_report") {
      if (!args.reportId) {
        throw new Error("reportId is required when dismissing a report.");
      }
      const report = await ctx.db.get(args.reportId);
      if (!report || report.targetType !== args.targetType || report.targetId !== args.targetId) {
        throw new NotFoundError("Report is unavailable.");
      }
      if (report.status === "open") {
        await ctx.db.patch(report._id, {
          status: "dismissed",
          reviewedAt: now,
          reviewedByUserId: actor.user._id,
        });
      }
      previousVisibility = target.visibility;
    } else {
      if (target.visibility === "author_deleted") {
        throw new ConflictError("Author-deleted content cannot be restored or moderated.");
      }
      if (args.action === "hide") {
        if (target.visibility === "moderation_hidden") {
          throw new ConflictError("Content is already hidden.");
        }
        newVisibility = "moderation_hidden";
      } else {
        if (target.visibility !== "moderation_hidden") {
          throw new ConflictError("Only moderation-hidden content can be restored.");
        }
        newVisibility = "visible";
      }

      if (args.targetType === "post") {
        const post = target as Doc<"newsfeedPosts">;
        await ctx.db.patch(post._id, {
          visibility: newVisibility,
          commentCount: newVisibility === "visible" ? await countVisibleComments(ctx, post._id) : 0,
          updatedAt: now,
        });
      } else {
        const comment = target as Doc<"newsfeedComments">;
        const parent = await ctx.db.get(comment.postId);
        if (parent?.visibility === "visible") {
          await ctx.db.patch(parent._id, {
            commentCount: Math.max(parent.commentCount + (newVisibility === "visible" ? 1 : -1), 0),
          });
        }
        await ctx.db.patch(comment._id, { visibility: newVisibility, updatedAt: now });
      }
      if (args.reportId) {
        const report = await ctx.db.get(args.reportId);
        if (report && report.status === "open") {
          await ctx.db.patch(report._id, {
            status: "reviewed",
            reviewedAt: now,
            reviewedByUserId: actor.user._id,
          });
        }
      }
    }

    const actionId = await ctx.db.insert("newsfeedModerationActions", {
      actorUserId: actor.user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      action: args.action,
      reason,
      createdAt: now,
      previousVisibility,
      ...(newVisibility !== undefined ? { newVisibility } : {}),
      ...(args.reportId ? { reportId: args.reportId } : {}),
      requestId,
    });
    await ctx.db.insert("newsfeedRequestDeduplication", {
      userId: actor.user._id,
      operation: "moderation_action",
      requestId,
      payloadFingerprint,
      resultType: "moderation_action",
      resultId: actionId,
      createdAt: now,
    });
    return { actionId, duplicate: false };
  },
});

export { assertNewsfeedTextEnabled };
