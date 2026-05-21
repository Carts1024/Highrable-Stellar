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
import { Badge } from "@repo/ui/components/ui/badge";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { Check, FileText, Loader2, Lock, RefreshCw, Send, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

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
  | "rejected"
  | "cancelled";

type TWorkAgreement = TConvexDoc<"workAgreements"> & {
  sourceAttachment?: (TConvexDoc<"attachments"> & { url?: string | null }) | null;
};

const AGREEMENT_ACCEPT =
  "application/pdf,text/markdown,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return status ? labels[status] : "No agreement";
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
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      This Highrable-generated agreement is provided as a workflow template and is not legal advice.
      For high-value, regulated, or jurisdiction-specific work, both parties should consult a
      qualified professional.
    </div>
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
    <div className="space-y-4 rounded-lg border border-[#d8d8d8] bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
            Agreement preview
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#0a0a0a]">{agreement.title}</h3>
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

function AgreementMarkdownPreview({ markdown }: { markdown?: string }) {
  if (!markdown) {
    return (
      <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-white p-4 text-sm text-[#5f5f5f]">
        Agreement preview could not be generated. Please try again.
      </p>
    );
  }

  return (
    <div className="max-h-[560px] space-y-2 overflow-auto rounded-lg border border-[#e8e8e8] bg-white p-4 font-mono text-xs leading-relaxed text-[#1f1f1f]">
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

function AgreementActions({
  agreement,
  disabled,
  onRegenerate,
  onSend,
  onLock,
  onCancel,
}: {
  agreement: TWorkAgreement;
  disabled?: boolean;
  onRegenerate: () => Promise<void>;
  onSend: () => Promise<void>;
  onLock: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const editable = agreement.status === "draft" || agreement.status === "pending_preview";
  const sendable =
    agreement.status === "draft" ||
    agreement.status === "pending_preview" ||
    agreement.status === "ready_to_send";

  return (
    <div className="flex flex-wrap gap-2">
      {editable && agreement.agreementType === "highrable_generated" ? (
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
      {sendable ? (
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
      {agreement.status === "accepted" ? (
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
      {agreement.status === "pending_acceptance" && agreement.freelancerWallet ? (
        <AppButton asChild type="button" variant="secondary" className="rounded-none">
          <Link href={`/work-agreements/${agreement._id}/review`}>Review link</Link>
        </AppButton>
      ) : null}
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
  const acceptAgreement = useMutation(api.work_agreements.acceptWorkAgreement);
  const rejectAgreement = useMutation(api.work_agreements.rejectWorkAgreement);
  const [accepted, setAccepted] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = walletIdentity.walletAddress;
  const walletType = walletIdentity.walletType as TWalletType | null;

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
        await rejectAgreement({
          agreementId,
          walletAddress,
          walletType,
          ...(reason.trim() ? { rejectionReason: reason.trim() } : {}),
        });
        setMessage("Agreement rejected.");
      }
    } catch (actionError) {
      setError(getReadableError(actionError, "Agreement action failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <AgreementMarkdownPreview markdown={agreement.contentMarkdown} />
        </>
      )}
      {agreement.agreementHash ? (
        <p className="border border-[#e8e8e8] bg-[#fafafa] p-3 font-mono text-xs break-all text-[#0a0a0a]">
          SHA-256: {agreement.agreementHash}
        </p>
      ) : null}
      {agreement.status === "pending_acceptance" ? (
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
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional rejection reason"
            className="rounded-none border-[#d8d8d8]"
          />
          <div className="flex flex-wrap gap-2">
            <AppButton
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
              disabled={isSubmitting}
              variant="secondary"
              onClick={() => void run("reject")}
              className="rounded-none"
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </AppButton>
          </div>
        </div>
      ) : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

export function WorkAgreementSetupPanel({
  jobId,
  escrowId,
}: {
  jobId: TConvexId<"jobs">;
  escrowId?: TConvexId<"escrows">;
}) {
  const walletIdentity = useHighrableWalletIdentity();
  const agreement = useQuery(
    api.work_agreements.getWorkAgreementByJob,
    walletIdentity.walletAddress ? { jobId, viewerWallet: walletIdentity.walletAddress } : "skip",
  ) as TWorkAgreement | null | undefined;
  const generateAgreement = useMutation(api.work_agreements.generateHighrableWorkAgreement);
  const createUploadedAgreement = useMutation(api.work_agreements.createClientUploadedAgreement);
  const regenerateAgreement = useMutation(api.work_agreements.regenerateHighrableWorkAgreement);
  const sendAgreement = useMutation(api.work_agreements.sendAgreementForAcceptance);
  const lockAgreement = useMutation(api.work_agreements.lockWorkAgreement);
  const cancelDraft = useMutation(api.work_agreements.cancelWorkAgreementDraft);
  const cancelPending = useMutation(api.work_agreements.cancelPendingAgreement);

  const [agreementType, setAgreementType] = useState<TAgreementType>("highrable_generated");
  const [uploadedAttachmentId, setUploadedAttachmentId] = useState<TConvexId<"attachments"> | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = walletIdentity.walletAddress;
  const walletType = walletIdentity.walletType as TWalletType | null;
  const canSubmit = Boolean(walletAddress && walletType);

  const createAgreement = async () => {
    if (!walletAddress || !walletType) {
      setError("Missing wallet identity.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
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
          ...(title.trim() ? { title: title.trim() } : {}),
        });
      } else {
        await generateAgreement({
          jobId,
          walletAddress,
          walletType,
          ...(title.trim() ? { title: title.trim() } : {}),
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

  return (
    <section className="space-y-4 rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
            Work agreement
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#0a0a0a]">Agreement</h2>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Create, send, accept, and lock the workflow agreement for this work.
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
        <AgreementPreviewShell agreement={agreement}>
          <AgreementSummaryCard agreement={agreement} />
          {agreement.agreementType === "client_uploaded" ? (
            <div className="space-y-2">
              {agreement.sourceAttachment ? (
                <AttachmentPreviewCard attachment={agreement.sourceAttachment} readOnly />
              ) : (
                <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-white p-4 text-sm text-[#5f5f5f]">
                  Uploaded agreement metadata is not available.
                </p>
              )}
            </div>
          ) : (
            <>
              <AgreementLegalDisclaimer />
              <AgreementMarkdownPreview markdown={agreement.contentMarkdown} />
            </>
          )}
          {escrowId ? (
            <p className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
              Linked escrow record: {escrowId}
            </p>
          ) : null}
          <AgreementActions
            agreement={agreement}
            disabled={isSubmitting}
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
                return agreement.status === "draft" || agreement.status === "pending_preview"
                  ? cancelDraft(args)
                  : cancelPending(args);
              }, "Agreement could not be cancelled.")
            }
          />
        </AgreementPreviewShell>
      ) : walletAddress ? (
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
              onChange={(event) => setTitle(event.target.value)}
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
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
