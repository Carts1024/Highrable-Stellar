import type { TParticipantDisputeEligibilityQueryResult } from "../types";
import type { TDraftAttachment } from "@/features/attachments/types";

import { DISPUTE_REASON_OPTIONS } from "../lib";

export interface IDisputeDraftValidationInput {
  readonly title: string;
  readonly reasonCategory: string;
  readonly description: string;
  readonly eligibility: TParticipantDisputeEligibilityQueryResult | undefined;
  readonly escrowId: string;
  readonly onChainEscrowId: string;
  readonly escrowStatus: string;
  readonly relatedDataReady: boolean;
  readonly selectedSubmissionId: string | null;
  readonly availableSubmissionId: string | null;
  readonly selectedRevisionIds: readonly string[];
  readonly availableRevisionIds: readonly string[];
  readonly attachments: readonly TDraftAttachment[];
}

export function validateDisputeDraft(input: IDisputeDraftValidationInput): string | null {
  const title = input.title.trim();
  if (!title || title.length > 160) return "Title must be between 1 and 160 characters.";
  const description = input.description.trim();
  if (!description || description.length > 10_000) {
    return "Description must be between 1 and 10,000 characters.";
  }
  if (!DISPUTE_REASON_OPTIONS.some((option) => option.value === input.reasonCategory)) {
    return "Select a valid dispute reason.";
  }
  if (!input.eligibility) return "Checking whether this escrow can be disputed.";
  if (!input.eligibility.allowed) {
    return input.eligibility.reason ?? "This escrow is not eligible for a dispute.";
  }
  if (
    !input.onChainEscrowId ||
    !["funded", "submitted"].includes(input.escrowStatus) ||
    input.eligibility.escrowId !== input.escrowId ||
    input.eligibility.onChainEscrowId !== input.onChainEscrowId
  ) {
    return "Escrow details changed. Refresh the page before opening a dispute.";
  }
  if (!input.relatedDataReady) return "Loading related work records. Please wait.";
  if (input.selectedSubmissionId && input.selectedSubmissionId !== input.availableSubmissionId) {
    return "The selected work submission is no longer available.";
  }
  const availableRevisions = new Set(input.availableRevisionIds);
  if (
    input.selectedRevisionIds.length > 20 ||
    new Set(input.selectedRevisionIds).size !== input.selectedRevisionIds.length ||
    input.selectedRevisionIds.some((id) => !availableRevisions.has(id))
  ) {
    return "Select up to 20 revision requests from this escrow.";
  }
  if (
    input.attachments.length > 25 ||
    input.attachments.some((attachment) => attachment.status !== "ready" || !attachment.id)
  ) {
    return "Finish or remove failed evidence uploads before opening a dispute (25 maximum).";
  }
  return null;
}
