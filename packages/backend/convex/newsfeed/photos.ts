import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

import { internal } from "../_generated/api";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import {
  requireNewsfeedActor,
  consumeNewsfeedRateLimit,
  assertNewsfeedTextEnabled,
} from "./helpers";
import { newsfeedMediaKindValidator, type TNewsfeedMediaKind } from "./schema";
export const sessionArgs = {
  serviceSecret: v.string(),
  sessionId: v.string(),
  walletAddress: v.string(),
};
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 26_214_400;
export const STORAGE_MARKER = "application/x-highrable-newsfeed";
export const VIDEO_MAX_DURATION_SECONDS = 60;

export function enabledForKind(kind: TNewsfeedMediaKind): void {
  assertNewsfeedTextEnabled();
  if (kind === "video") {
    if (process.env.NEWSFEED_VIDEO_ENABLED !== "true") throw new Error("Videos are unavailable.");
    return;
  }
  if (process.env.NEWSFEED_PHOTOS_ENABLED !== "true") throw new Error("Photos are unavailable.");
}

export function enabled() {
  enabledForKind("photo");
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function actorForUpload(ctx: QueryCtx | MutationCtx, upload: Doc<"newsfeedUploads">) {
  enabledForKind(upload.kind ?? "photo");
  const actor = await requireNewsfeedActor(ctx, {
    serviceSecret: process.env.HIGHRABLE_AUTH_SERVICE_SECRET ?? "",
    sessionId: upload.sessionId,
    walletAddress: upload.walletAddress,
  });
  if (actor.user._id !== upload.ownerId) throw new Error("Invalid owner.");
  return actor;
}
export const reserve = mutation({
  args: {
    ...sessionArgs,
    credentialHash: v.string(),
    kind: v.optional(newsfeedMediaKindValidator),
  },
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{64}$/.test(args.credentialHash)) throw new Error("Invalid credential digest.");
    const kind = args.kind ?? "photo";
    enabledForKind(kind);
    const actor = await requireNewsfeedActor(ctx, args);
    await consumeNewsfeedRateLimit(ctx, actor.user._id, "upload");
    const uploads = await ctx.db
      .query("newsfeedUploads")
      .withIndex("by_owner_unattached_expiration", (q) =>
        q.eq("ownerId", actor.user._id).eq("postId", undefined).gt("expiresAt", Date.now()),
      )
      .take(8);
    if (
      uploads.filter((u) => !u.postId && u.state !== "cancelled" && u.expiresAt > Date.now())
        .length >= 8
    )
      throw new Error("Eight active uploads are already reserved.");
    const uploadId = await ctx.db.insert("newsfeedUploads", {
      ownerId: actor.user._id,
      sessionId: args.sessionId,
      walletAddress: args.walletAddress,
      credentialHash: args.credentialHash,
      credentialExpiresAt: Date.now() + 300_000,
      kind,
      expiresAt: Date.now() + 86_400_000,
      state: "reserved",
    });
    return { uploadId };
  },
});
export const status = query({
  args: { ...sessionArgs, uploadId: v.id("newsfeedUploads") },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const upload = await ctx.db.get(args.uploadId);
    if (!upload || upload.ownerId !== actor.user._id || upload.sessionId !== args.sessionId)
      throw new Error("Upload unavailable.");
    return { state: upload.state, expiresAt: upload.expiresAt };
  },
});
export const cancel = mutation({
  args: { ...sessionArgs, uploadId: v.id("newsfeedUploads") },
  handler: async (ctx, args) => {
    const actor = await requireNewsfeedActor(ctx, args);
    const upload = await ctx.db.get(args.uploadId);
    if (
      !upload ||
      upload.ownerId !== actor.user._id ||
      upload.sessionId !== args.sessionId ||
      upload.postId
    )
      throw new Error("Upload unavailable.");
    await ctx.db.patch(upload._id, { state: "cancelled", expiresAt: 0 });
  },
});
export const claim = internalMutation({
  args: {
    uploadId: v.id("newsfeedUploads"),
    credentialHash: v.string(),
    kind: v.optional(newsfeedMediaKindValidator),
  },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (
      !upload ||
      upload.state !== "reserved" ||
      upload.credentialHash !== args.credentialHash ||
      upload.credentialExpiresAt <= Date.now()
    )
      throw new Error("Upload credential unavailable.");
    if (args.kind && (upload.kind ?? "photo") !== args.kind)
      throw new Error("Upload kind mismatch.");
    await actorForUpload(ctx, upload);
    await ctx.db.patch(upload._id, { state: "transferring" });
  },
});
export const finalize = internalMutation({
  args: {
    uploadId: v.id("newsfeedUploads"),
    storageId: v.id("_storage"),
    format: v.string(),
    size: v.number(),
    width: v.number(),
    height: v.number(),
    duration: v.optional(v.number()),
    videoCodec: v.optional(v.string()),
    audioCodec: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId);
    if (!upload || upload.state !== "transferring" || upload.expiresAt <= Date.now())
      throw new Error("Upload cancelled or expired.");
    await actorForUpload(ctx, upload);
    if (
      (upload.kind ?? "photo") === "video" &&
      (args.duration === undefined ||
        !args.videoCodec ||
        args.duration <= 0 ||
        args.duration > VIDEO_MAX_DURATION_SECONDS)
    )
      throw new Error("Video metadata is invalid.");
    const { uploadId, ...metadata } = args;
    await ctx.db.patch(uploadId, { ...metadata, state: "ready" });
  },
});
async function readable(
  ctx: QueryCtx | MutationCtx,
  args: {
    serviceSecret: string;
    sessionId: string;
    walletAddress: string;
    mediaId: Id<"newsfeedUploads">;
    moderation: boolean;
  },
) {
  const mediaKind = (await ctx.db.get(args.mediaId))?.kind ?? "photo";
  enabledForKind(mediaKind);
  const actor = await requireNewsfeedActor(ctx, args);
  if (args.moderation && !actor.isModerator) throw new Error("Moderation access is restricted.");
  const media = await ctx.db.get(args.mediaId);
  const post = media?.postId ? await ctx.db.get(media.postId) : null;
  if (
    !media?.storageId ||
    media.state !== "attached" ||
    !post ||
    post.visibility === "author_deleted" ||
    (post.visibility !== "visible" && !(args.moderation && actor.isModerator))
  )
    throw new Error(`${mediaKind === "video" ? "Video" : "Photo"} unavailable.`);
  return media;
}
export const authorizeRead = mutation({
  args: {
    ...sessionArgs,
    mediaId: v.id("newsfeedUploads"),
    moderation: v.boolean(),
    credentialHash: v.string(),
  },
  handler: async (ctx, args) => {
    await readable(ctx, args);
    await ctx.db.insert("newsfeedMediaGrants", {
      credentialHash: args.credentialHash,
      mediaId: args.mediaId,
      sessionId: args.sessionId,
      walletAddress: args.walletAddress,
      moderation: args.moderation,
      expiresAt: Date.now() + 60_000,
    });
  },
});
export const read = internalQuery({
  args: { credentialHash: v.string() },
  handler: async (ctx, args) => {
    const grant = await ctx.db
      .query("newsfeedMediaGrants")
      .withIndex("by_hash", (q) => q.eq("credentialHash", args.credentialHash))
      .unique();
    if (!grant || grant.expiresAt <= Date.now()) throw new Error("Photo credential expired.");
    return await readable(ctx, {
      ...grant,
      serviceSecret: process.env.HIGHRABLE_AUTH_SERVICE_SECRET ?? "",
    });
  },
});
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const expired = await ctx.db
      .query("newsfeedUploads")
      .withIndex("by_expiration", (q) => q.lte("expiresAt", Date.now()))
      .take(100);
    for (const upload of expired) {
      if (upload.state === "attached") continue;
      if (upload.storageId) await ctx.storage.delete(upload.storageId);
      await ctx.db.delete(upload._id);
    }
    // Reconcile only marked newsfeed objects, with a 24h grace period for actions.
    // Check every current storage association domain before deleting an orphan.
    const saved = await ctx.db.query("newsfeedCleanupCursors").first();
    const page = await ctx.db.system
      .query("_storage")
      .paginate({ cursor: saved?.cursor ?? null, numItems: 100 });
    for (const file of page.page) {
      if (file.contentType !== STORAGE_MARKER || file._creationTime > Date.now() - 86_400_000)
        continue;
      const tracked = await ctx.db
        .query("newsfeedUploads")
        .withIndex("by_storage", (q) => q.eq("storageId", file._id))
        .first();
      const attachment = await ctx.db
        .query("attachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", file._id))
        .first();
      const avatar = await ctx.db
        .query("avatarUploadIntents")
        .withIndex("by_storageId", (q) => q.eq("storageId", file._id))
        .first();
      const user = await ctx.db
        .query("users")
        .withIndex("by_avatarStorageId", (q) => q.eq("avatarStorageId", file._id))
        .first();
      if (!tracked && !attachment && !avatar && !user) await ctx.storage.delete(file._id);
    }
    console.info("newsfeed_photo_cleanup", {
      expiredRecords: expired.length,
      scannedFiles: page.page.length,
      scannedBytes: page.page.reduce((sum, file) => sum + file.size, 0),
    });
    const cursor = page.isDone ? null : page.continueCursor;
    if (saved) await ctx.db.patch(saved._id, { cursor });
    else await ctx.db.insert("newsfeedCleanupCursors", { cursor });
    const grants = await ctx.db
      .query("newsfeedMediaGrants")
      .withIndex("by_expiration", (q) => q.lte("expiresAt", Date.now()))
      .take(500);
    for (const grant of grants) await ctx.db.delete(grant._id);
    // Drain backlogs in separate bounded transactions; no release flag dependency.
    if (expired.length === 100 || grants.length === 500)
      await ctx.scheduler.runAfter(0, internal.newsfeed.photos.cleanup, {});
  },
});
/** Deny both tracked and in-flight newsfeed bytes at every shared storage boundary. */
export async function assertSharedStorage(ctx: QueryCtx | MutationCtx, id: Id<"_storage">) {
  const metadata = await ctx.db.system.get(id);
  if (
    metadata?.contentType === STORAGE_MARKER ||
    (await ctx.db
      .query("newsfeedUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", id))
      .first())
  )
    throw new Error("Newsfeed media cannot be shared through this endpoint.");
}

export const discardUnassociated = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const tracked = await ctx.db
      .query("newsfeedUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();
    if (!tracked) await ctx.storage.delete(args.storageId);
  },
});
