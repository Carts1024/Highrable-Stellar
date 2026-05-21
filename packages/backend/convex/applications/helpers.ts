import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress, requireNonEmptyString } from "../_shared/input";
import { getJobType } from "../jobs/helpers";
import { assertMilestoneAcceptsApplications } from "../milestones/helpers";

export function sanitizeApplicationWallet(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export function sanitizeProposal(proposal: string): string {
  return requireNonEmptyString(proposal, "proposal");
}

export function sanitizeShowcasedWorkEscrowId(
  showcasedWorkEscrowId: string | undefined,
): string | undefined {
  if (showcasedWorkEscrowId === undefined) {
    return undefined;
  }

  return requireNonEmptyString(showcasedWorkEscrowId, "showcasedWorkEscrowId");
}

export async function validateShowcasedWorkEscrowId(
  ctx: QueryCtx,
  freelancerWallet: string,
  showcasedWorkEscrowId: string | undefined,
): Promise<string | undefined> {
  if (showcasedWorkEscrowId === undefined) {
    return undefined;
  }

  const showcasedEscrow = await ctx.db
    .query("escrows")
    .withIndex("by_escrowId", (q) => q.eq("escrowId", showcasedWorkEscrowId))
    .unique();

  if (!showcasedEscrow) {
    throw new NotFoundError("Showcased work not found.");
  }

  if (showcasedEscrow.status !== "released") {
    throw new ForbiddenError("Only completed paid work can be showcased.");
  }

  if (showcasedEscrow.freelancerWallet !== freelancerWallet) {
    throw new ForbiddenError("Freelancer can only showcase their own completed work.");
  }

  return showcasedEscrow.escrowId;
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

  if (getJobType(job) !== "micro_gig") {
    throw new ForbiddenError("Apply to a specific milestone for milestone projects.");
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

export async function assertCanApplyToMilestone(
  ctx: QueryCtx,
  jobId: Id<"jobs">,
  milestoneId: Id<"milestones">,
  freelancerWallet: string,
): Promise<void> {
  const [job, milestone] = await Promise.all([ctx.db.get(jobId), ctx.db.get(milestoneId)]);

  if (!job) {
    throw new NotFoundError("Job not found.");
  }

  if (!milestone) {
    throw new NotFoundError("Milestone not found.");
  }

  if (getJobType(job) !== "milestone_project") {
    throw new ForbiddenError("Milestone applications are only available for milestone projects.");
  }

  if (milestone.jobId !== jobId) {
    throw new ForbiddenError("Milestone does not belong to this job.");
  }

  if (milestone.status !== "open") {
    throw new ForbiddenError("Applications are only allowed for open milestones.");
  }

  await assertMilestoneAcceptsApplications(ctx, milestone);

  if (job.clientWallet === freelancerWallet) {
    throw new ForbiddenError("Client cannot apply to their own milestone.");
  }

  const existingApplication = await ctx.db
    .query("applications")
    .withIndex("by_milestoneId_and_freelancerWallet", (q) =>
      q.eq("milestoneId", milestoneId).eq("freelancerWallet", freelancerWallet),
    )
    .unique();

  if (existingApplication) {
    throw new ConflictError("Freelancer already applied to this milestone.");
  }
}
