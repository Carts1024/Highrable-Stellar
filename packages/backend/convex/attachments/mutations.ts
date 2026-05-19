import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanAttachToParent,
  assertCanModifyAttachment,
  sanitizeParentReference,
  softDeleteAttachment,
  validateAttachmentInput,
  validateExternalAttachmentInput,
  validateFileSizeForType,
  validateMimeTypeForType,
} from "./helpers";
import {
  attachmentOwnerRoleValidator,
  attachmentParentTypeValidator,
  attachmentTypeValidator,
  attachmentVisibilityValidator,
} from "./schema";

const attachmentMetadataValidator = v.optional(v.any());

export const generateUploadUrl = mutation({
  args: {
    walletAddress: v.string(),
    walletType: v.optional(walletTypeValidator),
    name: v.string(),
    size: v.number(),
    mimeType: v.optional(v.string()),
    type: v.optional(attachmentTypeValidator),
  },
  handler: async (ctx, args) => {
    normalizeWalletAddress(args.walletAddress);
    validateAttachmentInput(args);

    return await ctx.storage.generateUploadUrl();
  },
});

export const saveUploadedAttachment = mutation({
  args: {
    storageId: v.id("_storage"),
    uploadedByWallet: v.string(),
    uploadedByWalletType: v.optional(walletTypeValidator),
    ownerRole: attachmentOwnerRoleValidator,
    parentType: v.optional(attachmentParentTypeValidator),
    parentId: v.optional(v.string()),
    visibility: v.optional(attachmentVisibilityValidator),
    name: v.string(),
    size: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    type: v.optional(attachmentTypeValidator),
    metadata: attachmentMetadataValidator,
  },
  handler: async (ctx, args) => {
    const uploadedByWallet = normalizeWalletAddress(args.uploadedByWallet);
    const storageMetadata = await ctx.db.system.get("_storage", args.storageId);
    if (!storageMetadata) {
      throw new NotFoundError("Uploaded file was not found.");
    }

    const provided = validateAttachmentInput({
      name: args.name,
      size: args.size ?? storageMetadata.size,
      mimeType: args.mimeType ?? storageMetadata.contentType,
      type: args.type,
    });
    const storageMimeType = storageMetadata.contentType ?? provided.mimeType;
    const type = provided.type;

    validateMimeTypeForType(type, storageMimeType, provided.extension);
    validateFileSizeForType(type, storageMetadata.size);

    const parent = sanitizeParentReference({
      parentType: args.parentType ?? "unknown",
      parentId: args.parentId,
    });

    await assertCanAttachToParent(ctx, {
      ...parent,
      walletAddress: uploadedByWallet,
      ownerRole: args.ownerRole,
    });

    const now = Date.now();
    return await ctx.db.insert("attachments", {
      storageId: args.storageId,
      type,
      name: provided.name,
      size: storageMetadata.size,
      ...(storageMimeType ? { mimeType: storageMimeType } : {}),
      ...(provided.extension ? { extension: provided.extension } : {}),
      uploadedByWallet,
      ...(args.uploadedByWalletType ? { uploadedByWalletType: args.uploadedByWalletType } : {}),
      ownerRole: args.ownerRole,
      parentType: parent.parentType,
      ...(parent.parentId ? { parentId: parent.parentId } : {}),
      visibility: args.visibility ?? (parent.parentType === "unknown" ? "private" : "participants"),
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  },
});

export const createExternalAttachment = mutation({
  args: {
    externalUrl: v.string(),
    uploadedByWallet: v.string(),
    uploadedByWalletType: v.optional(walletTypeValidator),
    ownerRole: attachmentOwnerRoleValidator,
    parentType: v.optional(attachmentParentTypeValidator),
    parentId: v.optional(v.string()),
    visibility: v.optional(attachmentVisibilityValidator),
    name: v.optional(v.string()),
    type: v.union(v.literal("link"), v.literal("video_link")),
    metadata: attachmentMetadataValidator,
  },
  handler: async (ctx, args) => {
    const uploadedByWallet = normalizeWalletAddress(args.uploadedByWallet);
    const link = validateExternalAttachmentInput(args);
    const parent = sanitizeParentReference({
      parentType: args.parentType ?? "unknown",
      parentId: args.parentId,
    });

    await assertCanAttachToParent(ctx, {
      ...parent,
      walletAddress: uploadedByWallet,
      ownerRole: args.ownerRole,
    });

    const now = Date.now();
    return await ctx.db.insert("attachments", {
      externalUrl: link.externalUrl,
      type: link.type,
      name: link.name,
      uploadedByWallet,
      ...(args.uploadedByWalletType ? { uploadedByWalletType: args.uploadedByWalletType } : {}),
      ownerRole: args.ownerRole,
      parentType: parent.parentType,
      ...(parent.parentId ? { parentId: parent.parentId } : {}),
      visibility: args.visibility ?? (parent.parentType === "unknown" ? "private" : "participants"),
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  },
});

export const attachFilesToParent = mutation({
  args: {
    attachmentIds: v.array(v.id("attachments")),
    walletAddress: v.string(),
    parentType: attachmentParentTypeValidator,
    parentId: v.string(),
    visibility: v.optional(attachmentVisibilityValidator),
  },
  handler: async (ctx, args) => {
    if (args.attachmentIds.length === 0) {
      return [];
    }
    if (args.attachmentIds.length > 25) {
      throw new BadRequestError("Attach 25 files or fewer at a time.");
    }

    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const parent = sanitizeParentReference({
      parentType: args.parentType,
      parentId: args.parentId,
    });
    await assertCanAttachToParent(ctx, {
      ...parent,
      walletAddress,
      ownerRole: "client",
    });

    const now = Date.now();
    for (const attachmentId of args.attachmentIds) {
      const attachment = await assertCanModifyAttachment(ctx, attachmentId, walletAddress);
      if (attachment.parentType !== "unknown" && attachment.parentId !== parent.parentId) {
        throw new BadRequestError("Attachment is already linked to another parent.");
      }

      await ctx.db.patch(attachmentId, {
        parentType: parent.parentType,
        ...(parent.parentId ? { parentId: parent.parentId } : {}),
        visibility: args.visibility ?? "public",
        updatedAt: now,
      });
    }

    return args.attachmentIds;
  },
});

export const softDelete = mutation({
  args: {
    attachmentId: v.id("attachments"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    await softDeleteAttachment(ctx, args);
    return true;
  },
});
