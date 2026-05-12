import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress, requireNonEmptyString } from "../_shared/input";

export function sanitizeApplicationWallet(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export function sanitizeProposal(proposal: string): string {
  return requireNonEmptyString(proposal, "proposal");
}

export async function assertCanApplyToJob(
  ctx: QueryCtx,
  jobId: Id<"jobs">,
  freelancerWallet: string,
): Promise<void> {
  const job = await ctx.db.get(jobId);

  if (!job) {
    throw new NotFoundError("Job not found.");
  }

  const isFundedAndUnassigned = job.status === "funded" && !job.selectedFreelancerWallet;
  if (job.status !== "open" && !isFundedAndUnassigned) {
    throw new ForbiddenError("Applications are only allowed for open jobs.");
  }

  if (job.clientWallet === freelancerWallet) {
    throw new ForbiddenError("Client cannot apply to their own job.");
  }

  const existingApplication = await ctx.db
    .query("applications")
    .withIndex("by_jobId_and_freelancerWallet", (q) =>
      q.eq("jobId", jobId).eq("freelancerWallet", freelancerWallet),
    )
    .unique();

  if (existingApplication) {
    throw new ConflictError("Freelancer already applied to this job.");
  }
}
