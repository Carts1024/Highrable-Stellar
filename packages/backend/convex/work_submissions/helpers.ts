import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TWorkSubmissionParentType } from "./schema";

import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";
import {
  assertCanSubmitRevision,
  getRevisionPolicyConfig,
  isRevisionEnabledPolicy,
  resolveRevisionParent,
} from "../revisions/helpers";

const PROOF_HASH_PATTERN = /^[0-9a-f]{64}$/;
const IMMUTABLE_STATUSES = new Set([
  "submitted_for_review",
  "revision_requested",
  "revision_submitted",
  "accepted_for_final",
  "submitted",
  "anchoring",
  "anchored",
]);

export function sanitizeProofNotes(notes: string): string {
  return notes.replace(/\r\n?/g, "\n").trim().slice(0, 10_000);
}

export function sanitizeProofHash(proofHash: string): string {
  const sanitized = requireNonEmptyString(proofHash, "proofHash").toLowerCase();
  if (!PROOF_HASH_PATTERN.test(sanitized)) {
    throw new BadRequestError("Proof hash must be a lowercase SHA-256 hex string.");
  }

  return sanitized;
}

export function sanitizeErrorMessage(errorMessage?: string): string | undefined {
  return optionalNonEmptyString(errorMessage, "errorMessage")?.slice(0, 500);
}

export async function getSubmissionOrThrow(ctx: QueryCtx, submissionId: Id<"workSubmissions">) {
  const submission = await ctx.db.get(submissionId);
  if (!submission) {
    throw new NotFoundError("Work submission not found.");
  }

  return submission;
}

export async function getEscrowByOnChainIdOrThrow(ctx: QueryCtx, onChainEscrowId: string) {
  const escrow = await ctx.db
    .query("escrows")
    .withIndex("by_escrowId", (q) =>
      q.eq("escrowId", requireNonEmptyString(onChainEscrowId, "escrowId")),
    )
    .unique();

  if (!escrow) {
    throw new NotFoundError("Escrow not found.");
  }

  return escrow;
}

export async function assertCanCreateSubmission(
  ctx: QueryCtx,
  input: {
    onChainEscrowId: string;
    submittedByWallet: string;
    revisionRequestId?: Id<"revisionRequests">;
  },
) {
  const submittedByWallet = normalizeWalletAddress(input.submittedByWallet);
  const escrow = await getEscrowByOnChainIdOrThrow(ctx, input.onChainEscrowId);

  if (!escrow.freelancerWallet) {
    throw new ForbiddenError("Only the assigned freelancer can submit proof for this escrow.");
  }

  if (escrow.freelancerWallet !== submittedByWallet) {
    throw new ForbiddenError("Only the assigned freelancer can submit proof for this escrow.");
  }

  if (input.revisionRequestId !== undefined) {
    const { revision } = await assertCanSubmitRevision(ctx, {
      revisionRequestId: input.revisionRequestId,
      freelancerWallet: submittedByWallet,
    });
    if (revision.escrowId !== escrow._id) {
      throw new BadRequestError("Revision request does not belong to this escrow.");
    }
    if (escrow.status !== "funded" && escrow.status !== "submitted") {
      throw new BadRequestError(
        "Revision proof can only be submitted after original work review starts.",
      );
    }
  } else if (escrow.status !== "funded") {
    throw new BadRequestError("This escrow is not ready for proof submission.");
  }

  const job = await ctx.db.get(escrow.jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }

  const parentType: TWorkSubmissionParentType =
    escrow.milestoneId !== undefined ? "milestone" : "micro_gig";
  const parentId = escrow.milestoneId !== undefined ? escrow.milestoneId : escrow.jobId;

  return {
    escrow,
    job,
    submittedByWallet,
    parentType,
    parentId,
    ...(input.revisionRequestId !== undefined
      ? { revisionRequestId: input.revisionRequestId }
      : {}),
  };
}

export function assertSubmissionIsMutable(submission: { status: string; onChainStatus: string }) {
  if (IMMUTABLE_STATUSES.has(submission.status) || submission.onChainStatus === "confirmed") {
    throw new ForbiddenError("Submitted proof is read-only.");
  }
}

export function assertCanViewSubmission(
  submission: {
    clientWallet: string;
    freelancerWallet: string;
    submittedByWallet: string;
  },
  viewerWallet?: string,
) {
  if (!viewerWallet) {
    throw new ForbiddenError("You do not have permission to view this proof submission.");
  }

  const normalizedViewer = normalizeWalletAddress(viewerWallet);
  if (
    normalizedViewer === submission.clientWallet ||
    normalizedViewer === submission.freelancerWallet ||
    normalizedViewer === submission.submittedByWallet
  ) {
    return;
  }

  throw new ForbiddenError("You do not have permission to view this proof submission.");
}

export function assertCanAnchorSubmission(
  submission: {
    parentType: TWorkSubmissionParentType;
    parentId: string;
    freelancerWallet: string;
    submittedByWallet: string;
    status: string;
    onChainStatus: string;
    proofHash?: string;
  },
  walletAddress: string,
  options?: { revisionEnabled?: boolean },
) {
  const normalizedWallet = normalizeWalletAddress(walletAddress);
  if (
    normalizedWallet !== submission.freelancerWallet ||
    normalizedWallet !== submission.submittedByWallet
  ) {
    throw new ForbiddenError("Only the assigned freelancer can anchor this proof.");
  }

  if (!submission.proofHash) {
    throw new BadRequestError("Proof metadata must be submitted before anchoring.");
  }

  const expectedReadyStatus = options?.revisionEnabled ? "accepted_for_final" : "submitted";
  const isRetryableFailure = submission.status === "anchor_failed";
  if (submission.status !== expectedReadyStatus && !isRetryableFailure) {
    throw new BadRequestError("This proof submission is not ready for anchoring.");
  }

  if (submission.onChainStatus === "confirmed") {
    throw new BadRequestError("This proof submission is already anchored.");
  }
}

export async function assertCanAnchorSubmissionForCurrentPolicy(
  ctx: QueryCtx,
  submission: {
    parentType: TWorkSubmissionParentType;
    parentId: string;
    freelancerWallet: string;
    submittedByWallet: string;
    status: string;
    onChainStatus: string;
    proofHash?: string;
  },
  walletAddress: string,
) {
  const parent = await resolveRevisionParent(ctx, {
    parentType: submission.parentType,
    parentId: submission.parentId,
  });
  const revisionEnabled = isRevisionEnabledPolicy(getRevisionPolicyConfig(parent).revisionPolicy);
  assertCanAnchorSubmission(submission, walletAddress, { revisionEnabled });

  return { parent, revisionEnabled };
}

export async function assertAttachmentsOwnedBySubmitter(
  ctx: MutationCtx,
  input: {
    attachmentIds: Id<"attachments">[];
    submittedByWallet: string;
    submissionId: Id<"workSubmissions">;
  },
) {
  const normalizedWallet = normalizeWalletAddress(input.submittedByWallet);
  const attachments = [];

  for (const attachmentId of input.attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment || attachment.status !== "active") {
      throw new NotFoundError("Attachment not found.");
    }
    if (attachment.uploadedByWallet !== normalizedWallet) {
      throw new ForbiddenError("Attachment does not belong to submitter.");
    }
    if (
      attachment.parentType !== "unknown" &&
      (attachment.parentType !== "work_submission" || attachment.parentId !== input.submissionId)
    ) {
      throw new BadRequestError("Attachment is already linked to another immutable proof.");
    }
    attachments.push(attachment);
  }

  return attachments;
}
