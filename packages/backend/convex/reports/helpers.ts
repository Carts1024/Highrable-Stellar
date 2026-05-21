import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { TJobReportReason } from "./schema";

import {
  normalizeWalletAddress,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "../_shared/input";

const MAX_REPORT_DETAILS_LENGTH = 1000;

export function sanitizeReporterWallet(reporterWallet: string | undefined): string | undefined {
  if (reporterWallet === undefined) {
    return undefined;
  }

  return normalizeWalletAddress(reporterWallet);
}

export function sanitizeReportDetails(details: string | undefined): string | undefined {
  const sanitizedDetails = optionalNonEmptyString(details, "details");
  if (sanitizedDetails === undefined) {
    return undefined;
  }

  return sanitizedDetails.slice(0, MAX_REPORT_DETAILS_LENGTH);
}

export function sanitizeReportReason(reason: TJobReportReason): TJobReportReason {
  return requireNonEmptyString(reason, "reason") as TJobReportReason;
}

export async function getJobReportCountForJob(ctx: QueryCtx, jobId: Id<"jobs">): Promise<number> {
  const reports = await ctx.db
    .query("jobReports")
    .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
    .take(1000);

  return reports.length;
}
