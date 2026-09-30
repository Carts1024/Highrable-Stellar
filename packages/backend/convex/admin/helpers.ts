import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TDisputeStatus } from "../disputes/schema";

import {
  assertAdminApiSecret,
  assertConfiguredAdminWallet,
  isConfiguredAdminWallet,
} from "../_shared/adminAuth";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { optionalNonEmptyString, requireRangeNumber } from "../_shared/input";

export const ADMIN_REVIEW_STATUSES = [
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
] as const;

export const ADMIN_RESOLUTION_STATUSES = [
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
] as const;

export type TAdminReviewStatus = (typeof ADMIN_REVIEW_STATUSES)[number];
export type TAdminResolutionStatus = (typeof ADMIN_RESOLUTION_STATUSES)[number];

export function assertAdminContext(args: { adminWallet: string; adminApiSecret: string }): string {
  assertAdminApiSecret(args.adminApiSecret);
  return assertConfiguredAdminWallet(args.adminWallet);
}

export function getAdminScope(): { network: string; contractId: string } {
  const network = process.env.STELLAR_NETWORK?.trim().toLowerCase();
  const contractId = process.env.ESCROW_CONTRACT_ID?.trim();
  if (!network || !contractId) {
    throw new ForbiddenError("Dispute admin network and escrow contract scope are not configured.");
  }

  return { network, contractId };
}

export async function assertDisputeAdminContext(
  ctx: QueryCtx | MutationCtx,
  args: { adminWallet: string; adminApiSecret: string },
): Promise<string> {
  assertAdminApiSecret(args.adminApiSecret);
  const wallet = args.adminWallet.trim().toUpperCase();
  if (isConfiguredAdminWallet(wallet)) {
    return wallet;
  }

  const scope = getAdminScope();
  const membership = await ctx.db
    .query("disputeAdmins")
    .withIndex("by_scope_wallet", (q) =>
      q.eq("network", scope.network).eq("contractId", scope.contractId).eq("wallet", wallet),
    )
    .unique();
  if (membership?.accessState !== "active") {
    throw new ForbiddenError("Active dispute admin access is required.");
  }

  return wallet;
}

export function assertDisputeActorIsNotParticipant(
  actorWallet: string,
  dispute: Doc<"disputes">,
): void {
  const actor = actorWallet.trim().toUpperCase();
  if (
    actor === dispute.clientWallet.trim().toUpperCase() ||
    actor === dispute.freelancerWallet.trim().toUpperCase()
  ) {
    throw new ForbiddenError("A dispute participant cannot moderate or settle their own case.");
  }
}

export function assertAssignedDisputeAdmin(actorWallet: string, dispute: Doc<"disputes">): void {
  assertDisputeActorIsNotParticipant(actorWallet, dispute);
  if (dispute.assignedAdminWallet?.trim().toUpperCase() !== actorWallet.trim().toUpperCase()) {
    throw new ForbiddenError("Only the assigned dispute admin can act on this case.");
  }
}

export async function assertNoActiveSettlement(
  ctx: MutationCtx,
  dispute: Doc<"disputes">,
): Promise<void> {
  const escrow = dispute.escrowId ? await ctx.db.get(dispute.escrowId) : null;
  if (!escrow) {
    return;
  }

  const active = await Promise.all(
    (["started", "signed", "submission_unknown", "submitted"] as const).map((status) =>
      ctx.db
        .query("settlementAttempts")
        .withIndex("by_escrow_status", (q) =>
          q.eq("escrowDocumentId", escrow._id).eq("status", status),
        )
        .first(),
    ),
  );
  if (active.some(Boolean)) {
    throw new ConflictError(
      "Case assignment is locked while settlement is pending reconciliation.",
    );
  }
}

export async function getDisputeOrThrow(
  ctx: QueryCtx | MutationCtx,
  disputeId: Id<"disputes">,
): Promise<Doc<"disputes">> {
  const dispute = await ctx.db.get(disputeId);
  if (!dispute) {
    throw new NotFoundError("Dispute not found.");
  }

  return dispute;
}

export function sanitizeResolutionNote(note: string | undefined): string | undefined {
  return optionalNonEmptyString(note, "resolutionNote")?.slice(0, 2000);
}

const STELLAR_TRANSACTION_HASH_PATTERN = /^[0-9a-f]{64}$/i;

export function normalizeSettlementOperationId(operationId: string): string {
  return optionalNonEmptyString(operationId, "operationId")!;
}

export function normalizeSettlementTransactionHash(
  transactionHash: string,
  fieldName = "transactionHash",
): string {
  const normalizedHash = optionalNonEmptyString(transactionHash, fieldName);
  if (!normalizedHash || !STELLAR_TRANSACTION_HASH_PATTERN.test(normalizedHash)) {
    throw new BadRequestError(`${fieldName} must be a 64-character hexadecimal hash.`);
  }

  return normalizedHash.toLowerCase();
}

export function normalizeOptionalSettlementTransactionHash(
  transactionHash: string | undefined,
  fieldName = "transactionHash",
): string | undefined {
  return transactionHash === undefined
    ? undefined
    : normalizeSettlementTransactionHash(transactionHash, fieldName);
}

export function requireSettlementExpiry(transactionValidUntil: number): number {
  if (!Number.isSafeInteger(transactionValidUntil) || transactionValidUntil <= 0) {
    throw new BadRequestError("transactionValidUntil must be a positive safe integer.");
  }

  return transactionValidUntil;
}

export function resolveFreelancerShareBps(
  status: TAdminResolutionStatus,
  freelancerShareBps: number,
): number {
  if (!Number.isSafeInteger(freelancerShareBps)) {
    throw new BadRequestError("freelancerShareBps must be an integer.");
  }

  const normalizedShare = requireRangeNumber(freelancerShareBps, "freelancerShareBps", 0, 10_000);

  if (status === "resolved_client" && normalizedShare !== 0) {
    throw new BadRequestError("Client resolution must use freelancerShareBps = 0.");
  }

  if (status === "resolved_freelancer" && normalizedShare !== 10_000) {
    throw new BadRequestError("Freelancer resolution must use freelancerShareBps = 10000.");
  }

  if (status === "split_resolution" && (normalizedShare <= 0 || normalizedShare >= 10_000)) {
    throw new BadRequestError("Split resolution must use freelancerShareBps between 1 and 9999.");
  }

  return normalizedShare;
}

export function assertDisputeCanEnterReviewFlow(status: TDisputeStatus): void {
  if (
    status === "resolved_client" ||
    status === "resolved_freelancer" ||
    status === "split_resolution"
  ) {
    throw new BadRequestError("This dispute is already resolved.");
  }

  if (status === "cancelled") {
    throw new BadRequestError("Cancelled disputes cannot be reviewed.");
  }
}
