import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { TDisputeStatus } from "../disputes/schema";

import { BadRequestError, NotFoundError } from "../_shared/errors";
import { optionalNonEmptyString, requireRangeNumber } from "../_shared/input";
import { assertAdminApiSecret, assertConfiguredAdminWallet } from "../_shared/adminAuth";

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

export function assertAdminContext(args: {
  adminWallet: string;
  adminApiSecret: string;
}): string {
  assertAdminApiSecret(args.adminApiSecret);
  return assertConfiguredAdminWallet(args.adminWallet);
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

export function resolveFreelancerShareBps(
  status: TAdminResolutionStatus,
  freelancerShareBps: number,
): number {
  const normalizedShare = requireRangeNumber(
    freelancerShareBps,
    "freelancerShareBps",
    0,
    10_000,
  );

  if (status === "resolved_client" && normalizedShare !== 0) {
    throw new BadRequestError("Client resolution must use freelancerShareBps = 0.");
  }

  if (status === "resolved_freelancer" && normalizedShare !== 10_000) {
    throw new BadRequestError("Freelancer resolution must use freelancerShareBps = 10000.");
  }

  if (status === "split_resolution" && (normalizedShare <= 0 || normalizedShare >= 10_000)) {
    throw new BadRequestError(
      "Split resolution must use freelancerShareBps between 1 and 9999.",
    );
  }

  return normalizedShare;
}

export function assertDisputeCanEnterReviewFlow(status: TDisputeStatus): void {
  if (status === "resolved_client" || status === "resolved_freelancer" || status === "split_resolution") {
    throw new BadRequestError("This dispute is already resolved.");
  }

  if (status === "cancelled") {
    throw new BadRequestError("Cancelled disputes cannot be reviewed.");
  }
}
