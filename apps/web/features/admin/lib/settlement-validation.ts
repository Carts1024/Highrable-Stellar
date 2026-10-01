import type { IAdminDisputeDetail, TAdminResolutionStatus } from "@/features/admin/types";
import type { TDisputeStatus } from "@/features/disputes/types";

export const ACTIVE_SETTLEMENT_ATTEMPT_STATUSES = [
  "started",
  "signed",
  "submission_unknown",
  "submitted",
] as const;

export const SETTLEMENT_REVIEW_STATUSES = [
  "open",
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
] as const satisfies readonly TDisputeStatus[];

const CLIENT_RESOLUTION_BPS = 0;
const FREELANCER_RESOLUTION_BPS = 10_000;

export interface IResolutionShareValidation {
  readonly isValid: boolean;
  readonly freelancerShareBps: number | null;
  readonly error: string | null;
}

export interface ISettlementEligibility {
  readonly canSettle: boolean;
  readonly blockingReason: string | null;
}

export type ISettlementEligibilityDetail = {
  readonly dispute: Pick<
    IAdminDisputeDetail["dispute"],
    | "status"
    | "clientWallet"
    | "freelancerWallet"
    | "assignedAdminWallet"
    | "onChainStatus"
    | "onChainEscrowId"
  >;
  readonly escrow: Pick<NonNullable<IAdminDisputeDetail["escrow"]>, "status"> | null;
  readonly settlementAttempts: ReadonlyArray<
    Pick<IAdminDisputeDetail["settlementAttempts"][number], "status">
  >;
};

export interface ISettlementEligibilityInput {
  readonly detail: ISettlementEligibilityDetail | null;
  readonly verifiedWallet: string;
  readonly activeWalletAddress: string | null;
  readonly activeWalletType: "external_wallet" | "passkey_smart_account" | null;
  readonly connectedWalletAddress: string | null;
  readonly isConnected: boolean;
  readonly canWriteContracts: boolean | undefined;
  readonly isTestnet: boolean;
  readonly configuredNetwork: string | null;
  readonly isActionRunning: boolean;
}

function normalizeWallet(wallet: string | null | undefined): string {
  return wallet?.trim().toUpperCase() ?? "";
}

function isConfiguredNetwork(network: string, isTestnet: boolean): boolean {
  return network.trim().toLowerCase() === "testnet" ? isTestnet : !isTestnet;
}

export function isActiveSettlementAttemptStatus(status: string): boolean {
  return ACTIVE_SETTLEMENT_ATTEMPT_STATUSES.some((activeStatus) => activeStatus === status);
}

export function isSettlementReviewStatus(status: TDisputeStatus): boolean {
  return SETTLEMENT_REVIEW_STATUSES.some((reviewStatus) => reviewStatus === status);
}

export function validateResolutionShare(
  status: TAdminResolutionStatus,
  input: string,
): IResolutionShareValidation {
  if (status === "resolved_client") {
    return { isValid: true, freelancerShareBps: CLIENT_RESOLUTION_BPS, error: null };
  }

  if (status === "resolved_freelancer") {
    return { isValid: true, freelancerShareBps: FREELANCER_RESOLUTION_BPS, error: null };
  }

  if (input.length === 0) {
    return {
      isValid: false,
      freelancerShareBps: null,
      error: "Enter a whole-number freelancer share from 1 to 9999 bps.",
    };
  }

  if (!/^[0-9]+$/.test(input)) {
    return {
      isValid: false,
      freelancerShareBps: null,
      error: "Use whole-number digits only for the freelancer share.",
    };
  }

  const freelancerShareBps = Number(input);
  if (
    !Number.isSafeInteger(freelancerShareBps) ||
    freelancerShareBps < 1 ||
    freelancerShareBps > 9999
  ) {
    return {
      isValid: false,
      freelancerShareBps: null,
      error: "Enter a whole-number freelancer share from 1 to 9999 bps.",
    };
  }

  return { isValid: true, freelancerShareBps, error: null };
}

export function resolveShareBps(status: TAdminResolutionStatus, input: string): number {
  const validation = validateResolutionShare(status, input);
  if (!validation.isValid || validation.freelancerShareBps === null) {
    throw new Error(validation.error ?? "Invalid freelancer share.");
  }

  return validation.freelancerShareBps;
}

export function getResolutionShareDisplayValue(
  status: TAdminResolutionStatus,
  input: string,
): string {
  if (status === "resolved_client") {
    return String(CLIENT_RESOLUTION_BPS);
  }

  if (status === "resolved_freelancer") {
    return String(FREELANCER_RESOLUTION_BPS);
  }

  return input;
}

export function deriveSettlementEligibility(
  args: ISettlementEligibilityInput,
): ISettlementEligibility {
  if (args.isActionRunning) {
    return { canSettle: false, blockingReason: "Settlement is already in progress." };
  }

  if (!args.detail) {
    return {
      canSettle: false,
      blockingReason: "Settlement is unavailable until dispute details are loaded.",
    };
  }

  if (args.activeWalletType !== "external_wallet") {
    return {
      canSettle: false,
      blockingReason: "Connect a signing-capable external Stellar wallet to settle.",
    };
  }

  if (!args.isConnected || !args.activeWalletAddress || !args.connectedWalletAddress) {
    return {
      canSettle: false,
      blockingReason: "Connect a signing-capable external Stellar wallet to settle.",
    };
  }

  if (normalizeWallet(args.activeWalletAddress) !== normalizeWallet(args.connectedWalletAddress)) {
    return {
      canSettle: false,
      blockingReason: "Reconnect the external wallet before settling this case.",
    };
  }

  if (args.canWriteContracts === false) {
    return {
      canSettle: false,
      blockingReason: "The connected wallet cannot sign escrow contract actions.",
    };
  }

  if (!args.configuredNetwork) {
    return {
      canSettle: false,
      blockingReason: "Settlement is unavailable because Stellar network configuration is missing.",
    };
  }

  if (!isConfiguredNetwork(args.configuredNetwork, args.isTestnet)) {
    return {
      canSettle: false,
      blockingReason: `Switch wallet network to Stellar ${args.configuredNetwork} before settling.`,
    };
  }

  const verifiedWallet = normalizeWallet(args.verifiedWallet);
  const activeWallet = normalizeWallet(args.activeWalletAddress);
  if (!verifiedWallet || activeWallet !== verifiedWallet) {
    return {
      canSettle: false,
      blockingReason: "Authenticate the connected wallet for this admin session before settling.",
    };
  }

  const dispute = args.detail.dispute;
  if (!isSettlementReviewStatus(dispute.status)) {
    return {
      canSettle: false,
      blockingReason: "Settlement is unavailable because this dispute is no longer reviewable.",
    };
  }

  const isParticipant =
    activeWallet === normalizeWallet(dispute.clientWallet) ||
    activeWallet === normalizeWallet(dispute.freelancerWallet);
  if (isParticipant) {
    return {
      canSettle: false,
      blockingReason: "A dispute participant cannot settle their own case.",
    };
  }

  if (normalizeWallet(dispute.assignedAdminWallet) !== activeWallet) {
    return {
      canSettle: false,
      blockingReason: "Claim or receive assignment to this case before starting settlement.",
    };
  }

  if (dispute.onChainStatus !== "marked") {
    return {
      canSettle: false,
      blockingReason: "Settlement is unavailable until the dispute is marked on-chain.",
    };
  }

  if (!dispute.onChainEscrowId) {
    return {
      canSettle: false,
      blockingReason:
        "Settlement is unavailable because the on-chain escrow identifier is missing.",
    };
  }

  if (!args.detail.escrow) {
    return {
      canSettle: false,
      blockingReason: "Settlement is unavailable because the escrow mirror is missing.",
    };
  }

  if (args.detail.escrow.status !== "disputed") {
    return {
      canSettle: false,
      blockingReason: "Settlement is unavailable until the escrow mirror is disputed.",
    };
  }

  if (
    args.detail.settlementAttempts.some((attempt) =>
      isActiveSettlementAttemptStatus(attempt.status),
    )
  ) {
    return {
      canSettle: false,
      blockingReason:
        "Settlement is unavailable while a settlement attempt is pending reconciliation.",
    };
  }

  return { canSettle: true, blockingReason: null };
}
