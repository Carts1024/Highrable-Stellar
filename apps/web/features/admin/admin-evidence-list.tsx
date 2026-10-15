import { formatAttachmentSize, isValidHttpUrl } from "@/features/attachments/lib";
import { formatDisputeDate } from "@/features/disputes/lib";
import React from "react";

import type { IAdminDisputeDetail } from "./types";

type TAdminEvidenceAttachment = IAdminDisputeDetail["dispute"]["attachments"][number];

type TAdminEvidencePresentationState =
  | "available"
  | "missing"
  | "blocked"
  | "deleted"
  | "invalid"
  | "url_unavailable";

interface IAdminEvidenceListProps {
  readonly attachmentIds?: readonly string[];
  readonly attachments?: readonly TAdminEvidenceAttachment[];
}

function formatAttachmentType(type: string): string {
  return type.replaceAll("_", " ");
}

function getAttachmentCandidateUrl(attachment: TAdminEvidenceAttachment): string | null {
  return (
    attachment.url ??
    (["link", "video_link"].includes(attachment.type) ? (attachment.externalUrl ?? null) : null)
  );
}

function getAttachmentPresentation(attachment: TAdminEvidenceAttachment | undefined): {
  readonly state: TAdminEvidencePresentationState;
  readonly url: string | null;
} {
  if (!attachment) {
    return { state: "missing", url: null };
  }

  const status = String(attachment.status);
  if (status === "blocked" || status === "deleted") {
    return { state: status, url: null };
  }
  if (status !== "active") {
    return { state: "invalid", url: null };
  }

  const candidateUrl = getAttachmentCandidateUrl(attachment);
  if (!candidateUrl) {
    return { state: "url_unavailable", url: null };
  }
  if (!isValidHttpUrl(candidateUrl)) {
    return { state: "invalid", url: null };
  }

  return { state: "available", url: candidateUrl };
}

function getEvidenceReferences(
  attachmentIds: readonly string[],
  attachments: readonly TAdminEvidenceAttachment[],
): readonly string[] {
  const references =
    attachmentIds.length > 0
      ? attachmentIds
      : attachments.map((attachment) => String(attachment._id));
  return Array.from(new Set(references));
}

function EvidenceStateMessage({
  state,
  referenceId,
}: {
  readonly state: TAdminEvidencePresentationState;
  readonly referenceId?: string;
}) {
  const stateLabel =
    state === "url_unavailable"
      ? "URL unavailable"
      : state.charAt(0).toUpperCase() + state.slice(1);

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-[#7f1d1d]">{stateLabel}</p>
      {state === "missing" ? (
        <p className="text-xs leading-relaxed text-[#5f5f5f]">
          The referenced attachment was not returned. This does not indicate deletion.
        </p>
      ) : null}
      {state === "blocked" || state === "deleted" ? (
        <p className="text-xs leading-relaxed text-[#5f5f5f]">
          The returned attachment is {state} and cannot be opened from this view.
        </p>
      ) : null}
      {state === "invalid" ? (
        <p className="text-xs leading-relaxed text-[#5f5f5f]">
          The attachment has a malformed or unsafe opening URL, or an unsupported status.
        </p>
      ) : null}
      {state === "url_unavailable" ? (
        <p className="text-xs leading-relaxed text-[#5f5f5f]">
          No opening URL is available. Refreshing the detail may recover it, but recovery is not
          guaranteed.
        </p>
      ) : null}
      {referenceId ? (
        <p className="font-mono text-xs break-all text-[#7f7f7f]">
          Referenced record: {referenceId}
        </p>
      ) : null}
    </div>
  );
}

function AvailableEvidenceState() {
  return (
    <p className="text-xs font-semibold text-emerald-700" aria-label="Evidence state: Available">
      Available
    </p>
  );
}

function AdminEvidenceItem({
  attachment,
  referenceId,
}: {
  readonly attachment?: TAdminEvidenceAttachment;
  readonly referenceId: string;
}) {
  if (!attachment) {
    return (
      <li className="border border-dashed border-[#e8e8e8] bg-[#fafafa] px-3 py-3">
        <EvidenceStateMessage state="missing" referenceId={referenceId} />
      </li>
    );
  }

  const presentation = getAttachmentPresentation(attachment);

  return (
    <li className="flex min-w-0 flex-wrap items-start justify-between gap-4 border border-[#e8e8e8] bg-[#fafafa] px-3 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold text-[#0a0a0a]">{attachment.name}</p>
        <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5f5f5f]">
          <div>
            <dt className="sr-only">Type</dt>
            <dd>Type: {formatAttachmentType(attachment.type)}</dd>
          </div>
          <div>
            <dt className="sr-only">Uploader</dt>
            <dd>Uploaded by: {attachment.uploadedByWallet}</dd>
          </div>
          {attachment.size !== undefined ? (
            <div>
              <dt className="sr-only">Size</dt>
              <dd>Size: {formatAttachmentSize(attachment.size)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="sr-only">Added</dt>
            <dd>Added: {formatDisputeDate(attachment.createdAt)}</dd>
          </div>
        </dl>
        {presentation.state === "available" ? (
          <AvailableEvidenceState />
        ) : (
          <EvidenceStateMessage state={presentation.state} />
        )}
      </div>
      {presentation.url ? (
        <a
          href={presentation.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${attachment.name}`}
          className="shrink-0 font-mono text-[0.7rem] tracking-[0.06em] text-[#B94A00] uppercase hover:text-[#E85D00]"
        >
          Open {attachment.name}
        </a>
      ) : null}
    </li>
  );
}

export function AdminEvidenceList({
  attachmentIds = [],
  attachments = [],
}: IAdminEvidenceListProps) {
  const recordsById = new Map<string, TAdminEvidenceAttachment>(
    attachments.map((attachment) => [String(attachment._id), attachment]),
  );
  const references = getEvidenceReferences(attachmentIds, attachments);

  if (references.length === 0) {
    return <p className="text-sm text-[#5f5f5f]">No evidence attached.</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Evidence attachments">
      {references.map((referenceId) => (
        <AdminEvidenceItem
          key={referenceId}
          referenceId={referenceId}
          attachment={recordsById.get(referenceId)}
        />
      ))}
    </ul>
  );
}
