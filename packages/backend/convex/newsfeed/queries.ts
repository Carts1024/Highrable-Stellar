import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { BadRequestError, ForbiddenError } from "../_shared/errors";
import { hydrateNewsfeedAuthors, NEWSFEED_PAGE_SIZE, requireNewsfeedActor } from "./helpers";
import {
  newsfeedReportStatusValidator,
  newsfeedReportTargetValidator,
  publicationModeValidator,
} from "./schema";

async function serializePost(
  ctx: QueryCtx,
  post: Doc<"newsfeedPosts">,
  viewerUserId: Id<"users">,
  viewerIsModerator: boolean,
) {
  const authors = await hydrateNewsfeedAuthors(ctx, [post.authorUserId]);
  const author = authors.get(post.authorUserId) ?? {
    displayName: "Unavailable member",
    avatarUrl: null,
    available: false,
  };
  const like = await ctx.db
    .query("newsfeedPostLikes")
    .withIndex("by_post_user", (q) => q.eq("postId", post._id).eq("userId", viewerUserId))
    .unique();

  return {
    id: post._id,
    text: post.text,
    photos: await Promise.all(
      (post.photos ?? []).map(async (photo) => {
        const upload = await ctx.db.get(photo.uploadId);
        return {
          mediaId: photo.uploadId,
          description: photo.description,
          width: upload?.width ?? 1,
          height: upload?.height ?? 1,
        };
      }),
    ),
    video: post.video
      ? await (async () => {
          const upload = await ctx.db.get(post.video!.uploadId);
          return {
            mediaId: post.video!.uploadId,
            description: post.video!.description,
            width: upload?.width ?? 1,
            height: upload?.height ?? 1,
            duration: upload?.duration ?? 0,
          };
        })()
      : null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    visibility: post.visibility,
    author: {
      ...author,
      publicationMode: post.publicationMode,
    },
    counts: { likes: post.likeCount, comments: post.commentCount },
    viewer: {
      liked: Boolean(like),
      canEdit: post.authorUserId === viewerUserId && post.visibility === "visible",
      canDelete: post.authorUserId === viewerUserId && post.visibility !== "author_deleted",
      canReport: post.visibility === "visible",
      isModerator: viewerIsModerator,
    },
  };
}

async function serializeComment(
  ctx: QueryCtx,
  comment: Doc<"newsfeedComments">,
  viewerUserId: Id<"users">,
  viewerIsModerator: boolean,
) {
  const authors = await hydrateNewsfeedAuthors(ctx, [comment.authorUserId]);
  const author = authors.get(comment.authorUserId) ?? {
    displayName: "Unavailable member",
    avatarUrl: null,
    available: false,
  };

  return {
    id: comment._id,
    postId: comment.postId,
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    visibility: comment.visibility,
    author: {
      ...author,
      publicationMode: comment.publicationMode,
    },
    viewer: {
      canEdit: comment.authorUserId === viewerUserId && comment.visibility === "visible",
      canDelete: comment.authorUserId === viewerUserId && comment.visibility !== "author_deleted",
      canReport: comment.visibility === "visible",
      isModerator: viewerIsModerator,
    },
  };
}

async function serializeReport(ctx: QueryCtx, report: Doc<"newsfeedReports">) {
  const reporter = await hydrateNewsfeedAuthors(ctx, [report.reporterUserId]);
  const target =
    report.targetType === "post"
      ? await ctx.db.get(report.targetId as Id<"newsfeedPosts">)
      : await ctx.db.get(report.targetId as Id<"newsfeedComments">);
  const targetAuthorId = target?.authorUserId;
  const authors = targetAuthorId ? await hydrateNewsfeedAuthors(ctx, [targetAuthorId]) : new Map();

  return {
    id: report._id,
    reason: report.reason,
    explanation: report.explanation ?? null,
    status: report.status,
    createdAt: report.createdAt,
    reviewedAt: report.reviewedAt ?? null,
    reporter: reporter.get(report.reporterUserId) ?? {
      displayName: "Unavailable member",
      avatarUrl: null,
      available: false,
    },
    target: target
      ? {
          id: target._id,
          type: report.targetType,
          text: target.text,
          visibility: target.visibility,
          author: {
            ...(authors.get(target.authorUserId) ?? {
              displayName: "Unavailable member",
              avatarUrl: null,
              available: false,
            }),
            publicationMode: target.publicationMode,
          },
        }
      : null,
  };
}

export const listPosts = query({
  args: {
    serviceSecret: v.string(),
    sessionId: v.string(),
    walletAddress: v.string(),
    paginationOpts: paginationOptsValidator,
    firstPageCutoff: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    if (args.paginationOpts.cursor !== null && args.firstPageCutoff === undefined) {
      throw new BadRequestError("firstPageCutoff is required when loading a subsequent page.");
    }
    const cutoff = Math.min(args.firstPageCutoff ?? Date.now(), Date.now());
    const page = await ctx.db
      .query("newsfeedPosts")
      .withIndex("by_visibility_createdAt", (q) =>
        q.eq("visibility", "visible").lte("createdAt", cutoff),
      )
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: NEWSFEED_PAGE_SIZE });
    const posts = await Promise.all(
      page.page.map((post) => serializePost(ctx, post, actor.user._id, actor.isModerator)),
    );
    return {
      items: posts,
      cursor: page.continueCursor,
      hasMore: !page.isDone,
      firstPageCutoff: cutoff,
    };
  },
});

export const getPost = query({
  args: {
    serviceSecret: v.string(),
    sessionId: v.string(),
    walletAddress: v.string(),
    postId: v.id("newsfeedPosts"),
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const post = await ctx.db.get(args.postId);
    if (!post || (post.visibility !== "visible" && !actor.isModerator)) {
      return null;
    }
    return await serializePost(ctx, post, actor.user._id, actor.isModerator);
  },
});

export const checkForNewerPosts = query({
  args: {
    serviceSecret: v.string(),
    sessionId: v.string(),
    walletAddress: v.string(),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    await requireNewsfeedActor(ctx, args);
    const newer = await ctx.db
      .query("newsfeedPosts")
      .withIndex("by_visibility_createdAt", (q) =>
        q.eq("visibility", "visible").gt("createdAt", args.since),
      )
      .order("desc")
      .take(1);
    return { available: newer.length > 0 };
  },
});

export const listComments = query({
  args: {
    serviceSecret: v.string(),
    sessionId: v.string(),
    walletAddress: v.string(),
    postId: v.id("newsfeedPosts"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const post = await ctx.db.get(args.postId);
    if (!post || (post.visibility !== "visible" && !actor.isModerator)) {
      return null;
    }
    const page = await ctx.db
      .query("newsfeedComments")
      .withIndex("by_post_visibility_createdAt", (q) =>
        q.eq("postId", args.postId).eq("visibility", "visible"),
      )
      .order("asc")
      .paginate({ ...args.paginationOpts, numItems: NEWSFEED_PAGE_SIZE });
    const comments = await Promise.all(
      page.page.map((comment) => serializeComment(ctx, comment, actor.user._id, actor.isModerator)),
    );
    return { items: comments, cursor: page.continueCursor, hasMore: !page.isDone };
  },
});

export const listModerationReports = query({
  args: {
    serviceSecret: v.string(),
    sessionId: v.string(),
    walletAddress: v.string(),
    status: v.optional(newsfeedReportStatusValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    if (!actor.isModerator) {
      throw new ForbiddenError(
        "Newsfeed moderation access is restricted to the configured allowlist.",
      );
    }
    const status = args.status ?? "open";
    const page = await ctx.db
      .query("newsfeedReports")
      .withIndex("by_status_createdAt", (q) => q.eq("status", status))
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: NEWSFEED_PAGE_SIZE });
    return {
      items: await Promise.all(page.page.map((report) => serializeReport(ctx, report))),
      cursor: page.continueCursor,
      hasMore: !page.isDone,
    };
  },
});

export const listModerationActions = query({
  args: {
    serviceSecret: v.string(),
    sessionId: v.string(),
    walletAddress: v.string(),
    targetType: v.optional(newsfeedReportTargetValidator),
    targetId: v.optional(v.union(v.id("newsfeedPosts"), v.id("newsfeedComments"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    if (!actor.isModerator) {
      throw new ForbiddenError(
        "Newsfeed moderation access is restricted to the configured allowlist.",
      );
    }
    let query = ctx.db.query("newsfeedModerationActions").withIndex("by_createdAt").order("desc");
    if (args.targetType && args.targetId) {
      query = ctx.db
        .query("newsfeedModerationActions")
        .withIndex("by_target_createdAt", (q) =>
          q.eq("targetType", args.targetType!).eq("targetId", args.targetId!),
        )
        .order("desc");
    }
    const page = await query.paginate({ ...args.paginationOpts, numItems: NEWSFEED_PAGE_SIZE });
    const authors = await hydrateNewsfeedAuthors(
      ctx,
      page.page.map((action) => action.actorUserId),
    );
    return {
      items: page.page.map((action) => ({
        id: action._id,
        targetType: action.targetType,
        targetId: action.targetId,
        action: action.action,
        reason: action.reason,
        createdAt: action.createdAt,
        previousVisibility: action.previousVisibility ?? null,
        newVisibility: action.newVisibility ?? null,
        actor: authors.get(action.actorUserId) ?? {
          displayName: "Unavailable member",
          avatarUrl: null,
          available: false,
        },
      })),
      cursor: page.continueCursor,
      hasMore: !page.isDone,
    };
  },
});

export { publicationModeValidator };
