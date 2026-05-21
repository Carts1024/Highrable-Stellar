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
import { api } from "@repo/convex-client";
import {
  HighrableV2Badge,
  HighrableV2Bullet,
  HighrableV2IconNotice,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { NativeSelect } from "@repo/ui/components/ui/native-select";
import { Switch as AppSwitch } from "@repo/ui/components/ui/switch";
import { cn } from "@repo/ui/lib/utils";
import { useMutation } from "convex/react";
import {
  File,
  FileArchive,
  FileText,
  Download,
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
    <Badge className="hr-text-secondary rounded-none border-border bg-background px-2 py-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase hover:bg-background">
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
      className="hr-text-secondary h-8 w-8 rounded-none hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Remove attachment"
    >
      <Trash2 className="h-4 w-4" />
    </AppButton>
  );
}

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
    if (isDraft) {
      return;
    }

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
        "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background px-4 py-4 last:border-b-0",
        isFailed ? "bg-red-50/60" : undefined,
      )}
    >
      <div className="hr-surface-muted hr-text-primary flex h-10 w-10 shrink-0 items-center justify-center border border-border">
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AttachmentFileIcon type={type} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {isProtected ? (
            <button
              type="button"
              onClick={() => setIsProtectedPreviewOpen(true)}
              className="hr-text-primary hover:hr-text-accent min-w-0 truncate text-left text-sm font-semibold"
            >
              {attachment.name}
            </button>
          ) : href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="hr-text-primary hover:hr-text-accent min-w-0 truncate text-sm font-semibold"
            >
              {attachment.name}
            </a>
          ) : (
            <p className="hr-text-primary min-w-0 truncate text-sm font-semibold">
              {attachment.name}
            </p>
          )}
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
            <HighrableV2IconNotice
              label="Attachment download"
              tone="warning"
              message={downloadError}
            />
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <AttachmentTypeBadge type={type} />
          {!isDraft ? <AttachmentProtectionBadge protection={attachment.protection} /> : null}
          {isUploading ? <HighrableV2Badge>Uploading</HighrableV2Badge> : null}
          {isFailed ? <HighrableV2Badge tone="solid">Failed</HighrableV2Badge> : null}
          <span className="hr-text-muted font-mono text-xs">
            {isUploading ? "Uploading..." : formatAttachmentSize(attachment.size)}
            {"mimeType" in attachment && attachment.mimeType ? ` · ${attachment.mimeType}` : ""}
            {!isDraft && attachment.protection?.isProtected
              ? " · Watermarked and access logged"
              : ""}
          </span>
        </div>
      </div>
      {readOnly && !isDraft ? (
        <AppButton
          type="button"
          variant="outline"
          size="sm"
          disabled={isDownloadRestricted}
          onClick={() => void handleDownload()}
          className="rounded-none border-border px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
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

export function AttachmentList({ attachments, readOnly = false, onRemove }: IAttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <div className="hr-text-secondary flex items-center gap-2 border-y border-dashed border-border px-4 py-4 text-sm">
        <HighrableV2Bullet tone="muted" aria-hidden="true" />
        <span>No attachments added.</span>
      </div>
    );
  }

  return (
    <div className="border-y border-border">
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

export function LinkAttachmentInput({ disabled, onAdd }: ILinkAttachmentInputProps) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"link" | "video_link">("link");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const normalizedUrl = getNormalizedHttpUrl(url);
    if (!normalizedUrl || !isValidHttpUrl(normalizedUrl)) {
      setError("Enter a valid HTTP or HTTPS URL.");
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
      <div className="grid gap-2 sm:grid-cols-[1fr_9.5rem_auto]">
        <AppInput
          value={url}
          disabled={disabled || isAdding}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          placeholder="https://example.com/reference"
          className="rounded-none border-border bg-background"
          aria-label="Attachment URL"
          maxLength={MAX_EXTERNAL_URL_LENGTH}
        />
        <NativeSelect
          value={type}
          disabled={disabled || isAdding}
          onChange={(event) => setType(event.target.value as "link" | "video_link")}
          className="hr-text-primary h-10 rounded-none border-border bg-background"
          aria-label="Attachment link type"
        >
          <option value="link">Link</option>
          <option value="video_link">Video link</option>
        </NativeSelect>
        <AppButton
          type="button"
          disabled={disabled || isAdding}
          onClick={() => void handleAdd()}
          className="hr-v2-button-secondary rounded-none px-4 text-sm font-semibold"
        >
          {isAdding ? "Adding..." : "Add link"}
        </AppButton>
      </div>
      {error ? (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <HighrableV2IconNotice label="Link attachment error" tone="danger" message={error} />
          <span>Check URL</span>
        </div>
      ) : null}
    </div>
  );
}

export function AttachmentDropzone({ disabled, onFiles }: IAttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) {
      return;
    }
    onFiles(Array.from(fileList));
    if (inputRef.current) {
      inputRef.current.value = "";
    }
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
        "grid cursor-pointer place-items-center border border-dashed p-5 text-center transition-colors",
        isDragging
          ? "border-[#FF7003] bg-orange-50"
          : "hr-surface-muted border-border hover:border-[#FF7003]/70",
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
      <Upload className="mx-auto h-5 w-5 text-[#FF7003]" />
      <p className="hr-text-primary mt-2 text-sm font-semibold">Drop files or browse</p>
      <div className="mt-1 flex items-center justify-center gap-2">
        <p className="hr-text-secondary text-xs">Images, docs, PDFs, Markdown, video.</p>
        <HighrableV2IconNotice
          label="Attachment limits"
          message="Images must be 10 MB or smaller. Documents, PDFs, Markdown, and files must be 10 MB or smaller. Videos must be 25 MB or smaller."
        />
      </div>
    </div>
  );
}

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
      setError("Missing wallet identity.");
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

      patchDraft(draftId, {
        id: attachmentId,
        status: "ready",
        error: undefined,
      });
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
    for (const file of files) {
      void uploadFile(file);
    }
  };

  const addExternalLink = async (input: { url: string; type: "link" | "video_link" }) => {
    if (!walletIdentity.walletAddress) {
      throw new Error("Missing wallet identity.");
    }

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
    <section className="space-y-4 border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-2">
          <SectionLabel>Attachments</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <HighrableV2Badge tone={readyAttachmentCount > 0 ? "solid" : "accent"}>
              {readyAttachmentCount} ready
            </HighrableV2Badge>
            {uploadingAttachmentCount > 0 ? (
              <HighrableV2Badge>{uploadingAttachmentCount} uploading</HighrableV2Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      <AttachmentDropzone
        disabled={disabled || !walletIdentity.walletAddress}
        onFiles={handleFiles}
      />

      <div className="hr-surface-muted flex items-center justify-between gap-3 border border-border p-3">
        <label
          htmlFor="attachment-protected-preview"
          className="hr-text-primary flex min-w-0 items-center gap-2 text-sm font-semibold"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#B94A00]" aria-hidden="true" />
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
            className="data-[state=checked]:bg-[#FF7003]"
          />
        </div>
      </div>

      <LinkAttachmentInput
        disabled={disabled || !walletIdentity.walletAddress}
        onAdd={addExternalLink}
      />
      <AttachmentList
        attachments={value}
        onRemove={(attachmentId) => void removeAttachment(attachmentId)}
      />
      {error ? (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <HighrableV2IconNotice label="Attachment action error" tone="danger" message={error} />
          <span>Attachment action failed</span>
        </div>
      ) : null}
    </section>
  );
}
