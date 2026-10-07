import { formatAttachmentSize, isValidHttpUrl } from "@/features/attachments/lib";
import { formatDisputeDate } from "@/features/disputes/lib";
import React from "react";

import type { IAdminDisputeDetail } from "./types";

type TAdminEvidenceAttachment = IAdminDisputeDetail["dispute"]["attachments"][number];

interface IAdminEvidenceListProps {
  readonly attachmentIds?: readonly string[];
  readonly attachments?: readonly TAdminEvidenceAttachment[];
}

function formatAttachmentType(type: string): string {
  return type.replaceAll("_", " ");
}

function getAttachmentUrl(attachment: TAdminEvidenceAttachment): string | null {
  const candidateUrl =
    attachment.url ??
    (["link", "video_link"].includes(attachment.type) ? (attachment.externalUrl ?? null) : null);

  return candidateUrl && isValidHttpUrl(candidateUrl) ? candidateUrl : null;
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

function EvidenceUnavailable({ referenceId }: { readonly referenceId?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-[#7f1d1d]">Evidence unavailable</p>
      {referenceId ? (
        <p className="font-mono text-xs break-all text-[#7f7f7f]">
          Referenced record: {referenceId}
        </p>
      ) : null}
    </div>
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
        <EvidenceUnavailable referenceId={referenceId} />
      </li>
    );
  }

  const isActive = attachment.status === "active";
  const url = isActive ? getAttachmentUrl(attachment) : null;
  const isUsable = Boolean(url);

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
        {!isActive || !isUsable ? <EvidenceUnavailable /> : null}
      </div>
      {url ? (
        <a
          href={url}
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
