import type { TProofEscrow, TProofStatus, TProofType } from "../types";

export function getPaymentStatusLabel(status: TProofEscrow["status"]): string {
  const labels: Record<TProofEscrow["status"], string> = {
    created: "Started",
    funded: "Funds set aside",
    submitted: "Work in review",
    released: "Paid",
    cancelled: "Cancelled",
    disputed: "Under review",
  };

  return labels[status];
}

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
      ? "This milestone was approved and paid through Highrable."
      : "This micro gig was approved and paid through Highrable.";
  }

  if (status === "verified_funded") {
    return "Funds are set aside, but payment has not been released yet.";
  }

  if (status === "work_submitted") {
    return "Work was sent for review. Payment waits for client approval.";
  }

  if (status === "escrow_created") {
    return "The payment record exists, but funds are not set aside yet.";
  }

  if (status === "cancelled") {
    return "This payment was cancelled. It does not prove completed paid work.";
  }

  return "This payment is under review.";
}

export function getPaymentProofCopy(status: TProofStatus): string {
  switch (status) {
    case "escrow_created":
      return "A payment record was created, but funds are not set aside yet.";
    case "verified_funded":
      return "Funds are set aside for this work.";
    case "work_submitted":
      return "Work was sent for review. Payment waits for client approval.";
    case "paid":
      return "Payment was released to the freelancer.";
    case "cancelled":
      return "This payment was cancelled.";
    case "disputed":
      return "This payment is under review.";
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
