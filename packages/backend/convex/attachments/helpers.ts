import type { Id } from "../_generated/dataModel";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TWalletType } from "../users/schema";
import type {
  TAttachmentAccessAction,
  TAttachmentAccessResult,
  TAttachmentOwnerRole,
  TAttachmentParentType,
  TAttachmentProtectionMode,
  TAttachmentType,
  TAttachmentViewerRole,
  TAttachmentVisibility,
} from "./schema";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";
import { ACTIVE_DISPUTE_STATUSES } from "../disputes/schema";

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

type TAttachmentPolicyInput = Pick<
  Doc<"attachments">,
  | "_id"
  | "uploadedByWallet"
  | "uploadedByWalletType"
  | "ownerRole"
  | "parentType"
  | "parentId"
  | "visibility"
  | "status"
  | "type"
  | "protectionMode"
  | "downloadAllowed"
  | "previewAllowed"
  | "watermarkEnabled"
  | "accessLoggingEnabled"
  | "allowedViewerRoles"
  | "expiresAt"
  | "protectedReason"
>;

type TAttachmentAccessPolicy = {
  protectionMode: TAttachmentProtectionMode;
  downloadAllowed: boolean;
  previewAllowed: boolean;
  watermarkEnabled: boolean;
  accessLoggingEnabled: boolean;
  allowedViewerRoles: TAttachmentViewerRole[];
  viewerRole: TAttachmentViewerRole | null;
  isProtected: boolean;
  isExpired: boolean;
  canView: boolean;
  canPreview: boolean;
  canDownload: boolean;
  previewSupported: boolean;
  reason: string | null;
  notice: string | null;
};

const DEFAULT_PROTECTED_VIEWER_ROLES: TAttachmentViewerRole[] = [
  "client",
  "assigned_freelancer",
  "dispute_participant",
  "dispute_reviewer",
  "admin",
  "owner",
];
const SETTLED_ESCROW_STATUSES = new Set<string>(["released", "settled", "completed_paid"]);
const SETTLED_WORK_STATUSES = new Set<string>([
  "released",
  "completed",
  "settled",
  "completed_paid",
]);
export const FREELANCER_DELIVERABLE_PROTECTED_REASON =
  "Protected until payment release. You can preview this work, but downloads are restricted until the freelancer is paid.";
export const FREELANCER_DELIVERABLE_BLOCKED_DOWNLOAD_MESSAGE =
  "Download unlocks after funds are released. This protects freelancers from unpaid use of submitted work.";
export const FREELANCER_DELIVERABLE_UNLOCKED_MESSAGE =
  "Payment released. Deliverables are now available for download.";

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

function isSameWallet(left?: string | null, right?: string | null): boolean {
  if (!left || !right) {
    return false;
  }

  return normalizeWalletAddress(left) === normalizeWalletAddress(right);
}

export function isPreviewSupported(attachment: Pick<Doc<"attachments">, "type">): boolean {
  return ["image", "pdf", "markdown", "video", "link", "video_link"].includes(attachment.type);
}

export function normalizeProtectionSettings(attachment: Partial<TAttachmentPolicyInput>): {
  protectionMode: TAttachmentProtectionMode;
  downloadAllowed: boolean;
  previewAllowed: boolean;
  watermarkEnabled: boolean;
  accessLoggingEnabled: boolean;
  allowedViewerRoles: TAttachmentViewerRole[];
} {
  const protectionMode = attachment.protectionMode ?? "standard";
  const isProtected = protectionMode !== "standard";
  return {
    protectionMode,
    downloadAllowed: attachment.downloadAllowed ?? !isProtected,
    previewAllowed: attachment.previewAllowed ?? true,
    watermarkEnabled: attachment.watermarkEnabled ?? isProtected,
    accessLoggingEnabled: attachment.accessLoggingEnabled ?? isProtected,
    allowedViewerRoles:
      attachment.allowedViewerRoles ??
      (isProtected
        ? DEFAULT_PROTECTED_VIEWER_ROLES
        : ["public", ...DEFAULT_PROTECTED_VIEWER_ROLES]),
  };
}

export function validateProtectionSettings(input: {
  protectionMode?: TAttachmentProtectionMode;
  downloadAllowed?: boolean;
  previewAllowed?: boolean;
  watermarkEnabled?: boolean;
  accessLoggingEnabled?: boolean;
  allowedViewerRoles?: TAttachmentViewerRole[];
  expiresAt?: number;
  protectedReason?: string;
}) {
  if (
    input.expiresAt !== undefined &&
    (!Number.isFinite(input.expiresAt) || input.expiresAt <= 0)
  ) {
    throw new BadRequestError("Attachment protection expiration is invalid.");
  }

  const protectedReason = optionalNonEmptyString(input.protectedReason, "protectedReason");
  if (protectedReason && protectedReason.length > 280) {
    throw new BadRequestError("Protection reason must be 280 characters or fewer.");
  }

  const allowedViewerRoles = input.allowedViewerRoles
    ? Array.from(new Set(input.allowedViewerRoles))
    : undefined;
  if (allowedViewerRoles && allowedViewerRoles.length === 0) {
    throw new BadRequestError("Select at least one allowed viewer role.");
  }

  return {
    protectionMode: input.protectionMode ?? "standard",
    downloadAllowed: input.downloadAllowed,
    previewAllowed: input.previewAllowed,
    watermarkEnabled: input.watermarkEnabled,
    accessLoggingEnabled: input.accessLoggingEnabled,
    allowedViewerRoles,
    expiresAt: input.expiresAt,
    protectedReason,
  };
}

async function isAdminWallet(ctx: QueryCtx, walletAddress: string): Promise<boolean> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_walletAddress", (q) => q.eq("walletAddress", walletAddress))
    .first();

  return user?.role === "admin";
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

  if (input.parentType === "chat_message") {
    const message = await ctx.db.get(input.parentId as Id<"messages">);
    if (!message || message.status !== "sent") {
      throw new NotFoundError("Chat message was not found.");
    }
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || !conversation.participantWallets.includes(walletAddress)) {
      throw new ForbiddenError("You do not have permission to attach files to this message.");
    }
    if (message.senderWallet !== walletAddress) {
      throw new ForbiddenError("You can only attach files to your own message.");
    }
    return;
  }

  if (input.parentType === "revision_request") {
    const revision = await ctx.db.get(input.parentId as Id<"revisionRequests">);
    if (!revision || revision.status === "cancelled" || revision.status === "expired") {
      throw new NotFoundError("Revision request was not found.");
    }
    if (revision.clientWallet !== walletAddress) {
      throw new ForbiddenError("Only the client can attach files to this revision request.");
    }
    if (input.ownerRole !== "client") {
      throw new ForbiddenError("Only client-owned files can be attached to revision requests.");
    }
    return;
  }

  if (input.parentType === "dispute") {
    const dispute = await ctx.db.get(input.parentId as Id<"disputes">);
    if (!dispute || dispute.status === "cancelled") {
      throw new NotFoundError("Dispute was not found.");
    }
    if (dispute.clientWallet !== walletAddress && dispute.freelancerWallet !== walletAddress) {
      throw new ForbiddenError("You do not have permission to attach files to this dispute.");
    }
    if (
      (input.ownerRole === "client" && dispute.clientWallet !== walletAddress) ||
      (input.ownerRole === "freelancer" && dispute.freelancerWallet !== walletAddress)
    ) {
      throw new ForbiddenError("Attachment owner role does not match this dispute participant.");
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

export async function resolveAttachmentViewerRole(
  ctx: QueryCtx,
  attachment: TAttachmentPolicyInput,
  viewerWallet?: string,
): Promise<TAttachmentViewerRole | null> {
  if (!viewerWallet) {
    return attachment.visibility === "public" ? "public" : null;
  }

  const normalizedViewerWallet = normalizeWalletAddress(viewerWallet);

  if (isSameWallet(attachment.uploadedByWallet, normalizedViewerWallet)) {
    return "owner";
  }

  if (await isAdminWallet(ctx, normalizedViewerWallet)) {
    return "admin";
  }

  if (attachment.parentType === "job" && attachment.parentId) {
    const job = await ctx.db.get(attachment.parentId as Id<"jobs">);
    if (!job) return null;
    if (isSameWallet(job.clientWallet, normalizedViewerWallet)) return "client";
    if (isSameWallet(job.selectedFreelancerWallet, normalizedViewerWallet)) {
      return "assigned_freelancer";
    }
    return attachment.visibility === "public" && job.status === "open" ? "public" : null;
  }

  if (attachment.parentType === "milestone" && attachment.parentId) {
    const milestone = await ctx.db.get(attachment.parentId as Id<"milestones">);
    const job = milestone ? await ctx.db.get(milestone.jobId) : null;
    if (!milestone || !job) return null;
    if (isSameWallet(job.clientWallet, normalizedViewerWallet)) return "client";
    if (isSameWallet(milestone.assignedFreelancerWallet, normalizedViewerWallet)) {
      return "assigned_freelancer";
    }
    return null;
  }

  if (attachment.parentType === "work_submission" && attachment.parentId) {
    const submission = await ctx.db.get(attachment.parentId as Id<"workSubmissions">);
    if (!submission) return null;
    if (isSameWallet(submission.clientWallet, normalizedViewerWallet)) return "client";
    if (
      isSameWallet(submission.freelancerWallet, normalizedViewerWallet) ||
      isSameWallet(submission.submittedByWallet, normalizedViewerWallet)
    ) {
      return "assigned_freelancer";
    }
    return null;
  }

  if (attachment.parentType === "chat_message" && attachment.parentId) {
    const message = await ctx.db.get(attachment.parentId as Id<"messages">);
    const conversation = message ? await ctx.db.get(message.conversationId) : null;
    if (
      !message ||
      !conversation ||
      !conversation.participantWallets.includes(normalizedViewerWallet)
    ) {
      return null;
    }
    if (isSameWallet(conversation.clientWallet, normalizedViewerWallet)) return "client";
    if (isSameWallet(conversation.freelancerWallet, normalizedViewerWallet)) {
      return "assigned_freelancer";
    }
    return "dispute_participant";
  }

  if (attachment.parentType === "revision_request" && attachment.parentId) {
    const revision = await ctx.db.get(attachment.parentId as Id<"revisionRequests">);
    if (!revision) return null;
    if (isSameWallet(revision.clientWallet, normalizedViewerWallet)) return "client";
    if (isSameWallet(revision.freelancerWallet, normalizedViewerWallet)) {
      return "assigned_freelancer";
    }
    return null;
  }

  if (attachment.parentType === "dispute" && attachment.parentId) {
    const dispute = await ctx.db.get(attachment.parentId as Id<"disputes">);
    if (!dispute) return null;
    if (
      isSameWallet(dispute.clientWallet, normalizedViewerWallet) ||
      isSameWallet(dispute.freelancerWallet, normalizedViewerWallet)
    ) {
      return "dispute_participant";
    }
    return null;
  }

  if (attachment.parentType === "cancellation" && attachment.parentId) {
    const cancellation = await ctx.db.get(attachment.parentId as Id<"cancellationRequests">);
    if (!cancellation) return null;
    if (isSameWallet(cancellation.clientWallet, normalizedViewerWallet)) return "client";
    if (isSameWallet(cancellation.freelancerWallet, normalizedViewerWallet)) {
      return "assigned_freelancer";
    }
    return null;
  }

  return null;
}

export function isProtectedAttachment(attachment: Partial<TAttachmentPolicyInput>): boolean {
  return normalizeProtectionSettings(attachment).protectionMode !== "standard";
}

export function shouldWatermarkAttachment(attachment: Partial<TAttachmentPolicyInput>): boolean {
  return normalizeProtectionSettings(attachment).watermarkEnabled;
}

export function shouldLogAttachmentAccess(attachment: Partial<TAttachmentPolicyInput>): boolean {
  return normalizeProtectionSettings(attachment).accessLoggingEnabled;
}

export function isDownloadRestricted(attachment: Partial<TAttachmentPolicyInput>): boolean {
  return !normalizeProtectionSettings(attachment).downloadAllowed;
}

export function buildWatermarkText(input: {
  viewerWallet?: string;
  viewerWalletType?: string;
  viewerRole?: TAttachmentViewerRole | null;
  attachmentId?: string;
  now?: number;
}): string {
  const timestamp = new Date(input.now ?? Date.now()).toISOString().slice(0, 10);
  const identity = sanitizeWatermarkIdentity(input.viewerWallet);
  const walletType = input.viewerWalletType?.replace(/_/g, " ");
  return [
    "Highrable",
    input.viewerRole?.replace(/_/g, " "),
    walletType,
    identity,
    input.attachmentId ? `Attachment ${input.attachmentId.slice(-6)}` : undefined,
    timestamp,
    "Access logged",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function sanitizeWatermarkIdentity(walletAddress?: string): string | undefined {
  if (!walletAddress) return undefined;
  const normalized = normalizeWalletAddress(walletAddress);
  if (normalized.length <= 12) return normalized;
  return `${normalized.slice(0, 5)}...${normalized.slice(-4)}`;
}

export function buildWatermarkPayload(input: {
  attachment: TAttachmentPolicyInput;
  viewerWallet?: string;
  viewerWalletType?: string;
  viewerRole?: TAttachmentViewerRole | null;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  return {
    text: buildWatermarkText({
      viewerWallet: input.viewerWallet,
      viewerWalletType: input.viewerWalletType,
      viewerRole: input.viewerRole,
      attachmentId: input.attachment._id,
      now,
    }),
    renderedAt: now,
  };
}

export function isEscrowReleased(escrow?: Pick<Doc<"escrows">, "status"> | null): boolean {
  return escrow ? SETTLED_ESCROW_STATUSES.has(escrow.status) : false;
}

export function isMilestonePaid(
  milestone?: Pick<Doc<"milestones">, "status" | "approvedAt" | "completedAt"> | null,
): boolean {
  return Boolean(
    milestone &&
    (SETTLED_WORK_STATUSES.has(milestone.status) ||
      (milestone.status === "released" && milestone.approvedAt !== undefined)),
  );
}

async function hasActiveDisputeForWorkSubmission(
  ctx: QueryCtx,
  submission: Pick<
    Doc<"workSubmissions">,
    "parentType" | "parentId" | "escrowId" | "onChainEscrowId"
  >,
): Promise<boolean> {
  if (submission.escrowId !== undefined) {
    const dispute = await ctx.db
      .query("disputes")
      .withIndex("by_escrow_status", (q) => q.eq("escrowId", submission.escrowId))
      .filter((q) =>
        q.or(...ACTIVE_DISPUTE_STATUSES.map((status) => q.eq(q.field("status"), status))),
      )
      .first();
    if (dispute) return true;
  }

  if (submission.onChainEscrowId !== undefined) {
    const dispute = await ctx.db
      .query("disputes")
      .withIndex("by_onChainEscrow_status", (q) =>
        q.eq("onChainEscrowId", submission.onChainEscrowId),
      )
      .filter((q) =>
        q.or(...ACTIVE_DISPUTE_STATUSES.map((status) => q.eq(q.field("status"), status))),
      )
      .first();
    if (dispute) return true;
  }

  const parentType = submission.parentType === "job" ? "job" : submission.parentType;
  const dispute = await ctx.db
    .query("disputes")
    .withIndex("by_parent_status", (q) =>
      q.eq("parentType", parentType).eq("parentId", submission.parentId),
    )
    .filter((q) =>
      q.or(...ACTIVE_DISPUTE_STATUSES.map((status) => q.eq(q.field("status"), status))),
    )
    .first();

  return dispute !== null;
}

export async function isWorkSettled(
  ctx: QueryCtx,
  submission: Pick<
    Doc<"workSubmissions">,
    "parentType" | "parentId" | "jobId" | "milestoneId" | "escrowId"
  >,
): Promise<boolean> {
  if (submission.escrowId !== undefined) {
    const escrow = await ctx.db.get(submission.escrowId);
    if (isEscrowReleased(escrow)) return true;
  }

  if (submission.milestoneId !== undefined) {
    const milestone = await ctx.db.get(submission.milestoneId);
    if (isMilestonePaid(milestone)) return true;
  }

  const jobId =
    submission.jobId ?? (submission.parentType !== "milestone" ? submission.parentId : undefined);
  if (jobId !== undefined) {
    const job = await ctx.db.get(jobId as Id<"jobs">);
    if (job && SETTLED_WORK_STATUSES.has(job.status)) return true;
  }

  return false;
}

async function getWorkSubmissionForDeliverable(ctx: QueryCtx, attachment: TAttachmentPolicyInput) {
  if (attachment.parentType !== "work_submission" || !attachment.parentId) {
    return null;
  }

  const submission = await ctx.db.get(attachment.parentId as Id<"workSubmissions">);
  return submission ?? null;
}

export async function shouldProtectFreelancerDeliverable(
  ctx: QueryCtx,
  attachment: TAttachmentPolicyInput,
): Promise<boolean> {
  if (attachment.ownerRole !== "freelancer") {
    return false;
  }

  const submission = await getWorkSubmissionForDeliverable(ctx, attachment);
  if (!submission) {
    return false;
  }

  if (await hasActiveDisputeForWorkSubmission(ctx, submission)) {
    return true;
  }

  return !(await isWorkSettled(ctx, submission));
}

export async function canClientDownloadDeliverable(
  ctx: QueryCtx,
  attachment: TAttachmentPolicyInput,
): Promise<boolean> {
  if (attachment.ownerRole !== "freelancer") {
    return normalizeProtectionSettings(attachment).downloadAllowed;
  }

  const submission = await getWorkSubmissionForDeliverable(ctx, attachment);
  return submission ? await isWorkSettled(ctx, submission) : false;
}

async function resolveEffectiveProtectionSettings(
  ctx: QueryCtx,
  attachment: TAttachmentPolicyInput,
) {
  const settings = normalizeProtectionSettings(attachment);
  const submission = await getWorkSubmissionForDeliverable(ctx, attachment);

  if (attachment.ownerRole !== "freelancer" || !submission) {
    return {
      ...settings,
      reason: attachment.protectedReason ?? null,
      notice: settings.protectionMode === "standard" ? null : (attachment.protectedReason ?? null),
    };
  }

  const settled = await isWorkSettled(ctx, submission);
  const hasActiveDispute = await hasActiveDisputeForWorkSubmission(ctx, submission);
  if (settled && !hasActiveDispute) {
    return {
      ...settings,
      protectionMode: "standard" as const,
      downloadAllowed: true,
      previewAllowed: true,
      watermarkEnabled: false,
      accessLoggingEnabled: settings.accessLoggingEnabled,
      allowedViewerRoles: ["public", ...DEFAULT_PROTECTED_VIEWER_ROLES] as TAttachmentViewerRole[],
      reason: null,
      notice: FREELANCER_DELIVERABLE_UNLOCKED_MESSAGE,
    };
  }

  return {
    ...settings,
    protectionMode: "protected_preview" as const,
    downloadAllowed: false,
    previewAllowed: true,
    watermarkEnabled: true,
    accessLoggingEnabled: true,
    allowedViewerRoles: DEFAULT_PROTECTED_VIEWER_ROLES,
    reason: FREELANCER_DELIVERABLE_PROTECTED_REASON,
    notice: FREELANCER_DELIVERABLE_PROTECTED_REASON,
  };
}

export async function getAttachmentAccessPolicy(
  ctx: QueryCtx,
  attachment: TAttachmentPolicyInput,
  viewerWallet?: string,
): Promise<TAttachmentAccessPolicy> {
  const settings = await resolveEffectiveProtectionSettings(ctx, attachment);
  const isProtected = settings.protectionMode !== "standard";
  const viewerRole = await resolveAttachmentViewerRole(ctx, attachment, viewerWallet);
  const isExpired = attachment.expiresAt !== undefined && attachment.expiresAt <= Date.now();
  const previewSupported = isPreviewSupported(attachment);

  let canView = false;
  let reason: string | null = null;
  try {
    await assertCanViewAttachment(ctx, attachment, viewerWallet);
    canView = true;
  } catch (error) {
    reason = error instanceof Error ? error.message : "You do not have access to this attachment.";
  }

  const roleAllowed =
    !isProtected || (viewerRole ? settings.allowedViewerRoles.includes(viewerRole) : false);
  if (canView && isProtected && !roleAllowed) {
    reason = "You do not have access to this attachment.";
  }
  if (canView && isExpired) {
    reason = "This protected preview link expired. Reopen the attachment.";
  }

  const canPreview = canView && !isExpired && roleAllowed && settings.previewAllowed;
  const canDownload =
    canView &&
    !isExpired &&
    roleAllowed &&
    (settings.downloadAllowed || viewerRole === "owner" || viewerRole === "admin");

  if (canView && !settings.previewAllowed) {
    reason = "Protected preview is not enabled for this attachment.";
  } else if (canView && !canDownload && viewerRole === "client" && settings.reason) {
    reason = settings.reason;
  }

  return {
    ...settings,
    viewerRole,
    isProtected,
    isExpired,
    canView: canView && !isExpired && roleAllowed,
    canPreview,
    canDownload,
    previewSupported,
    reason,
    notice: settings.notice,
  };
}

export async function assertCanPreviewAttachment(
  ctx: QueryCtx,
  attachment: TAttachmentPolicyInput,
  viewerWallet?: string,
) {
  const policy = await getAttachmentAccessPolicy(ctx, attachment, viewerWallet);
  if (!policy.canPreview) {
    throw new ForbiddenError(policy.reason ?? "You do not have access to this attachment.");
  }

  return policy;
}

export async function assertCanDownloadAttachment(
  ctx: QueryCtx,
  attachment: TAttachmentPolicyInput,
  viewerWallet?: string,
) {
  const policy = await getAttachmentAccessPolicy(ctx, attachment, viewerWallet);
  if (!policy.canDownload) {
    throw new ForbiddenError(
      policy.downloadAllowed
        ? (policy.reason ?? "You do not have access to this attachment.")
        : FREELANCER_DELIVERABLE_BLOCKED_DOWNLOAD_MESSAGE,
    );
  }

  return policy;
}

export async function serializeAttachmentForViewer(
  ctx: QueryCtx,
  attachment: Doc<"attachments">,
  viewerWallet?: string,
) {
  const policy = await getAttachmentAccessPolicy(ctx, attachment, viewerWallet);
  if (!policy.canPreview && policy.isProtected) {
    throw new ForbiddenError(policy.reason ?? "You do not have access to this attachment.");
  }

  return {
    ...attachment,
    url:
      !policy.isProtected && attachment.storageId
        ? await ctx.storage.getUrl(attachment.storageId)
        : null,
    protection: {
      mode: policy.protectionMode,
      isProtected: policy.isProtected,
      previewAllowed: policy.previewAllowed,
      downloadAllowed: policy.downloadAllowed,
      watermarkEnabled: policy.watermarkEnabled,
      accessLoggingEnabled: policy.accessLoggingEnabled,
      viewerRole: policy.viewerRole,
      previewSupported: policy.previewSupported,
      downloadRestricted: !policy.canDownload,
      protectedReason: policy.reason ?? attachment.protectedReason ?? null,
      notice: policy.notice,
    },
  };
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
    attachment.parentType === "milestone" &&
    attachment.parentId
  ) {
    const milestone = await ctx.db.get(attachment.parentId as Id<"milestones">);
    const job = milestone ? await ctx.db.get(milestone.jobId) : null;
    if (
      milestone &&
      job &&
      (job.clientWallet === normalizedViewerWallet ||
        milestone.assignedFreelancerWallet === normalizedViewerWallet)
    ) {
      return;
    }
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

  if (
    attachment.visibility === "participants" &&
    attachment.parentType === "chat_message" &&
    attachment.parentId
  ) {
    const message = await ctx.db.get(attachment.parentId as Id<"messages">);
    const conversation = message ? await ctx.db.get(message.conversationId) : null;
    if (
      message &&
      message.status !== "hidden" &&
      conversation &&
      conversation.participantWallets.includes(normalizedViewerWallet)
    ) {
      return;
    }
  }

  if (
    attachment.visibility === "participants" &&
    attachment.parentType === "revision_request" &&
    attachment.parentId
  ) {
    const revision = await ctx.db.get(attachment.parentId as Id<"revisionRequests">);
    if (
      revision &&
      (revision.clientWallet === normalizedViewerWallet ||
        revision.freelancerWallet === normalizedViewerWallet)
    ) {
      return;
    }
  }

  if (
    attachment.visibility === "participants" &&
    attachment.parentType === "dispute" &&
    attachment.parentId
  ) {
    const dispute = await ctx.db.get(attachment.parentId as Id<"disputes">);
    if (
      dispute &&
      (dispute.clientWallet === normalizedViewerWallet ||
        dispute.freelancerWallet === normalizedViewerWallet)
    ) {
      return;
    }
  }

  if (
    attachment.visibility === "participants" &&
    attachment.parentType === "cancellation" &&
    attachment.parentId
  ) {
    const cancellation = await ctx.db.get(attachment.parentId as Id<"cancellationRequests">);
    if (
      cancellation &&
      (cancellation.clientWallet === normalizedViewerWallet ||
        cancellation.freelancerWallet === normalizedViewerWallet)
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
    if (submission && submission.status !== "draft" && submission.status !== "anchor_failed") {
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
      if (isProtectedAttachment(attachment)) {
        await assertCanPreviewAttachment(ctx, attachment, input.viewerWallet);
      } else {
        await assertCanViewAttachment(ctx, attachment, input.viewerWallet);
      }
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

export async function createAttachmentAccessLog(
  ctx: MutationCtx,
  input: {
    attachment: Doc<"attachments">;
    viewerWallet?: string;
    viewerWalletType?: TWalletType;
    viewerRole?: TAttachmentViewerRole | null;
    action: TAttachmentAccessAction;
    result: TAttachmentAccessResult;
    reason?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    force?: boolean;
  },
) {
  if (!input.force && !shouldLogAttachmentAccess(input.attachment)) {
    return null;
  }

  const viewerWallet = input.viewerWallet ? normalizeWalletAddress(input.viewerWallet) : undefined;
  const reason = optionalNonEmptyString(input.reason, "reason")?.slice(0, 280);
  const sessionId = optionalNonEmptyString(input.sessionId, "sessionId")?.slice(0, 120);

  return await ctx.db.insert("attachmentAccessLogs", {
    attachmentId: input.attachment._id,
    parentType: input.attachment.parentType,
    ...(input.attachment.parentId ? { parentId: input.attachment.parentId } : {}),
    ...(viewerWallet ? { viewerWallet } : {}),
    ...(input.viewerWalletType ? { viewerWalletType: input.viewerWalletType } : {}),
    ...(input.viewerRole ? { viewerRole: input.viewerRole } : {}),
    action: input.action,
    result: input.result,
    ...(reason ? { reason } : {}),
    ...(sessionId ? { sessionId } : {}),
    createdAt: Date.now(),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
}
