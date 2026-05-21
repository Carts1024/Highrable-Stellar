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
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { useMutation } from "convex/react";
import {
  File,
  FileArchive,
  FileText,
  Image,
  Link2,
  Loader2,
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

export function AttachmentFileIcon({ type }: { type: TAttachmentType }) {
  const className = "h-4 w-4";

  if (type === "image") return <Image className={className} />;
  if (type === "video" || type === "video_link") return <Video className={className} />;
  if (type === "link") return <Link2 className={className} />;
  if (type === "pdf" || type === "markdown") return <FileText className={className} />;
  if (type === "document") return <FileArchive className={className} />;

  return <File className={className} />;
}

export function AttachmentTypeBadge({ type }: { type: TAttachmentType }) {
  return (
    <Badge className="rounded-md border border-[#e8e8e8] bg-white px-2 py-1 font-mono text-[0.65rem] tracking-[0.06em] text-[#5f5f5f] uppercase hover:bg-white">
      {getAttachmentLabel(type)}
    </Badge>
  );
}

export function AttachmentRemoveButton({
  disabled,
  onRemove,
}: {
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <AppButton
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onRemove}
      className="h-8 w-8 rounded-lg text-[#5f5f5f] hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
}: {
  attachment: TDraftAttachment | TAttachmentWithUrl;
  readOnly?: boolean;
  onRemove?: () => void;
}) {
  const isDraft = "id" in attachment;
  const type = attachment.type as TAttachmentType;
  const href = "externalUrl" in attachment ? attachment.externalUrl : attachment.url;
  const isUploading = isDraft && attachment.status === "uploading";
  const isProtected = !isDraft && attachment.protection?.isProtected;
  const [isProtectedPreviewOpen, setIsProtectedPreviewOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#e8e8e8] bg-white p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#fafafa] text-[#0a0a0a]">
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AttachmentFileIcon type={type} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {isProtected ? (
            <button
              type="button"
              onClick={() => setIsProtectedPreviewOpen(true)}
              className="truncate text-left text-sm font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
            >
              {attachment.name}
            </button>
          ) : href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-semibold text-[#0a0a0a] hover:text-[#FF7003]"
            >
              {attachment.name}
            </a>
          ) : (
            <p className="truncate text-sm font-semibold text-[#0a0a0a]">{attachment.name}</p>
          )}
          <AttachmentTypeBadge type={type} />
          {!isDraft ? <AttachmentProtectionBadge protection={attachment.protection} /> : null}
        </div>
        <p className="mt-1 font-mono text-xs text-[#7f7f7f]">
          {isUploading ? "Uploading..." : formatAttachmentSize(attachment.size)}
          {"mimeType" in attachment && attachment.mimeType ? ` · ${attachment.mimeType}` : ""}
          {!isDraft && attachment.protection?.isProtected ? " · Watermarked and access logged" : ""}
        </p>
        {!isDraft && attachment.protection?.notice && !attachment.protection.isProtected ? (
          <p className="mt-1 text-xs text-emerald-700">{attachment.protection.notice}</p>
        ) : null}
        {isDraft && attachment.error ? (
          <p className="mt-1 text-xs text-red-700">{attachment.error}</p>
        ) : null}
      </div>
      {!readOnly && onRemove ? (
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

export function AttachmentList({
  attachments,
  readOnly = false,
  onRemove,
}: {
  attachments: readonly (TDraftAttachment | TAttachmentWithUrl)[];
  readOnly?: boolean;
  onRemove?: (attachmentId: string) => void;
}) {
  if (attachments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
        No attachments.
      </p>
    );
  }

  return (
    <div className="space-y-2">
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

export function LinkAttachmentInput({
  disabled,
  onAdd,
}: {
  disabled?: boolean;
  onAdd: (input: { url: string; type: "link" | "video_link"; name?: string }) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"link" | "video_link">("link");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const trimmedUrl = url.trim();
    if (!isValidHttpUrl(trimmedUrl)) {
      setError("Enter a valid URL.");
      return;
    }

    setIsAdding(true);
    setError(null);
    try {
      await onAdd({ url: trimmedUrl, type });
      setUrl("");
    } catch (error) {
      setError(getReadableAttachmentError(error, "Attachment save failed."));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <AppInput
          value={url}
          disabled={disabled || isAdding}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          placeholder="https://example.com/reference"
          className="rounded-lg border-[#d8d8d8] bg-white"
        />
        <select
          value={type}
          disabled={disabled || isAdding}
          onChange={(event) => setType(event.target.value as "link" | "video_link")}
          className="h-10 rounded-lg border border-[#d8d8d8] bg-white px-3 text-sm text-[#0a0a0a]"
          aria-label="Attachment link type"
        >
          <option value="link">Link</option>
          <option value="video_link">Video link</option>
        </select>
        <AppButton
          type="button"
          disabled={disabled || isAdding}
          onClick={() => void handleAdd()}
          className="rounded-lg bg-[#0a0a0a] px-4 text-sm font-semibold text-white hover:bg-[#FF7003]"
        >
          {isAdding ? "Adding..." : "Add link"}
        </AppButton>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function AttachmentDropzone({
  disabled,
  onFiles,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
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
      className={`cursor-pointer rounded-lg border border-dashed p-5 text-center transition-colors ${
        isDragging
          ? "border-[#FF7003] bg-orange-50"
          : "border-[#d8d8d8] bg-[#fafafa] hover:border-[#FF7003]/70"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
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
      <p className="mt-2 text-sm font-semibold text-[#0a0a0a]">
        Drop files here or click to upload
      </p>
      <p className="mt-1 text-xs text-[#5f5f5f]">
        Images, PDFs, Markdown, documents, or videos up to 25 MB.
      </p>
    </div>
  );
}

export function AttachmentUploader({
  value,
  onChange,
  disabled,
  ownerRole = "client",
}: {
  value: TDraftAttachment[];
  onChange: Dispatch<SetStateAction<TDraftAttachment[]>>;
  disabled?: boolean;
  ownerRole?: "client" | "freelancer";
}) {
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

    const attachmentId = await createExternalAttachment({
      externalUrl: input.url,
      uploadedByWallet: walletIdentity.walletAddress,
      ...(walletIdentity.walletType ? { uploadedByWalletType: walletIdentity.walletType } : {}),
      ownerRole,
      type: input.type,
      name: input.url,
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
        name: input.url,
        type: input.type,
        externalUrl: input.url,
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

  return (
    <div className="space-y-3 rounded-xl border border-[#e8e8e8] bg-white p-4">
      <div>
        <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">Attachments</p>
        <p className="mt-1 text-sm text-[#5f5f5f]">
          Add reference files or links for the work. Files stay off-chain in Convex storage.
        </p>
      </div>
      <AttachmentDropzone
        disabled={disabled || !walletIdentity.walletAddress}
        onFiles={handleFiles}
      />
      <label
        htmlFor="attachment-protected-preview"
        className="flex items-start gap-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] p-3"
      >
        <input
          id="attachment-protected-preview"
          type="checkbox"
          aria-label="Enable content protection controls"
          checked={useProtectedPreview}
          disabled={disabled}
          onChange={(event) => setUseProtectedPreview(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[#d8d8d8] accent-[#FF7003]"
        />
        <span>
          <span className="block text-sm font-semibold text-[#0a0a0a]">
            Enable content protection controls
          </span>
          <span className="block text-xs text-[#5f5f5f]">
            New uploads use protected preview, download restricted, visible watermarking, and access
            logged.
          </span>
        </span>
      </label>
      <LinkAttachmentInput
        disabled={disabled || !walletIdentity.walletAddress}
        onAdd={addExternalLink}
      />
      <AttachmentList
        attachments={value}
        onRemove={(attachmentId) => void removeAttachment(attachmentId)}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
