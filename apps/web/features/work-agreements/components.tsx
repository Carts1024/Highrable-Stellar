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
import { Input as AppInput } from "@repo/ui/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { FileText, Loader2, RefreshCw, Send, Upload, X } from "lucide-react";
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
    cancelled: "Cancelled",
  };
  return status ? labels[status] : "No agreement";
}

export function AgreementStatusBadge({ status }: { status?: TAgreementStatus }) {
  return (
    <Badge className="rounded-md border border-[#d8d8d8] bg-white px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-[#0a0a0a] uppercase hover:bg-white">
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
      This Highrable-generated agreement is provided as a workflow template and is not legal
      advice. For high-value, regulated, or jurisdiction-specific work, both parties should consult
      a qualified professional.
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
        <dt className="font-mono text-xs tracking-[0.08em] text-[#7f7f7f] uppercase">
          Freelancer
        </dt>
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
  onReady,
  onCancel,
}: {
  agreement: TWorkAgreement;
  disabled?: boolean;
  onRegenerate: () => Promise<void>;
  onReady: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const editable = agreement.status === "draft" || agreement.status === "pending_preview";
  if (!editable) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {agreement.agreementType === "highrable_generated" ? (
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
      <AppButton
        type="button"
        disabled={disabled}
        onClick={() => void onReady()}
        className="rounded-none bg-[#0a0a0a] text-white hover:bg-[#FF7003]"
      >
        <Send className="mr-2 h-4 w-4" />
        Mark ready to send
      </AppButton>
      <AppButton
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => void onCancel()}
        className="rounded-none"
      >
        <X className="mr-2 h-4 w-4" />
        Cancel draft
      </AppButton>
    </div>
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
  const markReady = useMutation(api.work_agreements.markWorkAgreementReadyToSend);
  const cancelDraft = useMutation(api.work_agreements.cancelWorkAgreementDraft);

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
          throw new Error("Select a supported agreement file, such as PDF, DOCX, Markdown, or text.");
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
            Create and preview a workflow agreement for this work. Acceptance controls are not
            enforced yet.
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
            onReady={() =>
              runAgreementAction(
                () =>
                  markReady({
                    agreementId: agreement._id,
                    walletAddress: walletAddress!,
                    walletType: walletType!,
                    status: "ready_to_send",
                  }),
                "Agreement could not be marked ready.",
              )
            }
            onCancel={() =>
              runAgreementAction(
                () =>
                  cancelDraft({
                    agreementId: agreement._id,
                    walletAddress: walletAddress!,
                    walletType: walletType!,
                  }),
                "Agreement could not be cancelled.",
              )
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
