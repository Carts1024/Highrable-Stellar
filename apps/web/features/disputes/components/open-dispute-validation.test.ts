import { describe, expect, it } from "vitest";

import type { IDisputeDraftValidationInput } from "./open-dispute-validation";
import type { TConvexId } from "@repo/convex-client";

import { validateDisputeDraft } from "./open-dispute-validation";

const validDraft: IDisputeDraftValidationInput = {
  title: "Payment was not released",
  reasonCategory: "payment_release_disagreement",
  description: "The work was delivered and accepted, but payment remains in escrow.",
  eligibility: {
    allowed: true,
    reason: null,
    openedByRole: "freelancer",
    escrowId: "escrow-1" as TConvexId<"escrows">,
    onChainEscrowId: "chain-1",
  },
  escrowId: "escrow-1",
  onChainEscrowId: "chain-1",
  escrowStatus: "funded",
  relatedDataReady: true,
  selectedSubmissionId: "submission-1",
  availableSubmissionId: "submission-1",
  selectedRevisionIds: ["revision-1"],
  availableRevisionIds: ["revision-1", "revision-2"],
  attachments: [{ id: "attachment-1", name: "proof.pdf", type: "pdf", status: "ready" }],
};

describe("participant dispute draft validation", () => {
  it("accepts a complete draft and trims only at submission", () => {
    expect(validateDisputeDraft(validDraft)).toBeNull();
    expect(validateDisputeDraft({ ...validDraft, escrowStatus: "submitted" })).toBeNull();
  });

  it("rejects missing, oversized, or invalid text fields", () => {
    expect(validateDisputeDraft({ ...validDraft, title: "  " })).toMatch(/Title/);
    expect(validateDisputeDraft({ ...validDraft, title: "a".repeat(161) })).toMatch(/160/);
    expect(validateDisputeDraft({ ...validDraft, description: "  " })).toMatch(/Description/);
    expect(validateDisputeDraft({ ...validDraft, description: "a".repeat(10_001) })).toMatch(
      /10,000/,
    );
    expect(validateDisputeDraft({ ...validDraft, reasonCategory: "unknown" })).toMatch(/reason/);
  });

  it("requires a matching eligible funded or submitted escrow", () => {
    expect(validateDisputeDraft({ ...validDraft, eligibility: undefined })).toMatch(/Checking/);
    expect(
      validateDisputeDraft({
        ...validDraft,
        eligibility: {
          allowed: false,
          reason: "Escrow is not funded.",
          openedByRole: null,
          escrowId: null,
          onChainEscrowId: null,
        },
      }),
    ).toBe("Escrow is not funded.");
    expect(validateDisputeDraft({ ...validDraft, escrowId: "another-escrow" })).toMatch(/changed/);
    expect(validateDisputeDraft({ ...validDraft, escrowStatus: "released" })).toMatch(/changed/);
    expect(validateDisputeDraft({ ...validDraft, onChainEscrowId: "another-chain" })).toMatch(
      /changed/,
    );
  });

  it("accepts only visible related records from the selected escrow", () => {
    expect(validateDisputeDraft({ ...validDraft, relatedDataReady: false })).toMatch(/Loading/);
    expect(validateDisputeDraft({ ...validDraft, selectedSubmissionId: "unrelated" })).toMatch(
      /submission/,
    );
    expect(validateDisputeDraft({ ...validDraft, selectedRevisionIds: ["unrelated"] })).toMatch(
      /revision/,
    );
    expect(
      validateDisputeDraft({ ...validDraft, selectedRevisionIds: ["revision-1", "revision-1"] }),
    ).toMatch(/revision/);
    expect(
      validateDisputeDraft({
        ...validDraft,
        selectedRevisionIds: Array.from({ length: 21 }, (_, index) => `revision-${index}`),
      }),
    ).toMatch(/20/);
  });

  it("does not silently omit unfinished or failed evidence", () => {
    expect(
      validateDisputeDraft({
        ...validDraft,
        attachments: [{ id: "upload", name: "proof", type: "file", status: "uploading" }],
      }),
    ).toMatch(/evidence uploads/);
    expect(
      validateDisputeDraft({
        ...validDraft,
        attachments: [{ id: "failed", name: "proof", type: "file", status: "failed" }],
      }),
    ).toMatch(/evidence uploads/);
  });
});
