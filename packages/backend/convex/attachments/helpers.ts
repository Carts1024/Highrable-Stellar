import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type {
  TAttachmentOwnerRole,
  TAttachmentParentType,
  TAttachmentType,
  TAttachmentVisibility,
} from "./schema";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";

const MB = 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * MB;
const MAX_VIDEO_BYTES = 25 * MB;
const MAX_DOCUMENT_BYTES = 10 * MB;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const MARKDOWN_MIME_TYPES = new Set(["text/markdown", "text/plain"]);
const DOCUMENT_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "txt"]);
const DOCUMENT_EXTENSIONS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

type TAttachmentFileValidationInput = {
  name: string;
  size?: number;
  mimeType?: string;
  type?: TAttachmentType;
};

type TAttachmentLinkValidationInput = {
  name?: string;
  externalUrl: string;
  type: "link" | "video_link";
};

type TParentReference = {
  parentType: TAttachmentParentType;
  parentId?: string;
};

export function sanitizeAttachmentName(name: string): string {
  const sanitizedName = requireNonEmptyString(name, "name").replace(/\s+/g, " ").slice(0, 180);
  if (sanitizedName.length === 0) {
    throw new BadRequestError("Attachment name is required.");
  }

  return sanitizedName;
}

export function getAttachmentExtension(name: string): string | undefined {
  const sanitizedName = sanitizeAttachmentName(name);
  const extension = sanitizedName.split(".").pop()?.trim().toLowerCase();

  if (!extension || extension === sanitizedName.toLowerCase() || extension.length > 16) {
    return undefined;
  }

  return extension;
}

function sanitizeMimeType(mimeType?: string): string | undefined {
  return optionalNonEmptyString(mimeType?.toLowerCase(), "mimeType");
}

export function normalizeAttachmentType(input: {
  name: string;
  mimeType?: string;
  requestedType?: TAttachmentType;
  externalUrl?: string;
}): TAttachmentType {
  if (input.requestedType === "link" || input.requestedType === "video_link") {
    return input.requestedType;
  }

  const extension = getAttachmentExtension(input.name);
  const mimeType = sanitizeMimeType(input.mimeType);

  if (mimeType && IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (mimeType && VIDEO_MIME_TYPES.has(mimeType)) return "video";
  if (mimeType && PDF_MIME_TYPES.has(mimeType)) return "pdf";
  if (mimeType && MARKDOWN_MIME_TYPES.has(mimeType)) return "markdown";
  if (mimeType && DOCUMENT_MIME_TYPES.has(mimeType)) return "document";

  if (extension && IMAGE_EXTENSIONS.has(extension)) return "image";
  if (extension && VIDEO_EXTENSIONS.has(extension)) return "video";
  if (extension && PDF_EXTENSIONS.has(extension)) return "pdf";
  if (extension && MARKDOWN_EXTENSIONS.has(extension)) return "markdown";
  if (extension && DOCUMENT_EXTENSIONS.has(extension)) return "document";

  return input.requestedType === "file" || !input.requestedType ? "file" : input.requestedType;
}

export function validateFileSizeForType(type: TAttachmentType, size?: number): number | undefined {
  if (size === undefined) {
    return undefined;
  }

  if (!Number.isFinite(size) || size <= 0) {
    throw new BadRequestError("Attachment file size is invalid.");
  }

  if (type === "video" && size > MAX_VIDEO_BYTES) {
    throw new BadRequestError("Videos must be 25 MB or smaller.");
  }

  if (type === "image" && size > MAX_IMAGE_BYTES) {
    throw new BadRequestError("Images must be 10 MB or smaller.");
  }

  if (
    (type === "document" || type === "pdf" || type === "markdown" || type === "file") &&
    size > MAX_DOCUMENT_BYTES
  ) {
    throw new BadRequestError("Documents must be 10 MB or smaller.");
  }

  return size;
}

export function validateMimeTypeForType(
  type: TAttachmentType,
  mimeType?: string,
  extension?: string,
) {
  if (type === "link" || type === "video_link") {
    return;
  }

  const normalizedMimeType = sanitizeMimeType(mimeType);
  const normalizedExtension = extension?.toLowerCase();

  const hasMimeMatch =
    !normalizedMimeType ||
    (type === "image" && IMAGE_MIME_TYPES.has(normalizedMimeType)) ||
    (type === "video" && VIDEO_MIME_TYPES.has(normalizedMimeType)) ||
    (type === "pdf" && PDF_MIME_TYPES.has(normalizedMimeType)) ||
    (type === "markdown" && MARKDOWN_MIME_TYPES.has(normalizedMimeType)) ||
    (type === "document" && DOCUMENT_MIME_TYPES.has(normalizedMimeType)) ||
    type === "file";

  const hasExtensionMatch =
    !normalizedExtension ||
    (type === "image" && IMAGE_EXTENSIONS.has(normalizedExtension)) ||
    (type === "video" && VIDEO_EXTENSIONS.has(normalizedExtension)) ||
    (type === "pdf" && PDF_EXTENSIONS.has(normalizedExtension)) ||
    (type === "markdown" && MARKDOWN_EXTENSIONS.has(normalizedExtension)) ||
    (type === "document" && DOCUMENT_EXTENSIONS.has(normalizedExtension)) ||
    type === "file";

  if (!hasMimeMatch || !hasExtensionMatch) {
    throw new BadRequestError("This file type is not supported yet.");
  }
}

export function validateAttachmentInput(input: TAttachmentFileValidationInput) {
  const name = sanitizeAttachmentName(input.name);
  const extension = getAttachmentExtension(name);
  const mimeType = sanitizeMimeType(input.mimeType);
  const type = normalizeAttachmentType({ name, mimeType, requestedType: input.type });

  if (type === "link" || type === "video_link") {
    throw new BadRequestError("Uploaded files must not use link attachment types.");
  }

  validateMimeTypeForType(type, mimeType, extension);
  const size = validateFileSizeForType(type, input.size);

  return { name, extension, mimeType, type, size };
}

export function validateExternalAttachmentInput(input: TAttachmentLinkValidationInput) {
  const externalUrl = requireValidUrl(input.externalUrl);
  const name = sanitizeAttachmentName(input.name ?? externalUrl);

  return {
    externalUrl,
    name,
    type: input.type,
  };
}

export function requireValidUrl(value: string): string {
  const rawUrl = requireNonEmptyString(value, "externalUrl");

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new BadRequestError("Enter a valid URL.");
    }

    return url.toString();
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new BadRequestError("Enter a valid URL.");
  }
}

export function sanitizeParentReference(input: TParentReference): TParentReference {
  const parentId = optionalNonEmptyString(input.parentId, "parentId");
  return {
    parentType: parentId ? input.parentType : "unknown",
    ...(parentId ? { parentId } : {}),
  };
}

export async function assertCanAttachToParent(
  ctx: QueryCtx,
  input: TParentReference & { walletAddress: string; ownerRole: TAttachmentOwnerRole },
) {
  if (!input.parentId || input.parentType === "unknown") {
    return;
  }

  const walletAddress = normalizeWalletAddress(input.walletAddress);

  if (input.parentType === "job") {
    const job = await ctx.db.get(input.parentId as Id<"jobs">);
    if (!job) {
      throw new NotFoundError("Parent work was not found.");
    }
    if (job.clientWallet !== walletAddress) {
      throw new ForbiddenError("You do not have permission to attach files to this work.");
    }
    return;
  }

  if (input.parentType === "work_submission") {
    const submission = await ctx.db.get(input.parentId as Id<"workSubmissions">);
    if (!submission || submission.status === "cancelled") {
      throw new NotFoundError("Proof submission was not found.");
    }
    if (submission.submittedByWallet !== walletAddress) {
      throw new ForbiddenError("You do not have permission to attach files to this proof.");
    }
    if (
      submission.status !== "draft" &&
      submission.status !== "anchor_failed" &&
      submission.status !== "submitted"
    ) {
      throw new ForbiddenError("Submitted proof attachments are read-only.");
    }
    if (input.ownerRole !== "freelancer") {
      throw new ForbiddenError("Only the assigned freelancer can add proof attachments.");
    }
    return;
  }

  throw new BadRequestError("This attachment parent type is not supported yet.");
}

async function canViewParentJob(ctx: QueryCtx, parentId: string, viewerWallet?: string) {
  const job = await ctx.db.get(parentId as Id<"jobs">);
  if (!job) {
    return false;
  }

  if (job.status === "open") {
    return true;
  }

  if (!viewerWallet) {
    return false;
  }

  const normalizedViewerWallet = normalizeWalletAddress(viewerWallet);
  return (
    job.clientWallet === normalizedViewerWallet ||
    job.selectedFreelancerWallet === normalizedViewerWallet
  );
}

export async function assertCanViewAttachment(
  ctx: QueryCtx,
  attachment: {
    uploadedByWallet: string;
    parentType: TAttachmentParentType;
    parentId?: string;
    visibility: TAttachmentVisibility;
    status: string;
  },
  viewerWallet?: string,
) {
  if (attachment.status !== "active") {
    throw new NotFoundError("Attachment not found.");
  }

  if (
    attachment.visibility === "public" &&
    attachment.parentType === "job" &&
    attachment.parentId
  ) {
    if (await canViewParentJob(ctx, attachment.parentId, viewerWallet)) {
      return;
    }
  }

  if (!viewerWallet) {
    throw new ForbiddenError("You do not have permission to view this attachment.");
  }

  const normalizedViewerWallet = normalizeWalletAddress(viewerWallet);
  if (attachment.uploadedByWallet === normalizedViewerWallet) {
    return;
  }

  if (
    attachment.visibility === "participants" &&
    attachment.parentType === "job" &&
    attachment.parentId &&
    (await canViewParentJob(ctx, attachment.parentId, normalizedViewerWallet))
  ) {
    return;
  }

  if (
    attachment.visibility === "participants" &&
    attachment.parentType === "work_submission" &&
    attachment.parentId
  ) {
    const submission = await ctx.db.get(attachment.parentId as Id<"workSubmissions">);
    if (
      submission &&
      (submission.clientWallet === normalizedViewerWallet ||
        submission.freelancerWallet === normalizedViewerWallet ||
        submission.submittedByWallet === normalizedViewerWallet)
    ) {
      return;
    }
  }

  throw new ForbiddenError("You do not have permission to view this attachment.");
}

export async function assertCanModifyAttachment(
  ctx: QueryCtx,
  attachmentId: Id<"attachments">,
  walletAddress: string,
) {
  const attachment = await ctx.db.get(attachmentId);
  if (!attachment || attachment.status !== "active") {
    throw new NotFoundError("Attachment not found.");
  }

  const normalizedWallet = normalizeWalletAddress(walletAddress);
  if (attachment.uploadedByWallet !== normalizedWallet) {
    throw new ForbiddenError("You do not have permission to modify this attachment.");
  }

  if (attachment.parentType === "work_submission" && attachment.parentId) {
    const submission = await ctx.db.get(attachment.parentId as Id<"workSubmissions">);
    if (
      submission &&
      submission.status !== "draft" &&
      submission.status !== "anchor_failed"
    ) {
      throw new ForbiddenError("Submitted proof attachments are read-only.");
    }
  }

  return attachment;
}

export async function getAttachmentsForParent(
  ctx: QueryCtx,
  input: TParentReference & { viewerWallet?: string },
) {
  const parent = sanitizeParentReference(input);
  if (!parent.parentId) {
    return [];
  }

  const attachments = await ctx.db
    .query("attachments")
    .withIndex("by_parent", (q) =>
      q.eq("parentType", parent.parentType).eq("parentId", parent.parentId).eq("status", "active"),
    )
    .order("asc")
    .take(100);

  const visible = [];
  for (const attachment of attachments) {
    try {
      await assertCanViewAttachment(ctx, attachment, input.viewerWallet);
      visible.push(attachment);
    } catch {
      // Do not leak the existence of attachments the viewer cannot access.
    }
  }

  return visible;
}

export async function softDeleteAttachment(
  ctx: MutationCtx,
  input: { attachmentId: Id<"attachments">; walletAddress: string },
) {
  await assertCanModifyAttachment(ctx, input.attachmentId, input.walletAddress);
  await ctx.db.patch(input.attachmentId, {
    status: "deleted",
    updatedAt: Date.now(),
  });
}
