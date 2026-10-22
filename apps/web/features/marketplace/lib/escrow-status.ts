import type { TStatusTone } from "@/features/common/components/status-text";
import type { TEscrowStatus, TJobStatus, TMilestoneStatus } from "@/features/marketplace/types";

export type TMarketplaceStatus = TJobStatus | TEscrowStatus | TMilestoneStatus;

type TMarketplaceStatusMeta = {
  label: string;
  description: string;
  tone: TStatusTone;
  trustWarning: string | null;
};

const MARKETPLACE_STATUS_META: Record<TMarketplaceStatus, TMarketplaceStatusMeta> = {
  draft: {
    label: "Draft",
    description: "Milestone is drafted and not open yet.",
    tone: "neutral",
    trustWarning: null,
  },
  open: {
    label: "Open",
    description: "Job is open and accepting freelancer applications.",
    tone: "success",
    trustWarning: null,
  },
  selected: {
    label: "Freelancer Selected",
    description: "Freelancer selected. Escrow still needs to be created and funded.",
    tone: "warning",
    trustWarning: "Do not start work yet. Client must create and fund escrow first.",
  },
  assigned: {
    label: "Assigned",
    description:
      "Milestone has an assigned freelancer. Escrow still needs to be created and funded.",
    tone: "warning",
    trustWarning: "Do not start work yet. Client must create and fund this milestone escrow first.",
  },
  created: {
    label: "Escrow Created",
    description: "Escrow contract exists on Stellar but funds are not locked yet.",
    tone: "warning",
    trustWarning: "Escrow is unfunded. Work should start only after Verified Funded.",
  },
  escrow_created: {
    label: "Escrow Created",
    description: "Milestone escrow exists on Stellar but funds are not locked yet.",
    tone: "warning",
    trustWarning:
      "This milestone escrow is unfunded. Work should start only after Verified Funded.",
  },
  funded: {
    label: "Verified Funded",
    description: "Funds are locked in Stellar escrow. Freelancer can begin work.",
    tone: "info",
    trustWarning: null,
  },
  submitted: {
    label: "Work Submitted",
    description: "Freelancer submitted work. Client review is pending.",
    tone: "info",
    trustWarning: null,
  },
  revision_requested: {
    label: "Revision Requested",
    description: "Client requested changes. Freelancer response is pending.",
    tone: "warning",
    trustWarning: null,
  },
  revision_submitted: {
    label: "Revision Submitted",
    description: "Freelancer submitted revised work. Client review is pending.",
    tone: "info",
    trustWarning: null,
  },
  released: {
    label: "Paid",
    description: "Payment has been released to the freelancer.",
    tone: "success",
    trustWarning: null,
  },
  completed: {
    label: "Paid",
    description: "Job is complete and payment is finalized.",
    tone: "success",
    trustWarning: null,
  },
  cancelled: {
    label: "Cancelled",
    description: "Escrow or job was cancelled before completion.",
    tone: "neutral",
    trustWarning: null,
  },
  disputed: {
    label: "Disputed",
    description: "Escrow is currently disputed and awaiting resolution.",
    tone: "danger",
    trustWarning: null,
  },
};

export function getMarketplaceStatus(
  jobStatus: TJobStatus,
  escrowStatus: TEscrowStatus | null | undefined,
): TMarketplaceStatus {
  return escrowStatus ?? jobStatus;
}

export function getMarketplaceStatusMeta(status: TMarketplaceStatus): TMarketplaceStatusMeta {
  return MARKETPLACE_STATUS_META[status];
}
