import { isTerminalDisputeStatus } from "@/features/disputes/lib";

import type { IAdminDisputeDetail, IAdminDisputeListItem } from "@/features/admin/types";

type TDisputeAssignmentSubject = Pick<
  IAdminDisputeListItem | IAdminDisputeDetail["dispute"],
  "clientWallet" | "freelancerWallet" | "assignedAdminWallet" | "status"
>;

export function normalizeAdminWallet(wallet: string | null | undefined): string {
  return wallet?.trim().toUpperCase() ?? "";
}

export function dedupeAdminWallets(wallets: readonly (string | null | undefined)[]): string[] {
  const uniqueWallets = new Set<string>();

  for (const wallet of wallets) {
    const normalizedWallet = normalizeAdminWallet(wallet);
    if (normalizedWallet) {
      uniqueWallets.add(normalizedWallet);
    }
  }

  return [...uniqueWallets];
}

export function isDisputeParticipant(
  dispute: Pick<TDisputeAssignmentSubject, "clientWallet" | "freelancerWallet">,
  wallet: string | null | undefined,
): boolean {
  const normalizedWallet = normalizeAdminWallet(wallet);
  return (
    normalizedWallet.length > 0 &&
    (normalizedWallet === normalizeAdminWallet(dispute.clientWallet) ||
      normalizedWallet === normalizeAdminWallet(dispute.freelancerWallet))
  );
}

export function canClaimAdminDispute(
  dispute: Pick<
    TDisputeAssignmentSubject,
    "assignedAdminWallet" | "status" | "clientWallet" | "freelancerWallet"
  >,
  verifiedWallet: string,
): boolean {
  const normalizedWallet = normalizeAdminWallet(verifiedWallet);
  return (
    normalizedWallet.length > 0 &&
    !normalizeAdminWallet(dispute.assignedAdminWallet) &&
    !isDisputeParticipant(dispute, normalizedWallet) &&
    !isTerminalDisputeStatus(dispute.status)
  );
}

export function canOwnerAssignAdminDispute(
  dispute: Pick<TDisputeAssignmentSubject, "clientWallet" | "freelancerWallet">,
  verifiedWallet: string,
  isOwner: boolean,
): boolean {
  const normalizedWallet = normalizeAdminWallet(verifiedWallet);
  return isOwner && normalizedWallet.length > 0 && !isDisputeParticipant(dispute, normalizedWallet);
}

export function getEligibleAdminWallets(
  dispute: Pick<TDisputeAssignmentSubject, "clientWallet" | "freelancerWallet">,
  wallets: readonly (string | null | undefined)[],
): string[] {
  const participantWallets = new Set([
    normalizeAdminWallet(dispute.clientWallet),
    normalizeAdminWallet(dispute.freelancerWallet),
  ]);

  return dedupeAdminWallets(wallets).filter((wallet) => !participantWallets.has(wallet));
}
