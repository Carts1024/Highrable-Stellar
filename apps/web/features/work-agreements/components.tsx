"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { AttachmentPreviewCard } from "@/features/attachments/components";
import {
  getReadableAttachmentError,
  normalizeAttachmentType,
  validateAttachmentFile,
} from "@/features/attachments/lib";
import { formatAmount } from "@/features/dashboard/lib/format";
import { shortenWalletAddress } from "@/features/marketplace/lib/wallet";
import { api } from "@repo/convex-client";
import {
  HighrableV2Bullet,
  HighrableV2IconNotice,
  HighrableV2Metric,
  SectionLabel,
} from "@repo/ui/components/highrable/v2-marketing";
import { V2_BUTTON_SECONDARY_CLASS } from "@repo/ui/components/highrable/v2-theme";
import { RichTextContent } from "@repo/ui/components/ui-customs/rich-text-content";
import { RichTextEditor } from "@repo/ui/components/ui-customs/rich-text-editor";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  GitBranch,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { TAttachmentType } from "@/features/attachments/types";
import type { TConvexDoc, TConvexId } from "@repo/convex-client";
import type { ReactNode } from "react";

type TWalletType = "external_wallet" | "passkey_smart_account";
type TStorageId = string & { __tableName: "_storage" };
type TAgreementType = "client_uploaded" | "highrable_generated";
type TAgreementStatus =
  | "draft"
  | "pending_preview"
  | "ready_to_send"
  | "pending_acceptance"
  | "accepted"
  | "locked"
  | "superseded"
  | "rejected"
  | "cancelled";

type TWorkAgreement = TConvexDoc<"workAgreements"> & {
  contentDelta?: string;
  contentHtml?: string;
  contentMarkdown?: string;
  sourceAttachment?: (TConvexDoc<"attachments"> & { url?: string | null }) | null;
};
type TAgreementRichTextInput = {
  delta: string;
  html: string;
  text: string;
};
type TAgreementVersion = Omit<TConvexDoc<"workAgreementVersions">, "_id"> & {
  _id?: TConvexId<"workAgreementVersions"> | null;
  contentDelta?: string;
  contentHtml?: string;
  contentMarkdown?: string;
};
type TAgreementActionAvailability = {
  editable: boolean;
  sendable: boolean;
  cancellable: boolean;
  rejected: boolean;
  accepted: boolean;
  reviewable: boolean;
};
type TAgreementContext = {
  agreement: TWorkAgreement;
  version?: TAgreementVersion | null;
  label: string;
  agreementHash?: string | null;
  versionNumber: number;
  fallback?: string | null;
} | null;
type TAgreementViewerRole = "client" | "freelancer";

interface IAgreementFreelancerResponsePanelProps {
  agreementId: TConvexId<"workAgreements">;
  walletAddress: string | null | undefined;
  walletType: TWalletType | null | undefined;
  showReviewLink?: boolean;
}

interface IWorkAgreementSetupPanelProps {
  jobId: TConvexId<"jobs">;
  viewerRole: TAgreementViewerRole;
  escrowId?: TConvexId<"escrows">;
}

const AGREEMENT_ACCEPT =
  "application/pdf,text/markdown,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const AGREEMENT_TITLE_MAX_LENGTH = 120;
const AGREEMENT_CONTENT_MAX_LENGTH = 30000;
const REJECTION_REASON_MAX_LENGTH = 1000;
const AGREEMENT_TEMPLATE_NOTICE = {
  title: "Template notice",
  body: "Highrable provides this agreement as a workflow template. For legal-sensitive, regulated, or high-value work, ask a qualified professional to review the terms.",
} as const;

function sanitizeAgreementTitleInput(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, AGREEMENT_TITLE_MAX_LENGTH);
}

function sanitizeRejectionReasonInput(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, REJECTION_REASON_MAX_LENGTH);
}

function getReadableError(error: unknown, fallback: string): string {
  return getReadableAttachmentError(error, fallback);
}

function getAgreementStatusLabel(status?: TAgreementStatus): string {
  const labels: Record<TAgreementStatus, string> = {
    draft: "Draft",
    pending_preview: "Pending preview",
    ready_to_send: "Ready to send",
    pending_acceptance: "Pending acceptance",
    accepted: "Accepted",
    locked: "Locked",
    superseded: "Superseded",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return status ? labels[status] : "No agreement";
}

function getAgreementActionAvailability(agreement: TWorkAgreement): TAgreementActionAvailability {
  const editable = agreement.status === "draft" || agreement.status === "pending_preview";
  const sendable =
    agreement.status === "draft" ||
    agreement.status === "pending_preview" ||
    agreement.status === "ready_to_send";
  const cancellable =
    agreement.status === "draft" ||
    agreement.status === "pending_preview" ||
    agreement.status === "ready_to_send" ||
    agreement.status === "pending_acceptance" ||
    agreement.status === "accepted";

  return {
    editable,
    sendable,
    cancellable,
    rejected: agreement.status === "rejected",
    accepted: agreement.status === "accepted",
    reviewable: agreement.status === "pending_acceptance" && Boolean(agreement.freelancerWallet),
  };
}

function hasClientAgreementActions(agreement: TWorkAgreement): boolean {
  const availability = getAgreementActionAvailability(agreement);
  return (
    availability.rejected ||
    (availability.editable && agreement.agreementType === "highrable_generated") ||
    availability.sendable ||
    availability.accepted ||
    availability.cancellable ||
    availability.reviewable
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPlainTextFromMarkdown(markdown: string | undefined): string {
  return (markdown ?? "")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^-\s+/gm, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function getPlainTextFromHtml(html: string | undefined): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const element = document.createElement("div");
  element.innerHTML = html;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function getAgreementRichTextValue(agreement: TWorkAgreement): TAgreementRichTextInput | undefined {
  if (agreement.contentDelta && agreement.contentHtml) {
    return {
      delta: agreement.contentDelta,
      html: agreement.contentHtml,
      text:
        getPlainTextFromMarkdown(agreement.contentMarkdown) ||
        getPlainTextFromHtml(agreement.contentHtml),
    };
  }

  if (!agreement.contentMarkdown) {
    return undefined;
  }

  const ops: Array<{ insert: string; attributes?: Record<string, unknown> }> = [];
  const htmlParts: string[] = [];
  let activeList = false;

  const closeList = () => {
    if (activeList) {
      htmlParts.push("</ul>");
      activeList = false;
    }
  };

  for (const rawLine of agreement.contentMarkdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      ops.push({ insert: "\n" });
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      const text = line.slice(2).trim();
      ops.push({ insert: text }, { insert: "\n", attributes: { header: 1 } });
      htmlParts.push(`<h1>${escapeHtml(text)}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      const text = line.slice(3).trim();
      ops.push({ insert: text }, { insert: "\n", attributes: { header: 2 } });
      htmlParts.push(`<h2>${escapeHtml(text)}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      const text = line.slice(4).trim();
      ops.push({ insert: text, attributes: { bold: true } }, { insert: "\n" });
      htmlParts.push(`<p><strong>${escapeHtml(text)}</strong></p>`);
      continue;
    }

    if (line.startsWith("- ")) {
      const text = line.slice(2).trim();
      if (!activeList) {
        activeList = true;
        htmlParts.push("<ul>");
      }
      ops.push({ insert: text }, { insert: "\n", attributes: { list: "bullet" } });
      htmlParts.push(`<li>${escapeHtml(text)}</li>`);
      continue;
    }

    closeList();
    ops.push({ insert: line }, { insert: "\n" });
    htmlParts.push(`<p>${escapeHtml(line)}</p>`);
  }

  closeList();

  return {
    delta: JSON.stringify({ ops }),
    html: htmlParts.join(""),
    text: getPlainTextFromMarkdown(agreement.contentMarkdown),
  };
}

export function AgreementStatusBadge({ status }: { status?: TAgreementStatus }) {
  const border =
    status === "accepted" || status === "locked"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50"
      : status === "rejected" || status === "cancelled"
        ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-50"
        : "border-[#d8d8d8] bg-white text-[#0a0a0a] hover:bg-white";
  return (
    <Badge
      className={`rounded-md border px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] uppercase ${border}`}
    >
      {getAgreementStatusLabel(status)}
    </Badge>
  );
}

export function AgreementSourceBadge({ type }: { type?: TAgreementType }) {
  const label =
    type === "client_uploaded"
      ? "Client-uploaded agreement"
      : type === "highrable_generated"
        ? "Generated work agreement"
        : "No agreement";
  return (
    <Badge className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-[#9a3f00] uppercase hover:bg-orange-50">
      {label}
    </Badge>
  );
}

export function AgreementLegalDisclaimer() {
  return (
    <div className="flex items-start justify-between gap-3 border border-[#e8e8e8] bg-white p-3 text-sm">
      <div className="min-w-0">
        <p className="font-mono text-[0.65rem] tracking-[0.08em] text-[#B94A00] uppercase">
          Agreement note
        </p>
        <p className="mt-1 text-[#5f5f5f]">
          Template terms are workflow guidance. Review sensitive terms before sending.
        </p>
      </div>
      <HighrableV2IconNotice
        label="Template notice details"
        message={AGREEMENT_TEMPLATE_NOTICE.body}
        tone="warning"
      />
    </div>
  );
}

export function AgreementHashBadge({ hash }: { readonly hash?: string | null }) {
  if (!hash) {
    return (
      <Badge className="rounded-md border border-[#d8d8d8] bg-white px-2 py-1 font-mono text-[0.65rem] text-[#5f5f5f] uppercase hover:bg-white">
        No hash
      </Badge>
    );
  }
  return (
    <Badge className="max-w-full rounded-md border border-[#d8d8d8] bg-white px-2 py-1 font-mono text-[0.65rem] break-all text-[#0a0a0a] uppercase hover:bg-white">
      SHA-256 {hash.slice(0, 12)}...
    </Badge>
  );
}

function AgreementTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: TAgreementType;
  onChange: (value: TAgreementType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {[
        {
          value: "client_uploaded" as const,
          label: "Upload my own agreement",
          description: "Use a PDF, DOCX, Markdown, or text file stored in Highrable.",
        },
        {
          value: "highrable_generated" as const,
          label: "Use Highrable Work Agreement",
          description: "Generate a workflow template from the job, escrow, and milestone data.",
        },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`border p-4 text-left transition-colors ${
            value === option.value
              ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
              : "border-[#d8d8d8] bg-white text-[#0a0a0a] hover:border-[#FF7003]"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className="block font-mono text-xs tracking-[0.08em] uppercase">
            {option.label}
          </span>
          <span
            className={`mt-2 block text-sm ${
              value === option.value ? "text-white/75" : "text-[#5f5f5f]"
            }`}
          >
            {option.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function ClientUploadedAgreementPicker({
  disabled,
  onUploaded,
}: {
  disabled?: boolean;
  onUploaded: (attachmentId: TConvexId<"attachments">) => void;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const saveUploadedAttachment = useMutation(api.attachments.saveUploadedAttachment);
  const [selectedFile, setSelectedFile] = useState<{
    id: string;
    name: string;
    type: TAttachmentType;
    size: number;
    mimeType?: string;
    status: "uploading" | "ready" | "failed";
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!walletIdentity.walletAddress) {
      setError("Missing wallet identity.");
      return;
    }
    const validationError = validateAttachmentFile(file);
    const type = normalizeAttachmentType(file);
    if (!["pdf", "document", "markdown", "file"].includes(type)) {
      setError("Select a supported agreement file, such as PDF, DOCX, Markdown, or text.");
      return;
    }
    setSelectedFile({
      id: `${Date.now()}`,
      name: file.name,
      type,
      size: file.size,
      ...(file.type ? { mimeType: file.type } : {}),
      status: validationError ? "failed" : "uploading",
      ...(validationError ? { error: validationError } : {}),
    });
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
        ownerRole: "client",
        parentType: "unknown",
        visibility: "private",
        name: file.name,
        size: file.size,
        ...(file.type ? { mimeType: file.type } : {}),
        type,
      });
      setSelectedFile((current) =>
        current ? { ...current, id: attachmentId, status: "ready", error: undefined } : current,
      );
      onUploaded(attachmentId);
      setError(null);
    } catch (uploadError) {
      const message = getReadableError(uploadError, "Agreement upload failed. Please try again.");
      setSelectedFile((current) =>
        current ? { ...current, status: "failed", error: message } : current,
      );
      setError(message);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        aria-label="Agreement file"
        accept={AGREEMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
      />
      <AppButton
        type="button"
        disabled={disabled || !walletIdentity.walletAddress}
        onClick={() => inputRef.current?.click()}
        className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
      >
        <Upload className="mr-2 h-4 w-4" />
        Select agreement file
      </AppButton>
      {selectedFile ? (
        <AttachmentPreviewCard attachment={selectedFile} readOnly />
      ) : (
        <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
          No agreement file selected.
        </p>
      )}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function AgreementPreviewShell({
  agreement,
  children,
}: {
  agreement: TWorkAgreement;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5 border border-[#e8e8e8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8e8e8] pb-4">
        <div>
          <SectionLabel>Agreement Workspace</SectionLabel>
          <h3 className="mt-2 text-xl leading-tight font-semibold text-[#0a0a0a]">
            {agreement.title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#5f5f5f]">
            Review the key terms first, then use the actions below when both parties are ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AgreementSourceBadge type={agreement.agreementType} />
          <AgreementStatusBadge status={agreement.status} />
        </div>
      </div>
      {children}
    </div>
  );
}

function AgreementWorkspaceSection({
  title,
  description,
  children,
  actions,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <section className="space-y-3 border border-[#e8e8e8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">{title}</p>
            {description ? (
              <HighrableV2IconNotice
                label={`${title} details`}
                message={description}
                tone="neutral"
              />
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function AgreementMarkdownPreview({ markdown }: { markdown?: string }) {
  if (!markdown) {
    return (
      <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-white p-4 text-sm text-[#5f5f5f]">
        Agreement preview could not be generated. Please try again.
      </p>
    );
  }

  return (
    <div className="max-h-[560px] space-y-2 overflow-auto border border-[#e8e8e8] bg-white p-4 font-mono text-xs leading-relaxed text-[#1f1f1f]">
      {markdown.split("\n").map((line, index) => {
        const key = `${index}-${line.slice(0, 12)}`;
        if (line.startsWith("# ")) {
          return (
            <h2 key={key} className="pt-2 text-lg font-semibold text-[#0a0a0a]">
              {line.replace(/^# /, "")}
            </h2>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={key} className="pt-4 text-sm font-semibold text-[#0a0a0a]">
              {line.replace(/^## /, "")}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={key} className="pt-3 text-xs font-semibold text-[#0a0a0a]">
              {line.replace(/^### /, "")}
            </h4>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <p key={key} className="pl-3">
              <span className="text-[#FF7003]">-</span> {line.slice(2)}
            </p>
          );
        }
        return line.trim() ? <p key={key}>{line}</p> : <div key={key} className="h-2" />;
      })}
    </div>
  );
}

function AgreementRichTextPreview({ agreement }: { agreement: TWorkAgreement }) {
  if (agreement.contentHtml?.trim()) {
    return (
      <div className="max-h-[560px] overflow-auto border border-[#e8e8e8] bg-white p-4">
        <RichTextContent
          html={agreement.contentHtml}
          fallbackText={getPlainTextFromMarkdown(agreement.contentMarkdown)}
          emptyLabel="Agreement preview could not be generated. Please try again."
          className="text-[#1f1f1f]"
        />
      </div>
    );
  }

  return <AgreementMarkdownPreview markdown={agreement.contentMarkdown} />;
}

function AgreementTermsDisclosure({ agreement }: { agreement: TWorkAgreement }) {
  return (
    <details className="group border border-[#e8e8e8] bg-[#fafafa] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="block font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
            Full terms
          </span>
          <span className="mt-1 block text-sm text-[#5f5f5f]">
            Scope, payment, proof, revisions, cancellation, disputes, IP, and template notes.
          </span>
        </span>
        <span className="font-mono text-xs text-[#B94A00] uppercase group-open:hidden">Show</span>
        <span className="hidden font-mono text-xs text-[#B94A00] uppercase group-open:block">
          Hide
        </span>
      </summary>
      <div className="mt-4">
        <AgreementRichTextPreview agreement={agreement} />
      </div>
    </details>
  );
}

function AgreementSummaryCard({ agreement }: { agreement: TWorkAgreement }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div className="border border-[#e8e8e8] bg-white p-3">
        <dt className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">Payment</dt>
        <dd className="mt-1 font-semibold text-[#0a0a0a]">
          {formatAmount(agreement.paymentAmount)} {agreement.paymentAssetSymbol}
        </dd>
      </div>
      <div className="border border-[#e8e8e8] bg-white p-3">
        <dt className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">Client</dt>
        <dd className="mt-1 font-semibold text-[#0a0a0a]">
          {shortenWalletAddress(agreement.clientWallet)}
        </dd>
      </div>
      <div className="border border-[#e8e8e8] bg-white p-3">
        <dt className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">Freelancer</dt>
        <dd className="mt-1 font-semibold text-[#0a0a0a]">
          {shortenWalletAddress(agreement.freelancerWallet)}
        </dd>
      </div>
    </dl>
  );
}

export function AgreementReferenceCard({
  context,
  emptyMessage = "No agreement version was attached to this record.",
}: {
  readonly context: TAgreementContext | undefined;
  readonly emptyMessage?: string;
}) {
  if (context === undefined) {
    return (
      <section className="border border-[#e8e8e8] bg-white p-4 text-sm text-[#5f5f5f]">
        Loading agreement context...
      </section>
    );
  }
  if (!context) {
    return (
      <section className="border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
        <SectionLabel>Agreement</SectionLabel>
        <p className="mt-2">{emptyMessage}</p>
      </section>
    );
  }

  const agreement = context.agreement;
  const version = context.version;
  return (
    <section className="space-y-4 border border-[#e8e8e8] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Agreement</SectionLabel>
          <h3 className="mt-2 text-base font-semibold text-[#0a0a0a]">{context.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#5f5f5f]">
            The agreed payment, deadline, and revision terms linked to this receipt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AgreementStatusBadge status={version?.status ?? agreement.status} />
        </div>
      </div>
      <dl className="grid gap-3 border-t border-[#e8e8e8] pt-4 text-sm">
        <div className="border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Payment</dt>
          <dd className="mt-1 text-[#0a0a0a]">
            {formatAmount(version?.paymentAmount ?? agreement.paymentAmount)}{" "}
            {version?.paymentAssetSymbol ?? agreement.paymentAssetSymbol}
          </dd>
        </div>
        <div className="border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">
            Revisions
          </dt>
          <dd className="mt-1 text-[#0a0a0a]">
            {version?.revisionPolicy ?? agreement.revisionPolicy ?? "Not specified"}
            {version?.revisionLimit !== undefined || agreement.revisionLimit !== undefined
              ? ` (limit ${version?.revisionLimit ?? agreement.revisionLimit ?? "none"})`
              : ""}
          </dd>
        </div>
        <div className="border border-[#e8e8e8] bg-[#fafafa] p-3">
          <dt className="font-mono text-xs tracking-[0.06em] text-[#7f7f7f] uppercase">Deadline</dt>
          <dd className="mt-1 text-[#0a0a0a]">
            {(version?.deadlineAt ?? agreement.deadlineAt)
              ? new Date(version?.deadlineAt ?? agreement.deadlineAt ?? 0).toLocaleString()
              : "Milestone deadlines apply if configured."}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#e8e8e8] pt-3">
        <HighrableV2IconNotice
          label="Agreement access details"
          message={`Agreement v${context.versionNumber} is the version Highrable uses for payment, revisions, deadlines, and protected delivery access.`}
          tone="neutral"
        />
        <p className="text-xs leading-relaxed text-[#7f7f7f]">
          Agreement v{context.versionNumber} is linked to this receipt.
        </p>
      </div>
      {context.fallback ? <p className="text-sm text-amber-700">{context.fallback}</p> : null}
    </section>
  );
}

export function AgreementMismatchWarning({
  agreementDeadlineAt,
  productDeadlineAt,
}: {
  readonly agreementDeadlineAt?: number | null;
  readonly productDeadlineAt?: number | null;
}) {
  if (!agreementDeadlineAt || !productDeadlineAt || agreementDeadlineAt === productDeadlineAt) {
    return null;
  }
  return (
    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Product deadline differs from the locked agreement deadline. Update deadlines only through
        the agreement-aware deadline workflow.
      </p>
    </div>
  );
}

export function AgreementAmendmentBanner({
  agreementId,
}: {
  readonly agreementId?: TConvexId<"workAgreements">;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-[#e8e8e8] bg-[#fafafa] p-4 text-sm">
      <div className="flex items-center gap-2">
        <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">Locked terms</p>
        <HighrableV2IconNotice
          label="Locked terms details"
          message="Locked terms stay fixed for escrow and dispute review. Any future term changes will require both parties to approve a new version."
          tone="neutral"
        />
      </div>
      {agreementId ? (
        <Badge className="rounded-none border border-[#d8d8d8] bg-white px-2 py-1 font-mono text-[0.65rem] text-[#5f5f5f] uppercase hover:bg-white">
          Record {shortenWalletAddress(agreementId)}
        </Badge>
      ) : null}
    </div>
  );
}

export function AgreementVersionCard({ version }: { readonly version: TAgreementVersion }) {
  return (
    <article className="border-b border-[#e8e8e8] p-4 transition-colors last:border-b-0 hover:bg-[#fafafa]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-base font-semibold text-[#0a0a0a]">
              Version {version.versionNumber}
            </p>
            <span className="font-mono text-[0.65rem] tracking-[0.08em] text-[#7f7f7f] uppercase">
              {version.paymentAssetSymbol}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-[#5f5f5f]">
            <span className="inline-flex items-center gap-2">
              <HighrableV2Bullet tone="muted" />
              Created {new Date(version.createdAt).toLocaleString()}
            </span>
            {version.agreementHash ? (
              <span className="inline-flex items-center gap-2 break-all">
                <HighrableV2Bullet tone="muted" />
                SHA-256 {version.agreementHash.slice(0, 12)}...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <HighrableV2Bullet tone="muted" />
                No hash
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <AgreementStatusBadge status={version.status} />
        </div>
      </div>
    </article>
  );
}

export function AgreementVersionTimeline({
  agreementId,
}: {
  readonly agreementId: TConvexId<"workAgreements">;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const versions = useQuery(
    api.work_agreements.getAgreementVersions,
    walletIdentity.walletAddress
      ? { agreementId, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  ) as TAgreementVersion[] | undefined;

  if (!walletIdentity.walletAddress || !versions || versions.length === 0) return null;
  return (
    <section className="border border-[#e8e8e8] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e8e8e8] p-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#FF7003]" />
          <h3 className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
            Agreement Version History
          </h3>
        </div>
        <span className="font-mono text-[0.65rem] tracking-[0.08em] text-[#B94A00] uppercase">
          {versions.length} {versions.length === 1 ? "record" : "records"}
        </span>
      </div>
      <div>
        {versions.map((version) => (
          <AgreementVersionCard
            key={version._id ?? `${version.agreementId}-${version.versionNumber}`}
            version={version}
          />
        ))}
      </div>
    </section>
  );
}

export function AgreementChangeSummary({
  previousVersion,
  proposedVersion,
}: {
  readonly previousVersion?: TAgreementVersion | null;
  readonly proposedVersion?: TAgreementVersion | null;
}) {
  if (!previousVersion || !proposedVersion) {
    return (
      <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-3 text-sm text-[#5f5f5f]">
        No amendment comparison is available yet.
      </p>
    );
  }

  const changes = [
    previousVersion.deadlineAt !== proposedVersion.deadlineAt ? "Deadline terms changed" : null,
    previousVersion.revisionPolicy !== proposedVersion.revisionPolicy
      ? "Revision policy changed"
      : null,
    previousVersion.revisionLimit !== proposedVersion.revisionLimit
      ? "Revision limit changed"
      : null,
    previousVersion.paymentAmount !== proposedVersion.paymentAmount ||
    previousVersion.paymentAssetContractId !== proposedVersion.paymentAssetContractId
      ? "Payment terms changed"
      : null,
    previousVersion.contentDelta !== proposedVersion.contentDelta ||
    previousVersion.contentHtml !== proposedVersion.contentHtml ||
    previousVersion.contentMarkdown !== proposedVersion.contentMarkdown
      ? "Agreement text changed"
      : null,
  ].filter(Boolean);

  return (
    <ul className="space-y-2 rounded-lg border border-[#d8d8d8] bg-white p-3 text-sm text-[#0a0a0a]">
      {(changes.length > 0 ? changes : ["No section-level changes detected."]).map((change) => (
        <li key={change}>{change}</li>
      ))}
    </ul>
  );
}

export function AgreementVersionCompare({
  previousVersion,
  proposedVersion,
}: {
  readonly previousVersion?: TAgreementVersion | null;
  readonly proposedVersion?: TAgreementVersion | null;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-[#d8d8d8] bg-[#fafafa] p-4">
      <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
        Version Compare
      </p>
      <AgreementChangeSummary previousVersion={previousVersion} proposedVersion={proposedVersion} />
    </section>
  );
}

export function AgreementAmendmentDialog() {
  return <AgreementAmendmentBanner />;
}

export function AgreementAmendmentReview() {
  return <AgreementAmendmentBanner />;
}

export function AgreementAuditTimeline({
  agreementId,
}: {
  readonly agreementId: TConvexId<"workAgreements">;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const events = useQuery(
    api.work_agreements.getAgreementAuditTimeline,
    walletIdentity.walletAddress
      ? { agreementId, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  );

  if (!walletIdentity.walletAddress || !events || events.length === 0) return null;
  return (
    <section className="border border-[#e8e8e8] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e8e8e8] p-4">
        <h3 className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
          Agreement Audit Timeline
        </h3>
        <span className="font-mono text-[0.65rem] tracking-[0.08em] text-[#B94A00] uppercase">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>
      <ol>
        {events.map((event) => (
          <li
            key={event._id}
            className="border-b border-[#e8e8e8] p-4 text-sm transition-colors last:border-b-0 hover:bg-[#fafafa]"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-[#0a0a0a]">{event.message}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-[#5f5f5f]">
                  <span className="inline-flex items-center gap-2">
                    <HighrableV2Bullet tone="muted" />
                    {event.type.replace(/_/g, " ")}
                  </span>
                  {event.newVersion ? (
                    <span className="inline-flex items-center gap-2">
                      <HighrableV2Bullet tone="muted" />
                      Version {event.newVersion}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-[#7f7f7f] lg:text-right">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AgreementExportButton({ agreement }: { readonly agreement: TWorkAgreement }) {
  const walletIdentity = useHighrableWalletIdentity();
  const recordExported = useMutation(api.work_agreements.recordAgreementExported);
  const canExport = agreement.status === "accepted" || agreement.status === "locked";

  const exportMarkdown = async () => {
    if (!walletIdentity.walletAddress || !walletIdentity.walletType || !canExport) return;
    await recordExported({
      agreementId: agreement._id,
      walletAddress: walletIdentity.walletAddress,
      walletType: walletIdentity.walletType,
    });
    const metadata = [
      `# ${agreement.title}`,
      "",
      `Agreement version: ${agreement.version}`,
      `Agreement hash: ${agreement.agreementHash ?? "Not generated"}`,
      `Client wallet: ${agreement.clientWallet}`,
      `Client wallet type: ${agreement.clientWalletType}`,
      `Freelancer wallet: ${agreement.freelancerWallet ?? "Not selected"}`,
      `Freelancer wallet type: ${agreement.freelancerWalletType ?? "Not recorded"}`,
      `Accepted at: ${
        agreement.acceptedByFreelancerAt
          ? new Date(agreement.acceptedByFreelancerAt).toISOString()
          : "Not accepted"
      }`,
      `Locked at: ${agreement.lockedAt ? new Date(agreement.lockedAt).toISOString() : "Not locked"}`,
      "",
      "## Disclaimer",
      "Highrable provides this as a workflow template, not legal advice.",
      "",
    ];
    const exportBody = agreement.contentHtml
      ? [
          "<!doctype html>",
          '<html lang="en">',
          "<head>",
          '<meta charset="utf-8" />',
          `<title>${escapeHtml(agreement.title)}</title>`,
          "</head>",
          "<body>",
          `<pre>${escapeHtml(metadata.join("\n"))}</pre>`,
          agreement.contentHtml,
          "</body>",
          "</html>",
        ].join("\n")
      : [
          ...metadata,
          agreement.contentMarkdown ??
            "Client-uploaded agreement content is stored as an attachment.",
        ].join("\n");
    const blob = new Blob([exportBody], {
      type: agreement.contentHtml ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${agreement.agreementNumber}-v${agreement.version}.${
      agreement.contentHtml ? "html" : "md"
    }`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!canExport) return null;
  return (
    <AppButton type="button" variant="secondary" onClick={() => void exportMarkdown()}>
      <Download className="mr-2 h-4 w-4" />
      Export Agreement
    </AppButton>
  );
}

function AgreementActions({
  agreement,
  disabled,
  canRevise = true,
  onRegenerate,
  onSend,
  onLock,
  onCancel,
  onRevise,
  onAbandon,
}: {
  agreement: TWorkAgreement;
  disabled?: boolean;
  canRevise?: boolean;
  onRegenerate: () => Promise<void>;
  onSend: () => Promise<void>;
  onLock: () => Promise<void>;
  onCancel: () => Promise<void>;
  onRevise: () => Promise<void>;
  onAbandon: () => Promise<void>;
}) {
  const availability = getAgreementActionAvailability(agreement);

  return (
    <div className="flex flex-wrap gap-2">
      {availability.rejected ? (
        <>
          <AppButton
            type="button"
            disabled={disabled || !canRevise}
            onClick={() => void onRevise()}
            className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Revise agreement
          </AppButton>
          <AppButton
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => void onAbandon()}
            className="rounded-none"
          >
            <X className="mr-2 h-4 w-4" />
            Abandon / choose another freelancer
          </AppButton>
        </>
      ) : null}
      {availability.editable && agreement.agreementType === "highrable_generated" ? (
        <AppButton
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => void onRegenerate()}
          className="rounded-none"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Regenerate
        </AppButton>
      ) : null}
      {availability.sendable ? (
        <AppButton
          type="button"
          disabled={disabled}
          onClick={() => void onSend()}
          className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
        >
          <Send className="mr-2 h-4 w-4" />
          Send agreement
        </AppButton>
      ) : null}
      {availability.accepted ? (
        <AppButton
          type="button"
          disabled={disabled}
          onClick={() => void onLock()}
          className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
        >
          <Lock className="mr-2 h-4 w-4" />
          Lock agreement
        </AppButton>
      ) : null}
      {availability.cancellable ? (
        <AppButton
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => void onCancel()}
          className="rounded-none"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </AppButton>
      ) : null}
      {availability.reviewable ? (
        <AppButton asChild type="button" variant="secondary" className="rounded-none">
          <Link href={`/work-agreements/${agreement._id}/review`}>Review link</Link>
        </AppButton>
      ) : null}
    </div>
  );
}

function AgreementFreelancerResponsePanel({
  agreementId,
  walletAddress,
  walletType,
  showReviewLink = false,
}: IAgreementFreelancerResponsePanelProps) {
  const acceptAgreement = useMutation(api.work_agreements.acceptWorkAgreement);
  const rejectAgreement = useMutation(api.work_agreements.rejectWorkAgreement);
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "accept" | "reject") => {
    if (!walletAddress || !walletType) {
      setError("Missing wallet identity.");
      return;
    }
    if (action === "accept" && !accepted) {
      setError("Review and accept the agreement terms before continuing.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (action === "accept") {
        const result = await acceptAgreement({ agreementId, walletAddress, walletType });
        setMessage(`Agreement accepted. Hash: ${result.agreementHash}`);
      } else {
        const rejectionReason = sanitizeRejectionReasonInput(reason);
        await rejectAgreement({
          agreementId,
          walletAddress,
          walletType,
          ...(rejectionReason ? { rejectionReason } : {}),
        });
        setMessage("Agreement rejected.");
      }
    } catch (actionError) {
      setError(getReadableError(actionError, "Agreement action failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 border border-[#d8d8d8] p-4">
      <label htmlFor="accept-work-agreement" className="flex gap-3 text-sm text-[#0a0a0a]">
        <Checkbox
          id="accept-work-agreement"
          checked={accepted}
          onCheckedChange={(value) => setAccepted(value === true)}
        />
        <span>
          I have reviewed the work agreement and accept the scope, payment terms, deadlines,
          revision policy, cancellation rules, dispute process, and Highrable workflow terms.
        </span>
      </label>
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value.slice(0, REJECTION_REASON_MAX_LENGTH))}
        placeholder="Optional rejection reason"
        maxLength={REJECTION_REASON_MAX_LENGTH}
        className="rounded-none border-[#d8d8d8]"
      />
      <div className="flex flex-wrap gap-2">
        {showReviewLink ? (
          <AppButton asChild type="button" variant="secondary" className="rounded-none">
            <Link href={`/work-agreements/${agreementId}/review`}>Review agreement</Link>
          </AppButton>
        ) : null}
        <AppButton
          type="button"
          disabled={isSubmitting || !accepted}
          onClick={() => void run("accept")}
          className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Accept agreement
        </AppButton>
        <AppButton
          type="button"
          disabled={isSubmitting}
          variant="secondary"
          onClick={() => void run("reject")}
          className="rounded-none"
        >
          <X className="mr-2 h-4 w-4" />
          Reject
        </AppButton>
      </div>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function FreelancerAgreementReview({
  agreementId,
}: {
  agreementId: TConvexId<"workAgreements">;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const agreement = useQuery(
    api.work_agreements.getAgreementForReview,
    walletIdentity.walletAddress
      ? { agreementId, viewerWallet: walletIdentity.walletAddress }
      : "skip",
  ) as TWorkAgreement | null | undefined;
  const recordViewed = useMutation(api.work_agreements.recordAgreementViewed);

  const walletAddress = walletIdentity.walletAddress;
  const walletType = walletIdentity.walletType as TWalletType | null;

  if (!walletAddress) {
    return (
      <section className="border border-[#d8d8d8] bg-white p-6">
        <p className="text-sm text-[#5f5f5f]">
          Connect the selected freelancer wallet to review this agreement.
        </p>
      </section>
    );
  }

  if (agreement === undefined)
    return <p className="text-sm text-[#5f5f5f]">Loading agreement...</p>;
  if (!agreement) return <p className="text-sm text-[#5f5f5f]">Agreement not found.</p>;

  const viewOnce = () => {
    if (!walletAddress || !walletType) return;
    void recordViewed({ agreementId, walletAddress, walletType });
  };

  return (
    <section className="space-y-5 border border-[#d8d8d8] bg-white p-6" onMouseEnter={viewOnce}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
            Work agreement review
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#0a0a0a]">{agreement.title}</h1>
        </div>
        <div className="flex gap-2">
          <AgreementSourceBadge type={agreement.agreementType} />
          <AgreementStatusBadge status={agreement.status} />
        </div>
      </div>
      <AgreementSummaryCard agreement={agreement} />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="border border-[#e8e8e8] p-3">
          <dt className="font-mono text-xs text-[#7f7f7f] uppercase">Revision policy</dt>
          <dd className="mt-1 text-[#0a0a0a]">
            {agreement.revisionPolicy ?? "Not specified"}{" "}
            {agreement.revisionLimit !== undefined
              ? `(limit ${agreement.revisionLimit ?? "none"})`
              : ""}
          </dd>
        </div>
        <div className="border border-[#e8e8e8] p-3">
          <dt className="font-mono text-xs text-[#7f7f7f] uppercase">Deadline</dt>
          <dd className="mt-1 text-[#0a0a0a]">
            {agreement.deadlineAt
              ? new Date(agreement.deadlineAt).toLocaleString()
              : "Milestone deadlines apply if configured."}
          </dd>
        </div>
        <div className="border border-[#e8e8e8] p-3">
          <dt className="font-mono text-xs text-[#7f7f7f] uppercase">Cancellation</dt>
          <dd className="mt-1 text-[#0a0a0a]">
            Cancellation follows Highrable workflow rules, funding state, overdue state, and dispute
            outcome where applicable.
          </dd>
        </div>
        <div className="border border-[#e8e8e8] p-3">
          <dt className="font-mono text-xs text-[#7f7f7f] uppercase">Disputes and protection</dt>
          <dd className="mt-1 text-[#0a0a0a]">
            Evidence can include proof, revisions, deadlines, chat, and attachments. Pre-settlement
            previews may be protected and access-logged.
          </dd>
        </div>
      </dl>
      {agreement.agreementType === "client_uploaded" ? (
        <div className="space-y-3">
          <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            I understand this agreement was uploaded by the client. Highrable stores it as part of
            the work record but does not provide legal advice.
          </div>
          {agreement.sourceAttachment ? (
            <AttachmentPreviewCard attachment={agreement.sourceAttachment} readOnly />
          ) : null}
        </div>
      ) : (
        <>
          <AgreementLegalDisclaimer />
          <AgreementRichTextPreview agreement={agreement} />
        </>
      )}
      {agreement.agreementHash ? (
        <p className="border border-[#e8e8e8] bg-[#fafafa] p-3 font-mono text-xs break-all text-[#0a0a0a]">
          SHA-256: {agreement.agreementHash}
        </p>
      ) : null}
      <AgreementAmendmentBanner agreementId={agreement._id} />
      <AgreementVersionTimeline agreementId={agreement._id} />
      <AgreementAuditTimeline agreementId={agreement._id} />
      {agreement.status === "pending_acceptance" ? (
        <AgreementFreelancerResponsePanel
          agreementId={agreement._id}
          walletAddress={walletAddress}
          walletType={walletType}
        />
      ) : null}
    </section>
  );
}

export function WorkAgreementSetupPanel({ jobId, viewerRole }: IWorkAgreementSetupPanelProps) {
  const walletIdentity = useHighrableWalletIdentity();
  const agreement = useQuery(
    api.work_agreements.getWorkAgreementByJob,
    walletIdentity.walletAddress ? { jobId, viewerWallet: walletIdentity.walletAddress } : "skip",
  ) as TWorkAgreement | null | undefined;
  const generateAgreement = useMutation(api.work_agreements.generateHighrableWorkAgreement);
  const createUploadedAgreement = useMutation(api.work_agreements.createClientUploadedAgreement);
  const regenerateAgreement = useMutation(api.work_agreements.regenerateHighrableWorkAgreement);
  const updateAgreementDraft = useMutation(api.work_agreements.updateWorkAgreementDraft);
  const sendAgreement = useMutation(api.work_agreements.sendAgreementForAcceptance);
  const lockAgreement = useMutation(api.work_agreements.lockWorkAgreement);
  const cancelDraft = useMutation(api.work_agreements.cancelWorkAgreementDraft);
  const cancelPending = useMutation(api.work_agreements.cancelPendingAgreement);
  const reviseRejectedAgreement = useMutation(api.work_agreements.reviseRejectedAgreement);
  const abandonRejectedAgreement = useMutation(api.work_agreements.abandonRejectedAgreement);

  const [agreementType, setAgreementType] = useState<TAgreementType>("highrable_generated");
  const [uploadedAttachmentId, setUploadedAttachmentId] = useState<TConvexId<"attachments"> | null>(
    null,
  );
  const [revisedAttachmentId, setRevisedAttachmentId] = useState<TConvexId<"attachments"> | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [isEditingAgreementContent, setIsEditingAgreementContent] = useState(false);
  const [agreementContentDraft, setAgreementContentDraft] = useState<
    TAgreementRichTextInput | undefined
  >(undefined);
  const [isAgreementWorkspaceOpen, setIsAgreementWorkspaceOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = walletIdentity.walletAddress;
  const walletType = walletIdentity.walletType as TWalletType | null;
  const isClientViewer = viewerRole === "client";
  const isFreelancerViewer = viewerRole === "freelancer";
  const canSubmit = Boolean(isClientViewer && walletAddress && walletType);

  useEffect(() => {
    setRevisedAttachmentId(null);
  }, [agreement?._id, agreement?.status]);

  useEffect(() => {
    setIsEditingAgreementContent(false);
    setAgreementContentDraft(agreement ? getAgreementRichTextValue(agreement) : undefined);
  }, [agreement?._id, agreement?.contentDelta, agreement?.contentHtml, agreement?.contentMarkdown]);

  const createAgreement = async () => {
    if (!walletAddress || !walletType) {
      setError("Missing wallet identity.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const sanitizedTitle = sanitizeAgreementTitleInput(title);
      if (agreementType === "client_uploaded") {
        if (!uploadedAttachmentId) {
          throw new Error(
            "Select a supported agreement file, such as PDF, DOCX, Markdown, or text.",
          );
        }
        await createUploadedAgreement({
          jobId,
          walletAddress,
          walletType,
          sourceAttachmentId: uploadedAttachmentId,
          ...(sanitizedTitle ? { title: sanitizedTitle } : {}),
        });
      } else {
        await generateAgreement({
          jobId,
          walletAddress,
          walletType,
          ...(sanitizedTitle ? { title: sanitizedTitle } : {}),
        });
      }
    } catch (createError) {
      setError(getReadableError(createError, "Agreement could not be created."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const runAgreementAction = async (action: () => Promise<unknown>, fallback: string) => {
    if (!walletAddress || !walletType || !agreement) {
      setError("Missing wallet identity.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(getReadableError(actionError, fallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginAgreementContentEdit = () => {
    if (!agreement || !isClientViewer) return;
    setAgreementContentDraft(getAgreementRichTextValue(agreement));
    setIsEditingAgreementContent(true);
    setError(null);
  };

  const cancelAgreementContentEdit = () => {
    if (!agreement) return;
    setAgreementContentDraft(getAgreementRichTextValue(agreement));
    setIsEditingAgreementContent(false);
    setError(null);
  };

  const saveAgreementContent = async () => {
    if (!walletAddress || !walletType || !agreement || !isClientViewer) {
      setError("Missing wallet identity.");
      return;
    }
    if (!agreementContentDraft) {
      setError("Agreement content cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await updateAgreementDraft({
        agreementId: agreement._id,
        walletAddress,
        title: agreement.title,
        content: agreementContentDraft,
      });
      setIsEditingAgreementContent(false);
    } catch (saveError) {
      setError(getReadableError(saveError, "Agreement content could not be saved."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEditGeneratedAgreement =
    agreement?.agreementType === "highrable_generated" &&
    isClientViewer &&
    (agreement.status === "draft" ||
      agreement.status === "pending_preview" ||
      agreement.status === "ready_to_send");

  return (
    <section className="space-y-4 border border-[#e8e8e8] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Work Agreement</SectionLabel>
          <h2 className="mt-1 text-lg font-semibold text-[#0a0a0a]">Agreement</h2>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            {isClientViewer
              ? "Create, send, revise, and lock agreement terms from a focused workspace."
              : "Review and respond to agreement terms from a focused workspace."}
          </p>
        </div>
        {agreement ? (
          <div className="flex flex-wrap gap-2">
            <AgreementSourceBadge type={agreement.agreementType} />
            <AgreementStatusBadge status={agreement.status} />
          </div>
        ) : (
          <AgreementStatusBadge />
        )}
      </div>

      {!walletAddress ? (
        <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
          Connect the client or selected freelancer wallet to view agreement details.
        </p>
      ) : null}

      {agreement === undefined && walletAddress ? (
        <p className="text-sm text-gray-500">Loading agreement...</p>
      ) : null}

      {agreement ? (
        <>
          <div className="grid gap-5 border-y border-[#e8e8e8] py-5 sm:grid-cols-3">
            <HighrableV2Metric label="Status" value={getAgreementStatusLabel(agreement.status)} />
            <HighrableV2Metric
              label="Source"
              value={agreement.agreementType === "client_uploaded" ? "Client upload" : "Generated"}
            />
            <HighrableV2Metric label="Version" value={`v${agreement.version}`} />
          </div>
          <Dialog open={isAgreementWorkspaceOpen} onOpenChange={setIsAgreementWorkspaceOpen}>
            <DialogTrigger asChild>
              <AppButton
                type="button"
                variant="outline"
                className={`${V2_BUTTON_SECONDARY_CLASS} rounded-none`}
              >
                Open agreement workspace
              </AppButton>
            </DialogTrigger>
            <DialogContent className="max-h-[88svh] overflow-y-auto rounded-none sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>{agreement.title}</DialogTitle>
                <DialogDescription>
                  A focused workspace for terms, approval, version history, and audit trail.
                </DialogDescription>
              </DialogHeader>
              <AgreementPreviewShell agreement={agreement}>
                <AgreementWorkspaceSection
                  title="Snapshot"
                  description="The terms both parties will rely on for payment, review, and dispute context."
                >
                  <AgreementSummaryCard agreement={agreement} />
                </AgreementWorkspaceSection>

                <AgreementWorkspaceSection
                  title="Agreement terms"
                  description={
                    agreement.agreementType === "client_uploaded"
                      ? "Review the client-uploaded source file attached to this work record."
                      : "Review the generated template before sending it to the freelancer."
                  }
                  actions={
                    !isEditingAgreementContent && canEditGeneratedAgreement ? (
                      <AppButton
                        type="button"
                        variant="secondary"
                        disabled={isSubmitting}
                        onClick={beginAgreementContentEdit}
                        className="rounded-none"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Edit agreement
                      </AppButton>
                    ) : null
                  }
                >
                  {agreement.agreementType === "client_uploaded" ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 border border-[#e8e8e8] bg-[#fafafa] p-3 text-sm">
                        <p className="text-[#5f5f5f]">
                          Highrable stores this file with the work record. The client is responsible
                          for the agreement text they upload.
                        </p>
                        <HighrableV2IconNotice
                          label="Uploaded agreement notice"
                          message="Highrable stores uploaded agreements as workflow evidence and does not review them as legal advice."
                          tone="neutral"
                        />
                      </div>
                      {agreement.sourceAttachment ? (
                        <AttachmentPreviewCard attachment={agreement.sourceAttachment} readOnly />
                      ) : (
                        <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-white p-4 text-sm text-[#5f5f5f]">
                          Uploaded agreement metadata is not available.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AgreementLegalDisclaimer />
                      {isEditingAgreementContent ? (
                        <div className="space-y-3">
                          <RichTextEditor
                            value={agreementContentDraft}
                            onChange={setAgreementContentDraft}
                            placeholder="Edit the generated agreement..."
                            disabled={isSubmitting}
                            maxLength={AGREEMENT_CONTENT_MAX_LENGTH}
                            aria-label="Generated agreement content"
                            editorClassName="[&_.ql-container]:max-h-[min(36rem,58svh)] [&_.ql-container]:overflow-hidden [&_.ql-editor]:max-h-[min(36rem,58svh)] [&_.ql-editor]:overflow-y-auto"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-[#7f7f7f]">
                              {agreementContentDraft?.text.length ?? 0}/
                              {AGREEMENT_CONTENT_MAX_LENGTH}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <AppButton
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => void saveAgreementContent()}
                                className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
                              >
                                {isSubmitting ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="mr-2 h-4 w-4" />
                                )}
                                Save changes
                              </AppButton>
                              <AppButton
                                type="button"
                                variant="secondary"
                                disabled={isSubmitting}
                                onClick={cancelAgreementContentEdit}
                                className="rounded-none"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                              </AppButton>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <AgreementTermsDisclosure agreement={agreement} />
                      )}
                    </div>
                  )}
                </AgreementWorkspaceSection>

                {agreement.status === "rejected" ? (
                  <AgreementWorkspaceSection
                    title="Freelancer response"
                    description="Use the feedback to revise the agreement or choose another freelancer."
                  >
                    <div className="space-y-3 border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                      <p>
                        {agreement.rejectionReason
                          ? agreement.rejectionReason
                          : "No rejection reason was provided."}
                      </p>
                      {isClientViewer && agreement.agreementType === "client_uploaded" ? (
                        <div className="space-y-2">
                          <p className="text-[#5f1f1f]">
                            Upload a revised agreement file before creating the replacement
                            agreement.
                          </p>
                          <ClientUploadedAgreementPicker
                            disabled={isSubmitting}
                            onUploaded={setRevisedAttachmentId}
                          />
                        </div>
                      ) : null}
                    </div>
                  </AgreementWorkspaceSection>
                ) : null}

                {isClientViewer && hasClientAgreementActions(agreement) ? (
                  <div className="border border-[#e8e8e8] bg-white p-4">
                    <AgreementActions
                      agreement={agreement}
                      disabled={isSubmitting || isEditingAgreementContent}
                      canRevise={
                        agreement.agreementType !== "client_uploaded" ||
                        Boolean(revisedAttachmentId)
                      }
                      onRegenerate={() =>
                        runAgreementAction(
                          () =>
                            regenerateAgreement({
                              agreementId: agreement._id,
                              walletAddress: walletAddress!,
                              walletType: walletType!,
                            }),
                          "Agreement could not be regenerated.",
                        )
                      }
                      onSend={() =>
                        runAgreementAction(
                          () =>
                            sendAgreement({
                              agreementId: agreement._id,
                              walletAddress: walletAddress!,
                              walletType: walletType!,
                            }),
                          "Agreement could not be sent.",
                        )
                      }
                      onLock={() =>
                        runAgreementAction(
                          () =>
                            lockAgreement({
                              agreementId: agreement._id,
                              walletAddress: walletAddress!,
                              walletType: walletType!,
                              lockedBy: "client",
                              lockReason: "manual_lock",
                            }),
                          "Agreement could not be locked.",
                        )
                      }
                      onCancel={() =>
                        runAgreementAction(() => {
                          const args = {
                            agreementId: agreement._id,
                            walletAddress: walletAddress!,
                            walletType: walletType!,
                          };
                          return agreement.status === "draft" ||
                            agreement.status === "pending_preview"
                            ? cancelDraft(args)
                            : cancelPending(args);
                        }, "Agreement could not be cancelled.")
                      }
                      onRevise={() =>
                        runAgreementAction(() => {
                          if (
                            agreement.agreementType === "client_uploaded" &&
                            !revisedAttachmentId
                          ) {
                            throw new Error("Upload a revised agreement file before continuing.");
                          }
                          return reviseRejectedAgreement({
                            agreementId: agreement._id,
                            walletAddress: walletAddress!,
                            walletType: walletType!,
                            ...(agreement.agreementType === "client_uploaded" && revisedAttachmentId
                              ? { sourceAttachmentId: revisedAttachmentId }
                              : {}),
                          });
                        }, "Agreement could not be revised.")
                      }
                      onAbandon={() =>
                        runAgreementAction(
                          () =>
                            abandonRejectedAgreement({
                              agreementId: agreement._id,
                              walletAddress: walletAddress!,
                              walletType: walletType!,
                              statusReason: "Client abandoned the rejected agreement.",
                            }),
                          "Agreement could not be abandoned.",
                        )
                      }
                    />
                  </div>
                ) : null}
                {isFreelancerViewer && agreement.status === "pending_acceptance" ? (
                  <AgreementWorkspaceSection
                    title="Your response"
                    description="Accept when the scope, payment, deadlines, and revision terms look right."
                  >
                    <AgreementFreelancerResponsePanel
                      agreementId={agreement._id}
                      walletAddress={walletAddress}
                      walletType={walletType}
                      showReviewLink
                    />
                  </AgreementWorkspaceSection>
                ) : null}
                <details className="group border border-[#e8e8e8] bg-[#fafafa] p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span>
                      <span className="block font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
                        More details
                      </span>
                      <span className="mt-1 block text-sm text-[#5f5f5f]">
                        Versions, audit trail, export, and locked-term guidance.
                      </span>
                    </span>
                    <span className="font-mono text-xs text-[#B94A00] uppercase group-open:hidden">
                      Show
                    </span>
                    <span className="hidden font-mono text-xs text-[#B94A00] uppercase group-open:block">
                      Hide
                    </span>
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <AgreementExportButton agreement={agreement} />
                    </div>
                    <AgreementAmendmentBanner agreementId={agreement._id} />
                    <AgreementVersionTimeline agreementId={agreement._id} />
                    <AgreementAuditTimeline agreementId={agreement._id} />
                  </div>
                </details>
              </AgreementPreviewShell>
            </DialogContent>
          </Dialog>
        </>
      ) : walletAddress && isClientViewer ? (
        <div className="space-y-4">
          <AgreementTypeSelector
            value={agreementType}
            onChange={setAgreementType}
            disabled={isSubmitting}
          />
          <div>
            <label
              htmlFor="agreement-title"
              className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase"
            >
              Draft title
            </label>
            <AppInput
              id="agreement-title"
              value={title}
              disabled={isSubmitting}
              maxLength={AGREEMENT_TITLE_MAX_LENGTH}
              onChange={(event) =>
                setTitle(event.target.value.slice(0, AGREEMENT_TITLE_MAX_LENGTH))
              }
              placeholder="Highrable Work Agreement"
              className="mt-2 rounded-none border-[#d8d8d8] bg-white"
            />
          </div>
          {agreementType === "client_uploaded" ? (
            <ClientUploadedAgreementPicker
              disabled={isSubmitting}
              onUploaded={setUploadedAttachmentId}
            />
          ) : (
            <AgreementLegalDisclaimer />
          )}
          <AppButton
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={() => void createAgreement()}
            className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {agreementType === "client_uploaded" ? "Create uploaded agreement" : "Generate draft"}
          </AppButton>
        </div>
      ) : walletAddress && isFreelancerViewer ? (
        <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
          The client has not sent a work agreement yet.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
