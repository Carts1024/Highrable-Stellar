import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanDownloadAttachment,
  assertCanPreviewAttachment,
  assertCanAttachToParent,
  assertCanModifyAttachment,
  buildWatermarkPayload,
  createAttachmentAccessLog,
  FREELANCER_DELIVERABLE_BLOCKED_DOWNLOAD_MESSAGE,
  getAttachmentAccessPolicy,
  isProtectedAttachment,
  serializeAttachmentForViewer,
  sanitizeParentReference,
  softDeleteAttachment,
  validateProtectionSettings,
  validateAttachmentInput,
  validateExternalAttachmentInput,
  validateFileSizeForType,
  validateMimeTypeForType,
} from "./helpers";
import {
  attachmentAccessActionValidator,
  attachmentProtectionModeValidator,
  attachmentOwnerRoleValidator,
  attachmentParentTypeValidator,
  attachmentTypeValidator,
  attachmentViewerRoleValidator,
  attachmentVisibilityValidator,
} from "./schema";

const attachmentMetadataValidator = v.optional(v.any());
const protectionSettingsArgs = {
  protectionMode: v.optional(attachmentProtectionModeValidator),
  downloadAllowed: v.optional(v.boolean()),
  previewAllowed: v.optional(v.boolean()),
  watermarkEnabled: v.optional(v.boolean()),
  accessLoggingEnabled: v.optional(v.boolean()),
  allowedViewerRoles: v.optional(v.array(attachmentViewerRoleValidator)),
  expiresAt: v.optional(v.number()),
  protectedReason: v.optional(v.string()),
};

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
    ...protectionSettingsArgs,
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
    const protectionSettings = validateProtectionSettings(args);
    const isProtected = protectionSettings.protectionMode !== "standard";
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
      protectionMode: protectionSettings.protectionMode,
      downloadAllowed: protectionSettings.downloadAllowed ?? !isProtected,
      previewAllowed: protectionSettings.previewAllowed ?? true,
      watermarkEnabled: protectionSettings.watermarkEnabled ?? isProtected,
      accessLoggingEnabled: protectionSettings.accessLoggingEnabled ?? isProtected,
      ...(protectionSettings.allowedViewerRoles
        ? { allowedViewerRoles: protectionSettings.allowedViewerRoles }
        : {}),
      ...(protectionSettings.expiresAt ? { expiresAt: protectionSettings.expiresAt } : {}),
      ...(protectionSettings.protectedReason
        ? { protectedReason: protectionSettings.protectedReason }
        : {}),
      ...(isProtected ? { createdProtectionAt: now, updatedProtectionAt: now } : {}),
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
    ...protectionSettingsArgs,
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
    const protectionSettings = validateProtectionSettings(args);
    const isProtected = protectionSettings.protectionMode !== "standard";
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
      protectionMode: protectionSettings.protectionMode,
      downloadAllowed: protectionSettings.downloadAllowed ?? !isProtected,
      previewAllowed: protectionSettings.previewAllowed ?? true,
      watermarkEnabled: protectionSettings.watermarkEnabled ?? isProtected,
      accessLoggingEnabled: protectionSettings.accessLoggingEnabled ?? isProtected,
      ...(protectionSettings.allowedViewerRoles
        ? { allowedViewerRoles: protectionSettings.allowedViewerRoles }
        : {}),
      ...(protectionSettings.expiresAt ? { expiresAt: protectionSettings.expiresAt } : {}),
      ...(protectionSettings.protectedReason
        ? { protectedReason: protectionSettings.protectedReason }
        : {}),
      ...(isProtected ? { createdProtectionAt: now, updatedProtectionAt: now } : {}),
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

export const updateAttachmentProtectionSettings = mutation({
  args: {
    attachmentId: v.id("attachments"),
    walletAddress: v.string(),
    ...protectionSettingsArgs,
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment || attachment.status !== "active") {
      throw new NotFoundError("Attachment not found.");
    }
    if (attachment.uploadedByWallet !== walletAddress) {
      throw new BadRequestError(
        "Only the attachment owner can change content protection controls.",
      );
    }

    const protectionSettings = validateProtectionSettings(args);
    const now = Date.now();
    const isProtected = protectionSettings.protectionMode !== "standard";

    await ctx.db.patch(args.attachmentId, {
      protectionMode: protectionSettings.protectionMode,
      downloadAllowed: protectionSettings.downloadAllowed ?? !isProtected,
      previewAllowed: protectionSettings.previewAllowed ?? true,
      watermarkEnabled: protectionSettings.watermarkEnabled ?? isProtected,
      accessLoggingEnabled: protectionSettings.accessLoggingEnabled ?? isProtected,
      allowedViewerRoles: protectionSettings.allowedViewerRoles,
      expiresAt: protectionSettings.expiresAt,
      protectedReason: protectionSettings.protectedReason,
      createdProtectionAt: attachment.createdProtectionAt ?? (isProtected ? now : undefined),
      updatedProtectionAt: now,
      updatedAt: now,
    });

    return true;
  },
});

export const recordProtectedPreviewOpened = mutation({
  args: {
    attachmentId: v.id("attachments"),
    viewerWallet: v.string(),
    viewerWalletType: v.optional(walletTypeValidator),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewerWallet = normalizeWalletAddress(args.viewerWallet);
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new NotFoundError("Attachment not found.");
    }

    const policy = await assertCanPreviewAttachment(ctx, attachment, viewerWallet);
    const previewUrl = attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null;
    const url = attachment.externalUrl ?? previewUrl;
    const watermark = buildWatermarkPayload({
      attachment,
      viewerWallet,
      viewerWalletType: args.viewerWalletType,
      viewerRole: policy.viewerRole,
    });

    await createAttachmentAccessLog(ctx, {
      attachment,
      viewerWallet,
      viewerWalletType: args.viewerWalletType,
      viewerRole: policy.viewerRole,
      action: "preview_opened",
      result: "allowed",
      sessionId: args.sessionId,
      metadata: { previewSupported: policy.previewSupported },
      force: policy.accessLoggingEnabled,
    });
    if (attachment.storageId) {
      await createAttachmentAccessLog(ctx, {
        attachment,
        viewerWallet,
        viewerWalletType: args.viewerWalletType,
        viewerRole: policy.viewerRole,
        action: "preview_url_generated",
        result: "allowed",
        sessionId: args.sessionId,
        force: policy.accessLoggingEnabled,
      });
    }

    return {
      attachment: await serializeAttachmentForViewer(ctx, attachment, viewerWallet),
      url,
      expiresAt: Date.now() + 5 * 60 * 1000,
      watermark,
      policy,
      limitation:
        "Convex storage URLs are gated before generation in Highrable. Browser-level screenshots and screen recordings cannot be fully prevented.",
    };
  },
});

export const recordDownloadAttempt = mutation({
  args: {
    attachmentId: v.id("attachments"),
    viewerWallet: v.string(),
    viewerWalletType: v.optional(walletTypeValidator),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewerWallet = normalizeWalletAddress(args.viewerWallet);
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new NotFoundError("Attachment not found.");
    }
    const policy = await getAttachmentAccessPolicy(ctx, attachment, viewerWallet);

    await createAttachmentAccessLog(ctx, {
      attachment,
      viewerWallet,
      viewerWalletType: args.viewerWalletType,
      viewerRole: policy.viewerRole,
      action: "download_requested",
      result: policy.canDownload ? "allowed" : "blocked",
      reason: policy.canDownload ? undefined : FREELANCER_DELIVERABLE_BLOCKED_DOWNLOAD_MESSAGE,
      sessionId: args.sessionId,
      force: policy.accessLoggingEnabled,
    });

    if (!policy.canDownload) {
      await createAttachmentAccessLog(ctx, {
        attachment,
        viewerWallet,
        viewerWalletType: args.viewerWalletType,
        viewerRole: policy.viewerRole,
        action: "download_blocked",
        result: "blocked",
        reason: FREELANCER_DELIVERABLE_BLOCKED_DOWNLOAD_MESSAGE,
        sessionId: args.sessionId,
        force: policy.accessLoggingEnabled,
      });
      throw new BadRequestError(FREELANCER_DELIVERABLE_BLOCKED_DOWNLOAD_MESSAGE);
    }

    await assertCanDownloadAttachment(ctx, attachment, viewerWallet);
    await createAttachmentAccessLog(ctx, {
      attachment,
      viewerWallet,
      viewerWalletType: args.viewerWalletType,
      viewerRole: policy.viewerRole,
      action: "download_allowed",
      result: "allowed",
      sessionId: args.sessionId,
      force: policy.accessLoggingEnabled,
    });

    return {
      url:
        attachment.externalUrl ??
        (attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null),
    };
  },
});

export const logAttachmentAccess = mutation({
  args: {
    attachmentId: v.id("attachments"),
    viewerWallet: v.optional(v.string()),
    viewerWalletType: v.optional(walletTypeValidator),
    action: attachmentAccessActionValidator,
    result: v.union(v.literal("allowed"), v.literal("blocked"), v.literal("failed")),
    reason: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new NotFoundError("Attachment not found.");
    }
    const viewerWallet = args.viewerWallet ? normalizeWalletAddress(args.viewerWallet) : undefined;
    const policy = await getAttachmentAccessPolicy(ctx, attachment, viewerWallet);
    if (!policy.canPreview && isProtectedAttachment(attachment)) {
      throw new BadRequestError("You do not have access to this attachment.");
    }

    return await createAttachmentAccessLog(ctx, {
      attachment,
      viewerWallet,
      viewerWalletType: args.viewerWalletType,
      viewerRole: policy.viewerRole,
      action: args.action,
      result: args.result,
      reason: args.reason,
      sessionId: args.sessionId,
      metadata: args.metadata,
      force: policy.accessLoggingEnabled,
    });
  },
});
