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

export const JOB_STATUSES = jobStatusEnum.map;
export const jobStatusValidator = jobStatusEnum.validator;

export type TJobStatus = Infer<typeof jobStatusValidator>;

export default defineTable({
  title: v.string(),
  description: v.string(),
  budget: v.number(),
  asset: v.string(),
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
