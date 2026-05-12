import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const jobReportReasonEnum = createStringEnum([
  "scam",
  "off_platform",
  "spam",
  "fake_job",
  "other",
] as const);

export const JOB_REPORT_REASONS = jobReportReasonEnum.map;
export const jobReportReasonValidator = jobReportReasonEnum.validator;

export type TJobReportReason = Infer<typeof jobReportReasonValidator>;

export default defineTable({
  jobId: v.id("jobs"),
  reporterWallet: v.optional(v.string()),
  reason: jobReportReasonValidator,
  details: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_jobId", ["jobId"])
  .index("by_reporterWallet", ["reporterWallet"])
  .index("by_reason", ["reason"])
  .index("by_jobId_and_reporterWallet", ["jobId", "reporterWallet"]);
