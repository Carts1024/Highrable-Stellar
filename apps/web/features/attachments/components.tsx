"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import {
  formatAttachmentSize,
  getReadableAttachmentError,
  isValidHttpUrl,
  normalizeAttachmentType,
  validateAttachmentFile,
} from "@/features/attachments/lib";
import {
  AttachmentProtectionBadge,
  ProtectedAttachmentDialog,
} from "@/features/attachments/protected-viewer";
import { showWarningToast } from "@/features/common";
import { api } from "@repo/convex-client";
import {
  HighrableV2Badge,
  HighrableV2Bullet,
  HighrableV2IconNotice,
} from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch as AppSwitch } from "@repo/ui/components/ui/switch";
import { cn } from "@repo/ui/lib/utils";
import { useMutation } from "convex/react";
import {
  Download,
  File,
  FileArchive,
  FileText,
  Image,
  Link2,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import type {
  TAttachmentProtectionSummary,
  TAttachmentType,
  TDraftAttachment,
} from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";
import type { Dispatch, SetStateAction } from "react";

type TStorageId = string & { __tableName: "_storage" };

type TAttachmentWithUrl = TConvexDoc<"attachments"> & {
  url?: string | null;
  protection?: TAttachmentProtectionSummary;
};

const ACCEPTED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
].join(",");

const MAX_EXTERNAL_URL_LENGTH = 2048;

interface IAttachmentFileIconProps {
  readonly type: TAttachmentType;
}

interface IAttachmentTypeBadgeProps {
  readonly type: TAttachmentType;
}

interface IAttachmentRemoveButtonProps {
  readonly disabled?: boolean;
  readonly onRemove: () => void;
}

interface IAttachmentPreviewCardProps {
  readonly attachment: TDraftAttachment | TAttachmentWithUrl;
  readonly readOnly?: boolean;
  readonly onRemove?: () => void;
}

interface IAttachmentListProps {
  readonly attachments: readonly (TDraftAttachment | TAttachmentWithUrl)[];
  readonly readOnly?: boolean;
  readonly onRemove?: (attachmentId: string) => void;
}

interface ILinkAttachmentInputProps {
  readonly disabled?: boolean;
  readonly onAdd: (input: {
    url: string;
    type: "link" | "video_link";
    name?: string;
  }) => Promise<void>;
}

interface IAttachmentDropzoneProps {
  readonly disabled?: boolean;
  readonly onFiles: (files: File[]) => void;
}

interface IAttachmentUploaderProps {
  readonly value: TDraftAttachment[];
  readonly onChange: Dispatch<SetStateAction<TDraftAttachment[]>>;
  readonly disabled?: boolean;
  readonly ownerRole?: "client" | "freelancer";
}

function getAttachmentLabel(type: TAttachmentType): string {
  const labels: Record<TAttachmentType, string> = {
    image: "Image",
    video: "Video",
    video_link: "Video Link",
    link: "Link",
    document: "Document",
    pdf: "PDF",
    markdown: "Markdown",
    file: "File",
  };

  return labels[type];
}

function getNormalizedHttpUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0 || trimmedValue.length > MAX_EXTERNAL_URL_LENGTH) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

//  Atomic sub-components

export function AttachmentFileIcon({ type }: IAttachmentFileIconProps) {
  const className = "h-4 w-4";

  if (type === "image") return <Image className={className} />;
  if (type === "video" || type === "video_link") return <Video className={className} />;
  if (type === "link") return <Link2 className={className} />;
  if (type === "pdf" || type === "markdown") return <FileText className={className} />;
  if (type === "document") return <FileArchive className={className} />;

  return <File className={className} />;
}

export function AttachmentTypeBadge({ type }: IAttachmentTypeBadgeProps) {
  return (
    <Badge className="hr-text-secondary rounded-md border-border bg-muted px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.06em] uppercase hover:bg-muted">
      {getAttachmentLabel(type)}
    </Badge>
  );
}

export function AttachmentRemoveButton({ disabled, onRemove }: IAttachmentRemoveButtonProps) {
  return (
    <AppButton
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onRemove}
      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Remove attachment"
    >
      <Trash2 className="h-4 w-4" />
    </AppButton>
  );
}

// Attachment preview card

export function AttachmentPreviewCard({
  attachment,
  readOnly = false,
  onRemove,
}: IAttachmentPreviewCardProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const recordDownloadAttempt = useMutation(api.attachments.recordDownloadAttempt);
  const isDraft = "id" in attachment;
  const type = attachment.type as TAttachmentType;
  const href = "externalUrl" in attachment ? attachment.externalUrl : attachment.url;
  const isUploading = isDraft && attachment.status === "uploading";
  const isFailed = isDraft && attachment.status === "failed";
  const isProtected = !isDraft && attachment.protection?.isProtected;
  const isDownloadRestricted = !isDraft && attachment.protection?.downloadRestricted;
  const [isProtectedPreviewOpen, setIsProtectedPreviewOpen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (isDraft) return;

    if (!walletIdentity.walletAddress) {
      setDownloadError("Connect the participant wallet to download this attachment.");
      return;
    }

    setDownloadError(null);
    try {
      const result = await recordDownloadAttempt({
        attachmentId: attachment._id,
        viewerWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { viewerWalletType: walletIdentity.walletType } : {}),
      });
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setDownloadError(getReadableAttachmentError(error, "Download is restricted."));
    }
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0",
        isFailed ? "bg-red-50/50" : "bg-card",
      )}
    >
      {/* File type icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AttachmentFileIcon type={type} />
        )}
      </div>

      {/* Name + metadata */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {isProtected ? (
            <button
              type="button"
              onClick={() => setIsProtectedPreviewOpen(true)}
              className="hr-text-primary hover:hr-text-accent min-w-0 truncate text-left font-sans text-sm font-semibold"
            >
              {attachment.name}
            </button>
          ) : href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="hr-text-primary hover:hr-text-accent min-w-0 truncate font-sans text-sm font-semibold"
            >
              {attachment.name}
            </a>
          ) : (
            <p className="hr-text-primary min-w-0 truncate font-sans text-sm font-semibold">
              {attachment.name}
            </p>
          )}

          {/* Inline status notices — hover tooltip via HighrableV2IconNotice */}
          {isDraft && attachment.error ? (
            <HighrableV2IconNotice
              label="Attachment error"
              tone="danger"
              message={attachment.error}
            />
          ) : null}
          {!isDraft && attachment.protection?.notice && !attachment.protection.isProtected ? (
            <HighrableV2IconNotice
              label="Attachment notice"
              tone="success"
              message={attachment.protection.notice}
            />
          ) : null}
          {downloadError ? (
            <HighrableV2IconNotice label="Download error" tone="warning" message={downloadError} />
          ) : null}
        </div>

        {/* Type badge + status badges + size */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <AttachmentTypeBadge type={type} />
          {!isDraft ? <AttachmentProtectionBadge protection={attachment.protection} /> : null}
          {isUploading ? <HighrableV2Badge>Uploading</HighrableV2Badge> : null}
          {isFailed ? <HighrableV2Badge tone="solid">Failed</HighrableV2Badge> : null}
          <span className="hr-text-muted font-sans text-xs">
            {isUploading ? "Uploading..." : formatAttachmentSize(attachment.size)}
            {"mimeType" in attachment && attachment.mimeType ? ` · ${attachment.mimeType}` : ""}
            {!isDraft && attachment.protection?.isProtected
              ? " · Watermarked and access logged"
              : ""}
          </span>
        </div>
      </div>

      {/* Action button */}
      {readOnly && !isDraft ? (
        <AppButton
          type="button"
          variant="outline"
          size="sm"
          disabled={isDownloadRestricted}
          onClick={() => void handleDownload()}
          className="rounded-lg border-border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Download ${attachment.name}`}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {isDownloadRestricted ? "Locked" : "Download"}
        </AppButton>
      ) : !readOnly && onRemove ? (
        <AttachmentRemoveButton disabled={isUploading} onRemove={onRemove} />
      ) : null}

      {isProtected && !isDraft ? (
        <ProtectedAttachmentDialog
          attachment={attachment}
          isOpen={isProtectedPreviewOpen}
          onOpenChange={setIsProtectedPreviewOpen}
        />
      ) : null}
    </div>
  );
}

// Attachment list

export function AttachmentList({ attachments, readOnly = false, onRemove }: IAttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <div className="hr-text-secondary flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-4 font-sans text-sm">
        <HighrableV2Bullet tone="muted" aria-hidden="true" />
        <span>No attachments added.</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {attachments.map((attachment) => {
        const id = "id" in attachment ? attachment.id : attachment._id;

        return (
          <AttachmentPreviewCard
            key={id}
            attachment={attachment}
            readOnly={readOnly}
            onRemove={onRemove ? () => onRemove(id) : undefined}
          />
        );
      })}
    </div>
  );
}

// Link attachment input

export function LinkAttachmentInput({ disabled, onAdd }: ILinkAttachmentInputProps) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"link" | "video_link">("link");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const normalizedUrl = getNormalizedHttpUrl(url);
    if (!normalizedUrl || !isValidHttpUrl(normalizedUrl)) {
      const nextWarning = "Enter a valid HTTP or HTTPS URL.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    setIsAdding(true);
    setError(null);
    try {
      await onAdd({ url: normalizedUrl, type });
      setUrl("");
    } catch (error) {
      setError(getReadableAttachmentError(error, "Attachment save failed."));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="sr-only" htmlFor="link-attachment-url">
        Link URL
      </Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_auto]">
        <AppInput
          id="link-attachment-url"
          value={url}
          disabled={disabled || isAdding}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          placeholder="https://example.com/reference"
          aria-label="Attachment URL"
          maxLength={MAX_EXTERNAL_URL_LENGTH}
          className="w-full"
        />

        <Select
          value={type}
          onValueChange={(value) => setType(value as "link" | "video_link")}
          disabled={disabled || isAdding}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="link">Link</SelectItem>
            <SelectItem value="video_link">Video Link</SelectItem>
          </SelectContent>
        </Select>

        <AppButton
          type="button"
          disabled={disabled || isAdding}
          onClick={() => void handleAdd()}
          className="hr-v2-button-secondary ml-12 w-full text-sm font-semibold sm:w-auto"
        >
          {isAdding ? "Adding..." : "Add Link"}
        </AppButton>
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <HighrableV2IconNotice label="Link attachment error" tone="danger" message={error} />
          <span>Check URL</span>
        </div>
      ) : null}
    </div>
  );
}

// Dropzone

export function AttachmentDropzone({ disabled, onFiles }: IAttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return;
    onFiles(Array.from(fileList));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "grid cursor-pointer place-items-center rounded-lg border border-dashed p-6 text-center transition-colors",
        isDragging
          ? "border-highrable-orange-2 bg-orange-50"
          : "border-border bg-muted/30 hover:border-highrable-orange-2/60 hover:bg-muted/50",
        disabled ? "pointer-events-none opacity-60" : undefined,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_ATTACHMENT_TYPES}
        className="hidden"
        aria-label="Upload attachments"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-highrable-orange-2/10 text-highrable-orange-2">
        <Upload className="h-5 w-5" />
      </div>

      <p className="hr-text-primary mt-3 font-mono text-sm font-semibold">
        Drop files or click to browse
      </p>

      <div className="mt-1 flex items-center justify-center gap-1.5">
        <p className="hr-text-secondary font-sans text-xs">Images, docs, PDFs, Markdown, video</p>
        <HighrableV2IconNotice
          label="Attachment limits"
          message="Images, documents, PDFs, and Markdown must be 10 MB or smaller. Videos must be 25 MB or smaller."
        />
      </div>
    </div>
  );
}

// Full uploader

export function AttachmentUploader({
  value,
  onChange,
  disabled,
  ownerRole = "client",
}: IAttachmentUploaderProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const saveUploadedAttachment = useMutation(api.attachments.saveUploadedAttachment);
  const createExternalAttachment = useMutation(api.attachments.createExternalAttachment);
  const softDeleteAttachment = useMutation(api.attachments.softDelete);
  const [error, setError] = useState<string | null>(null);
  const [useProtectedPreview, setUseProtectedPreview] = useState(false);

  const patchDraft = useCallback(
    (draftId: string, patch: Partial<TDraftAttachment>) => {
      onChange((currentAttachments) =>
        currentAttachments.map((attachment) =>
          attachment.id === draftId ? { ...attachment, ...patch } : attachment,
        ),
      );
    },
    [onChange],
  );

  const uploadFile = async (file: File) => {
    if (!walletIdentity.walletAddress) {
      const nextWarning = "Missing wallet identity.";
      setError(nextWarning);
      showWarningToast(nextWarning);
      return;
    }

    const validationError = validateAttachmentFile(file);
    const draftId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const type = normalizeAttachmentType(file);
    const draft: TDraftAttachment = {
      id: draftId,
      name: file.name,
      type,
      size: file.size,
      mimeType: file.type,
      status: validationError ? "failed" : "uploading",
      ...(validationError ? { error: validationError } : {}),
    };

    onChange((currentAttachments) => [...currentAttachments, draft]);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const postUrl = await generateUploadUrl({
        walletAddress: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { walletType: walletIdentity.walletType } : {}),
        name: file.name,
        size: file.size,
        ...(file.type ? { mimeType: file.type } : {}),
        type,
      });
      const result = await fetch(postUrl, {
        method: "POST",
        headers: file.type ? { "Content-Type": file.type } : undefined,
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed.");
      }

      const { storageId } = (await result.json()) as { storageId: TStorageId };
      const attachmentId = await saveUploadedAttachment({
        storageId,
        uploadedByWallet: walletIdentity.walletAddress,
        ...(walletIdentity.walletType ? { uploadedByWalletType: walletIdentity.walletType } : {}),
        ownerRole,
        name: file.name,
        size: file.size,
        ...(file.type ? { mimeType: file.type } : {}),
        type,
        parentType: "unknown",
        visibility: "private",
        ...(useProtectedPreview
          ? {
              protectionMode: "protected_preview",
              downloadAllowed: false,
              previewAllowed: true,
              watermarkEnabled: true,
              accessLoggingEnabled: true,
            }
          : {}),
      });

      patchDraft(draftId, { id: attachmentId, status: "ready", error: undefined });
      setError(null);
    } catch (error) {
      const message = getReadableAttachmentError(
        error,
        "Upload completed, but attachment metadata could not be saved. Please try again.",
      );
      patchDraft(draftId, { status: "failed", error: message });
      setError(message);
    }
  };

  const handleFiles = (files: File[]) => {
    for (const file of files) void uploadFile(file);
  };

  const addExternalLink = async (input: { url: string; type: "link" | "video_link" }) => {
    if (!walletIdentity.walletAddress) throw new Error("Missing wallet identity.");

    const normalizedUrl = getNormalizedHttpUrl(input.url);
    if (!normalizedUrl || !isValidHttpUrl(normalizedUrl)) {
      throw new Error("Enter a valid HTTP or HTTPS URL.");
    }

    const attachmentId = await createExternalAttachment({
      externalUrl: normalizedUrl,
      uploadedByWallet: walletIdentity.walletAddress,
      ...(walletIdentity.walletType ? { uploadedByWalletType: walletIdentity.walletType } : {}),
      ownerRole,
      type: input.type,
      name: normalizedUrl,
      parentType: "unknown",
      visibility: "private",
      ...(useProtectedPreview
        ? {
            protectionMode: "protected_preview",
            downloadAllowed: false,
            previewAllowed: true,
            watermarkEnabled: true,
            accessLoggingEnabled: true,
          }
        : {}),
    });

    onChange((currentAttachments) => [
      ...currentAttachments,
      {
        id: attachmentId,
        name: normalizedUrl,
        type: input.type,
        externalUrl: normalizedUrl,
        status: "ready",
      },
    ]);
  };

  const removeAttachment = async (attachmentId: string) => {
    const current = value.find((attachment) => attachment.id === attachmentId);
    onChange((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
    if (
      !walletIdentity.walletAddress ||
      !current ||
      current.status === "failed" ||
      current.status === "uploading"
    ) {
      return;
    }

    try {
      await softDeleteAttachment({
        attachmentId: attachmentId as TConvexId<"attachments">,
        walletAddress: walletIdentity.walletAddress,
      });
    } catch (error) {
      setError(getReadableAttachmentError(error, "Could not remove attachment."));
    }
  };

  const readyAttachmentCount = value.filter((attachment) => attachment.status === "ready").length;
  const uploadingAttachmentCount = value.filter(
    (attachment) => attachment.status === "uploading",
  ).length;

  return (
    <div className="space-y-3">
      {/* Header row: status badges + info notices */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <HighrableV2Badge tone={readyAttachmentCount > 0 ? "solid" : "accent"}>
            {readyAttachmentCount} ready
          </HighrableV2Badge>
          {uploadingAttachmentCount > 0 ? (
            <HighrableV2Badge>{uploadingAttachmentCount} uploading</HighrableV2Badge>
          ) : null}
        </div>

        {/* Info notices — hover tooltips, no click needed */}
        <div className="flex items-center gap-1.5">
          <HighrableV2IconNotice
            label="Attachment storage notice"
            message="Attachments are stored off-chain and linked to the job after the post is created."
          />
          <HighrableV2IconNotice
            label="Attachment visibility notice"
            message="Job attachments become visible on the public job detail page after they are linked."
          />
          {!walletIdentity.walletAddress ? (
            <HighrableV2IconNotice
              label="Wallet required for attachments"
              tone="warning"
              message="Connect a wallet before adding attachments."
            />
          ) : null}
        </div>
      </div>

      {/* Dropzone */}
      <AttachmentDropzone
        disabled={disabled || !walletIdentity.walletAddress}
        onFiles={handleFiles}
      />

      {/* Protected preview toggle */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <label
          htmlFor="attachment-protected-preview"
          className="hr-text-primary flex min-w-0 cursor-pointer items-center gap-2 text-sm font-semibold"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-highrable-text-accent" aria-hidden="true" />
          Protected preview
        </label>
        <div className="flex items-center gap-2">
          <HighrableV2IconNotice
            label="Protected preview details"
            message="New uploads use protected preview, restricted download, visible watermarking, and access logging."
          />
          <AppSwitch
            id="attachment-protected-preview"
            aria-label="Enable content protection controls"
            checked={useProtectedPreview}
            disabled={disabled}
            onCheckedChange={setUseProtectedPreview}
            className="data-[state=checked]:bg-highrable-orange-2"
          />
        </div>
      </div>

      {/* Link input */}
      <LinkAttachmentInput
        disabled={disabled || !walletIdentity.walletAddress}
        onAdd={addExternalLink}
      />

      {/* File list */}
      <AttachmentList
        attachments={value}
        onRemove={(attachmentId) => void removeAttachment(attachmentId)}
      />

      {/* Upload/action error */}
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <HighrableV2IconNotice label="Attachment action error" tone="danger" message={error} />
          <span>Attachment action failed</span>
        </div>
      ) : null}
    </div>
  );
}
