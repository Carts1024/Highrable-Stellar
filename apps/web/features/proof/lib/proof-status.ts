import type { TProofEscrow, TProofStatus, TProofType } from "../types";

export const PROOF_STATUS_LABELS: Record<TProofStatus, string> = {
  escrow_created: "Escrow Created",
  verified_funded: "Verified Funded",
  work_submitted: "Work Submitted",
  paid: "Paid",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

export const PROOF_TYPE_LABELS: Record<TProofType, string> = {
  micro_gig: "Micro Gig",
  milestone: "Milestone",
};

export function getProofSummary(status: TProofStatus, proofType: TProofType): string {
  if (status === "paid") {
    return proofType === "milestone"
      ? "Paid milestone verified through Stellar escrow."
      : "Paid micro gig verified through Stellar escrow.";
  }

  if (status === "verified_funded") {
    return "This escrow is funded, but payment has not been released yet.";
  }

  if (status === "work_submitted") {
    return "Work was submitted. Funds are still locked until client approval.";
  }

  if (status === "escrow_created") {
    return "Escrow exists, but funds are not locked yet.";
  }

  if (status === "cancelled") {
    return "Escrow cancelled. This page does not prove completed work.";
  }

  return "Escrow disputed. Manual review is required.";
}

export function getPaymentProofCopy(status: TProofStatus): string {
  switch (status) {
    case "escrow_created":
      return "Escrow was created, but no payment has been locked yet.";
    case "verified_funded":
      return "Stablecoin funds are locked in Stellar escrow.";
    case "work_submitted":
      return "Work was submitted. Funds are still locked until client approval.";
    case "paid":
      return "Payment was released to the freelancer through Stellar escrow.";
    case "cancelled":
      return "This escrow was cancelled.";
    case "disputed":
      return "This escrow is disputed and requires manual review.";
  }
}

export function getTimelineEventState(
  eventType: "created" | "funded" | "submitted" | "released" | "reputation",
  escrow: TProofEscrow,
  hasReputationRecord: boolean,
): "complete" | "current" | "pending" {
  if (eventType === "created") {
    return "complete";
  }

  if (eventType === "funded") {
    return ["funded", "submitted", "released"].includes(escrow.status) ? "complete" : "pending";
  }

  if (eventType === "submitted") {
    return ["submitted", "released"].includes(escrow.status) ? "complete" : "pending";
  }

  if (eventType === "released") {
    return escrow.status === "released" ? "complete" : "pending";
  }

  return hasReputationRecord ? "complete" : escrow.status === "released" ? "current" : "pending";
}
