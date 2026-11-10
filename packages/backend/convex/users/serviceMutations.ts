import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, NotFoundError } from "../_shared/errors";
import { assertMemberServiceSecret } from "../_shared/serviceAuth";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function validateAvatarMetadata(input: { name: string; size: number; mimeType: string }): void {
  if (!input.name.trim() || input.name.length > 240) {
    throw new BadRequestError("Avatar filename is invalid.");
  }
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > MAX_AVATAR_BYTES) {
    throw new BadRequestError("Avatar image must be 2 MB or smaller.");
  }
  if (!ALLOWED_AVATAR_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    throw new BadRequestError("Avatar must be a JPEG, PNG, WebP, or GIF image.");
  }
}

export const generateAvatarUploadUrl = mutation({
  args: {
    serviceSecret: v.string(),
    walletAddress: v.string(),
    name: v.string(),
    size: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    validateAvatarMetadata(args);
    const now = Date.now();
    const uploadToken = crypto.randomUUID();
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const uploadId = await ctx.db.insert("avatarUploadIntents", {
      walletAddress: args.walletAddress,
      uploadToken,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
    });

    return { uploadId, uploadToken, uploadUrl, expiresAt: now + 15 * 60 * 1000 };
  },
});

export const finalizeAvatarUpload = mutation({
  args: {
    serviceSecret: v.string(),
    walletAddress: v.string(),
    uploadToken: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    assertMemberServiceSecret(args.serviceSecret);
    const intent = await ctx.db
      .query("avatarUploadIntents")
      .withIndex("by_uploadToken", (q) => q.eq("uploadToken", args.uploadToken))
      .unique();
    if (!intent || intent.walletAddress !== args.walletAddress) {
      throw new BadRequestError("Avatar upload does not belong to this member.");
    }
    if (intent.expiresAt <= Date.now() || intent.finalizedAt !== undefined) {
      throw new BadRequestError("Avatar upload has expired or was already finalized.");
    }

    const storageMetadata = await ctx.db.system.get("_storage", args.storageId);
    if (!storageMetadata) {
      throw new NotFoundError("Uploaded avatar was not found.");
    }
    validateAvatarMetadata({
      name: "avatar",
      size: storageMetadata.size,
      mimeType: storageMetadata.contentType ?? "",
    });

    const existingOwner = await ctx.db
      .query("avatarUploadIntents")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existingOwner && existingOwner._id !== intent._id) {
      throw new BadRequestError("Avatar upload is already associated with another member.");
    }

    await ctx.db.patch(intent._id, {
      storageId: args.storageId,
      finalizedAt: Date.now(),
    });
    return args.storageId;
  },
});
