import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { NotFoundError } from "../_shared/errors";
import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
  requirePositiveNumber,
} from "../_shared/input";

export function createFallbackJobHash(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `job_${Date.now()}_${randomPart}`;
}

export function sanitizeCreateJobArgs(args: {
  title: string;
  description: string;
  budget: number;
  asset: string;
  clientWallet: string;
  jobHash?: string;
}) {
  return {
    title: requireNonEmptyString(args.title, "title"),
    description: requireNonEmptyString(args.description, "description"),
    budget: requirePositiveNumber(args.budget, "budget"),
    asset: requireNonEmptyString(args.asset, "asset"),
    clientWallet: normalizeWalletAddress(args.clientWallet),
    jobHash: optionalNonEmptyString(args.jobHash, "jobHash") ?? createFallbackJobHash(),
  };
}

export function getJobType(job: { jobType?: "micro_gig" | "milestone_project" }) {
  return job.jobType ?? "micro_gig";
}

export async function getJobOrThrow(ctx: QueryCtx, jobId: Id<"jobs">) {
  const job = await ctx.db.get(jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }

  return job;
}

export function sanitizeFreelancerWallet(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}

export function sanitizeClientWallet(walletAddress: string): string {
  return normalizeWalletAddress(walletAddress);
}
