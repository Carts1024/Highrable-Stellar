import type { TClientTrustStats } from "@/features/client-profile/types";

export type TClientTrustTone = "positive" | "neutral" | "warning" | "danger";

export type TClientTrustIndicator = {
  readonly label: string;
  readonly description: string;
  readonly tone: TClientTrustTone;
};

export function getClientTrustIndicator(stats: TClientTrustStats): TClientTrustIndicator {
  if (stats.disputedEscrows > 0) {
    return {
      label: "Dispute activity detected",
      description: "This client has escrow records marked as disputed.",
      tone: "danger",
    };
  }

  if (
    stats.cancellationRate !== null &&
    stats.cancelledEscrows >= 3 &&
    stats.cancellationRate >= 0.5
  ) {
    return {
      label: "High cancellation activity",
      description: "A high share of this client's escrow records were cancelled.",
      tone: "warning",
    };
  }

  if (
    stats.completedEscrows >= 3 &&
    (stats.disputeRate === null || stats.disputeRate <= 0.1) &&
    (stats.cancellationRate === null || stats.cancellationRate < 0.5)
  ) {
    return {
      label: "Consistent escrow activity",
      description: "This client has repeatedly funded and completed Stellar escrow payments.",
      tone: "positive",
    };
  }

  if (stats.fundedEscrows > 0) {
    return {
      label: "Has funded escrow",
      description: "This client has funded at least one Highrable escrow.",
      tone: "positive",
    };
  }

  if (stats.jobsPosted > 0) {
    return {
      label: "No funded history yet",
      description: "This client has posted work, but no funded escrow is recorded yet.",
      tone: "warning",
    };
  }

  return {
    label: "No escrow activity yet",
    description: "No jobs or funded escrows are recorded for this client wallet yet.",
    tone: "neutral",
  };
}
