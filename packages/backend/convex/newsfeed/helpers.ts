import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type {
  TNewsfeedModerationAction,
  TNewsfeedRateLimitOperation,
  TNewsfeedReportReason,
  TNewsfeedReportStatus,
  TNewsfeedReportTarget,
  TNewsfeedVisibility,
} from "./schema";

import { ConflictError, ForbiddenError, NotFoundError, RateLimitError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { assertMemberServiceSecret } from "../_shared/serviceAuth";
import { findUserByWallet, resolveAvatarUrl } from "../users/helpers";

export const NEWSFEED_PAGE_SIZE = 20;
export const NEWSFEED_TEXT_LIMIT = 3_000;
export const NEWSFEED_REPORT_EXPLANATION_LIMIT = 1_000;

const RATE_LIMITS: Record<TNewsfeedRateLimitOperation, number> = {
  post: 5,
  comment: 20,
  like: 60,
  report: 10,
};

export type TNewsfeedActor = {
  sessionId: string;
  walletAddress: string;
  user: Doc<"users">;
  isModerator: boolean;
};

type TSessionArgs = {
  serviceSecret: string;
  sessionId: string;
  walletAddress: string;
};

export function assertNewsfeedTextEnabled(): void {
  if (process.env.NEWSFEED_ENABLED !== "true" || process.env.NEWSFEED_TEXT_ENABLED !== "true") {
    throw new NotFoundError("Newsfeed text is not available.");
  }
}

function getModeratorWallets(): Set<string> {
  return new Set(
    (process.env.NEWSFEED_MODERATOR_WALLETS ?? "")
      .split(",")
      .map((wallet) => wallet.trim())
      .filter(Boolean)
      .map(normalizeWalletAddress),
  );
}

export function isNewsfeedModerator(walletAddress: string): boolean {
  return getModeratorWallets().has(normalizeWalletAddress(walletAddress));
}

export async function requireNewsfeedActor(
  ctx: QueryCtx | MutationCtx,
  args: TSessionArgs,
): Promise<TNewsfeedActor> {
  assertMemberServiceSecret(args.serviceSecret);
  assertNewsfeedTextEnabled();

  const walletAddress = normalizeWalletAddress(args.walletAddress);
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
    .unique();
  const now = Date.now();
  if (
    !session ||
    session.revokedAt !== undefined ||
    session.expiresAt <= now ||
    session.walletAddress !== walletAddress
  ) {
    throw new ForbiddenError("Wallet session has expired or was revoked.");
  }

  const user = await findUserByWallet(ctx, walletAddress);
  if (!user?.onboardingCompletedAt || !user.name?.trim()) {
    throw new ForbiddenError("Complete your named profile before using Newsfeed.");
  }

  return {
    sessionId: args.sessionId,
    walletAddress,
    user,
    isModerator: isNewsfeedModerator(walletAddress),
  };
}

export function sanitizeNewsfeedText(value: string, fieldName = "text"): string {
  const text = value.trim();
  if (text.length === 0 || !/\S/u.test(text)) {
    throw new Error(`${fieldName} is required.`);
  }
  if (Array.from(text).length > NEWSFEED_TEXT_LIMIT) {
    throw new Error(`${fieldName} must be ${NEWSFEED_TEXT_LIMIT} characters or less.`);
  }
  return text;
}

export function sanitizeReportExplanation(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const explanation = value.trim();
  if (explanation.length === 0) {
    return undefined;
  }
  if (Array.from(explanation).length > NEWSFEED_REPORT_EXPLANATION_LIMIT) {
    throw new Error(`explanation must be ${NEWSFEED_REPORT_EXPLANATION_LIMIT} characters or less.`);
  }
  return explanation;
}

export async function consumeNewsfeedRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  operation: TNewsfeedRateLimitOperation,
): Promise<void> {
  const now = Date.now();
  const limit = RATE_LIMITS[operation];
  const existing = await ctx.db
    .query("newsfeedRateLimitWindows")
    .withIndex("by_user_operation", (q) => q.eq("userId", userId).eq("operation", operation))
    .unique();

  if (!existing || existing.windowStartedAt + 60_000 <= now) {
    if (existing) {
      await ctx.db.patch(existing._id, { windowStartedAt: now, count: 1 });
    } else {
      await ctx.db.insert("newsfeedRateLimitWindows", {
        userId,
        operation,
        windowStartedAt: now,
        count: 1,
      });
    }
    return;
  }

  if (existing.count >= limit) {
    throw new RateLimitError(`Newsfeed ${operation} limit reached. Try again in a minute.`);
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}

export async function getNewsfeedAuthor(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<{
  displayName: string;
  avatarUrl: string | null;
  available: boolean;
}> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return { displayName: "Unavailable member", avatarUrl: null, available: false };
  }

  const displayName = [user.firstName, user.middleName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  const resolvedName = displayName || user.name?.trim() || user.companyName?.trim();
  if (!resolvedName) {
    return { displayName: "Unavailable member", avatarUrl: null, available: false };
  }

  return {
    displayName: resolvedName,
    avatarUrl: (await resolveAvatarUrl(ctx, user)) ?? null,
    available: true,
  };
}

export async function hydrateNewsfeedAuthors(
  ctx: QueryCtx,
  userIds: readonly Id<"users">[],
): Promise<Map<string, Awaited<ReturnType<typeof getNewsfeedAuthor>>>> {
  const uniqueUserIds = Array.from(new Set(userIds));
  const authors = new Map<string, Awaited<ReturnType<typeof getNewsfeedAuthor>>>();
  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      authors.set(userId, await getNewsfeedAuthor(ctx, userId));
    }),
  );
  return authors;
}

export async function assertVisiblePost(
  ctx: QueryCtx | MutationCtx,
  postId: Id<"newsfeedPosts">,
  allowModerator = false,
): Promise<Doc<"newsfeedPosts">> {
  const post = await ctx.db.get(postId);
  if (!post || (post.visibility !== "visible" && !allowModerator)) {
    throw new NotFoundError("Post is unavailable.");
  }
  return post;
}

export async function assertVisibleComment(
  ctx: QueryCtx | MutationCtx,
  commentId: Id<"newsfeedComments">,
  allowModerator = false,
): Promise<Doc<"newsfeedComments">> {
  const comment = await ctx.db.get(commentId);
  if (!comment || (comment.visibility !== "visible" && !allowModerator)) {
    throw new NotFoundError("Comment is unavailable.");
  }
  return comment;
}

export function assertTargetMatches(
  targetType: TNewsfeedReportTarget,
  target: Doc<"newsfeedPosts"> | Doc<"newsfeedComments"> | null,
): void {
  if (
    !target ||
    (targetType === "post" && !("likeCount" in target)) ||
    (targetType === "comment" && !("postId" in target))
  ) {
    throw new NotFoundError("Reported content is unavailable.");
  }
}

export function getModerationTargetVisibility(
  target: Doc<"newsfeedPosts"> | Doc<"newsfeedComments">,
): TNewsfeedVisibility {
  return target.visibility;
}

export function assertModerationReason(reason: string): string {
  const sanitized = reason.trim();
  if (!sanitized) {
    throw new Error("Moderation reason is required.");
  }
  if (Array.from(sanitized).length > 1_000) {
    throw new Error("Moderation reason must be 1,000 characters or less.");
  }
  return sanitized;
}

export function assertKnownModerationAction(action: TNewsfeedModerationAction): void {
  if (!action) {
    throw new ConflictError("Moderation action is invalid.");
  }
}

export function serializeVisibility(visibility: TNewsfeedVisibility): TNewsfeedVisibility {
  return visibility;
}

export type TNewsfeedReportListFilter = TNewsfeedReportStatus | "all";
export type TNewsfeedReportInput = {
  reason: TNewsfeedReportReason;
  explanation?: string;
};
