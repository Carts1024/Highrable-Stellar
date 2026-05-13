import type { TEscrowStatus, TJobStatus, TMilestoneStatus } from "@/features/marketplace/types";

export type TMarketplaceStatus = TJobStatus | TEscrowStatus | TMilestoneStatus;

type TMarketplaceStatusMeta = {
  label: string;
  description: string;
  badgeClassName: string;
  trustWarning: string | null;
};

const MARKETPLACE_STATUS_META: Record<TMarketplaceStatus, TMarketplaceStatusMeta> = {
  draft: {
    label: "Draft",
    description: "Milestone is drafted and not open yet.",
    badgeClassName: "border-gray-300 bg-gray-100 text-gray-700",
    trustWarning: null,
  },
  open: {
    label: "Open",
    description: "Job is open and accepting freelancer applications.",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    trustWarning: null,
  },
  selected: {
    label: "Freelancer Selected",
    description: "Freelancer selected. Escrow still needs to be created and funded.",
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    trustWarning: "Do not start work yet. Client must create and fund escrow first.",
  },
  assigned: {
    label: "Assigned",
    description: "Milestone has an assigned freelancer. Escrow still needs to be created and funded.",
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    trustWarning: "Do not start work yet. Client must create and fund this milestone escrow first.",
  },
  created: {
    label: "Escrow Created",
    description: "Escrow contract exists on Stellar but funds are not locked yet.",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    trustWarning: "Escrow is unfunded. Work should start only after Verified Funded.",
  },
  escrow_created: {
    label: "Escrow Created",
    description: "Milestone escrow exists on Stellar but funds are not locked yet.",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    trustWarning: "This milestone escrow is unfunded. Work should start only after Verified Funded.",
  },
  funded: {
    label: "Verified Funded",
    description: "Funds are locked in Stellar escrow. Freelancer can begin work.",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    trustWarning: null,
  },
  submitted: {
    label: "Work Submitted",
    description: "Freelancer submitted work. Client review is pending.",
    badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    trustWarning: null,
  },
  released: {
    label: "Paid",
    description: "Payment has been released to the freelancer.",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    trustWarning: null,
  },
  completed: {
    label: "Paid",
    description: "Job is complete and payment is finalized.",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    trustWarning: null,
  },
  cancelled: {
    label: "Cancelled",
    description: "Escrow or job was cancelled before completion.",
    badgeClassName: "border-gray-300 bg-gray-100 text-gray-700",
    trustWarning: null,
  },
  disputed: {
    label: "Disputed",
    description: "Escrow is currently disputed and awaiting resolution.",
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
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
