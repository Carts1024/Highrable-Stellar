import type { TAttachmentType } from "./types";

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

export function formatAttachmentSize(size?: number): string {
  if (!size || !Number.isFinite(size)) {
    return "Link";
  }

  if (size >= MB) {
    return `${(size / MB).toFixed(size >= 10 * MB ? 0 : 1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function getAttachmentExtension(name: string): string | undefined {
  const extension = name.trim().split(".").pop()?.toLowerCase();
  if (!extension || extension === name.toLowerCase() || extension.length > 16) {
    return undefined;
  }

  return extension;
}

export function normalizeAttachmentType(file: File): TAttachmentType {
  const mimeType = file.type.toLowerCase();
  const extension = getAttachmentExtension(file.name);

  if (IMAGE_MIME_TYPES.has(mimeType) || (extension && IMAGE_EXTENSIONS.has(extension))) {
    return "image";
  }
  if (VIDEO_MIME_TYPES.has(mimeType) || (extension && VIDEO_EXTENSIONS.has(extension))) {
    return "video";
  }
  if (PDF_MIME_TYPES.has(mimeType) || (extension && PDF_EXTENSIONS.has(extension))) {
    return "pdf";
  }
  if (MARKDOWN_MIME_TYPES.has(mimeType) || (extension && MARKDOWN_EXTENSIONS.has(extension))) {
    return "markdown";
  }
  if (DOCUMENT_MIME_TYPES.has(mimeType) || (extension && DOCUMENT_EXTENSIONS.has(extension))) {
    return "document";
  }

  return "file";
}

export function validateAttachmentFile(file: File): string | null {
  const type = normalizeAttachmentType(file);
  const extension = getAttachmentExtension(file.name);
  const mimeType = file.type.toLowerCase();

  const hasKnownType =
    type !== "file" ||
    !mimeType ||
    Boolean(extension && [...DOCUMENT_EXTENSIONS, ...MARKDOWN_EXTENSIONS].includes(extension));

  if (!hasKnownType) {
    return "This file type is not supported yet.";
  }

  if (type === "video" && file.size > MAX_VIDEO_BYTES) {
    return "Videos must be 25 MB or smaller.";
  }

  if (type === "image" && file.size > MAX_IMAGE_BYTES) {
    return "Images must be 10 MB or smaller.";
  }

  if (
    (type === "document" || type === "pdf" || type === "markdown" || type === "file") &&
    file.size > MAX_DOCUMENT_BYTES
  ) {
    return "Documents must be 10 MB or smaller.";
  }

  return null;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function getReadableAttachmentError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "message" in error.data &&
    typeof error.data.message === "string"
  ) {
    return error.data.message;
  }

  return fallback;
}
