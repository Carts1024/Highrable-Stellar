import { bytesToHex } from "@/core/stellar/hashes";

import type { TAttachmentType } from "@/features/attachments/types";
import type { TConvexDoc } from "@repo/convex-client";

export type TProofAttachmentInput = Pick<
  TConvexDoc<"attachments">,
  "_id" | "type" | "name" | "size" | "mimeType" | "storageId" | "externalUrl" | "createdAt"
>;

export type TNormalizedProofAttachment = {
  attachmentId: string;
  type: TAttachmentType;
  name: string;
  size: number | null;
  mimeType: string | null;
  storageId: string | null;
  externalUrlHash: string | null;
  fileHash: string | null;
  createdAt: string;
};

export type TNormalizedProofManifest = {
  proofVersion: "v1" | "v1_revision";
  platform: "Highrable";
  network: string;
  escrowContractId: string;
  onChainEscrowId: string;
  convexEscrowId: string | null;
  parentType: "micro_gig" | "milestone" | "escrow" | "job";
  parentId: string;
  jobId: string | null;
  milestoneId: string | null;
  clientWallet: string;
  freelancerWallet: string;
  submittedByWallet: string;
  submittedByWalletType: "external_wallet" | "passkey_smart_account";
  submittedAt: string;
  notesHash: string;
  attachments: TNormalizedProofAttachment[];
  revisionContext?: {
    revisionRequestId: string;
    revisionNumber: number;
    previousSubmissionId: string;
  };
};

export function normalizeSubmissionNotes(notes: string): string {
  return notes.replace(/\r\n?/g, "\n").trim();
}

function normalizeWallet(value: string): string {
  return value.trim();
}

function normalizeAttachmentName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeUrl(value?: string): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export async function hashText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function normalizeProofAttachment(
  attachment: TProofAttachmentInput,
): Promise<TNormalizedProofAttachment> {
  const externalUrl = normalizeUrl(attachment.externalUrl);

  return {
    attachmentId: attachment._id,
    type: attachment.type as TAttachmentType,
    name: normalizeAttachmentName(attachment.name),
    size: attachment.size ?? null,
    mimeType: attachment.mimeType?.trim().toLowerCase() ?? null,
    storageId: attachment.storageId ?? null,
    externalUrlHash: externalUrl ? await hashText(externalUrl) : null,
    // TODO: Store a client-side SHA-256 file checksum in attachment metadata during upload.
    fileHash: null,
    createdAt: new Date(attachment.createdAt).toISOString(),
  };
}

export async function buildNormalizedProofManifest(input: {
  network: string;
  escrowContractId: string;
  onChainEscrowId: string;
  convexEscrowId?: string | null;
  parentType: TNormalizedProofManifest["parentType"];
  parentId: string;
  jobId?: string | null;
  milestoneId?: string | null;
  clientWallet: string;
  freelancerWallet: string;
  submittedByWallet: string;
  submittedByWalletType: TNormalizedProofManifest["submittedByWalletType"];
  submittedAt: number;
  notes: string;
  attachments: TProofAttachmentInput[];
  revisionContext?: {
    revisionRequestId: string;
    revisionNumber: number;
    previousSubmissionId: string;
  };
}): Promise<TNormalizedProofManifest> {
  const normalizedAttachments = await Promise.all(
    [...input.attachments]
      .sort((left, right) => {
        const leftKey = `${left.createdAt}:${left._id}`;
        const rightKey = `${right.createdAt}:${right._id}`;
        return leftKey.localeCompare(rightKey);
      })
      .map((attachment) => normalizeProofAttachment(attachment)),
  );

  return {
    proofVersion: input.revisionContext ? "v1_revision" : "v1",
    platform: "Highrable",
    network: input.network.trim(),
    escrowContractId: input.escrowContractId.trim(),
    onChainEscrowId: input.onChainEscrowId.trim(),
    convexEscrowId: input.convexEscrowId ?? null,
    parentType: input.parentType,
    parentId: input.parentId,
    jobId: input.jobId ?? null,
    milestoneId: input.milestoneId ?? null,
    clientWallet: normalizeWallet(input.clientWallet),
    freelancerWallet: normalizeWallet(input.freelancerWallet),
    submittedByWallet: normalizeWallet(input.submittedByWallet),
    submittedByWalletType: input.submittedByWalletType,
    submittedAt: new Date(input.submittedAt).toISOString(),
    notesHash: await hashText(normalizeSubmissionNotes(input.notes)),
    attachments: normalizedAttachments,
    ...(input.revisionContext !== undefined
      ? {
          revisionContext: {
            revisionRequestId: input.revisionContext.revisionRequestId,
            revisionNumber: input.revisionContext.revisionNumber,
            previousSubmissionId: input.revisionContext.previousSubmissionId,
          },
        }
      : {}),
  };
}

export async function hashProofManifest(manifest: TNormalizedProofManifest): Promise<string> {
  return await hashText(stableStringify(manifest));
}
