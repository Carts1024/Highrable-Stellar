import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const jobStatusEnum = createStringEnum([
  "open",
  "selected",
  "funded",
  "submitted",
  "completed",
  "cancelled",
  "disputed",
] as const);

const jobTypeEnum = createStringEnum(["micro_gig", "milestone_project"] as const);

export const JOB_STATUSES = jobStatusEnum.map;
export const jobStatusValidator = jobStatusEnum.validator;
export const JOB_TYPES = jobTypeEnum.map;
export const jobTypeValidator = jobTypeEnum.validator;

export type TJobStatus = Infer<typeof jobStatusValidator>;
export type TJobType = Infer<typeof jobTypeValidator>;

export default defineTable({
  title: v.string(),
  description: v.string(),
  budget: v.number(),
  asset: v.string(),
  jobType: v.optional(jobTypeValidator),
  totalBudget: v.optional(v.number()),
  milestoneCount: v.optional(v.number()),
  clientWallet: v.string(),
  selectedFreelancerWallet: v.optional(v.string()),
  status: jobStatusValidator,
  jobHash: v.string(),
  createdAt: v.number(),
})
  .index("by_clientWallet", ["clientWallet"])
  .index("by_status", ["status"])
  .index("by_selectedFreelancerWallet", ["selectedFreelancerWallet"])
  .index("by_jobHash", ["jobHash"]);
