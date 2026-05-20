import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";

const jobStatusEnum = createStringEnum([
  "open",
  "selected",
  "funded",
  "submitted",
  "revision_requested",
  "revision_submitted",
  "completed",
  "cancelled",
  "disputed",
] as const);

const jobTypeEnum = createStringEnum(["micro_gig", "milestone_project"] as const);
const revisionPolicyEnum = createStringEnum(["none", "fixed", "unlimited"] as const);
const revisionStatusEnum = createStringEnum([
  "none",
  "revision_requested",
  "revision_submitted",
  "revision_resolved",
] as const);
const deadlineStatusEnum = createStringEnum([
  "no_deadline",
  "upcoming",
  "due_soon",
  "due_very_soon",
  "overdue",
  "submitted_on_time",
  "submitted_late",
  "completed_on_time",
  "completed_late",
  "cancelled",
  "disputed",
  "released",
] as const);

export const JOB_STATUSES = jobStatusEnum.map;
export const jobStatusValidator = jobStatusEnum.validator;
export const JOB_TYPES = jobTypeEnum.map;
export const jobTypeValidator = jobTypeEnum.validator;
export const REVISION_POLICIES = revisionPolicyEnum.map;
export const revisionPolicyValidator = revisionPolicyEnum.validator;
export const REVISION_STATUSES = revisionStatusEnum.map;
export const revisionStatusValidator = revisionStatusEnum.validator;
export const DEADLINE_STATUSES = deadlineStatusEnum.map;
export const deadlineStatusValidator = deadlineStatusEnum.validator;

export type TJobStatus = Infer<typeof jobStatusValidator>;
export type TJobType = Infer<typeof jobTypeValidator>;
export type TRevisionPolicy = Infer<typeof revisionPolicyValidator>;
export type TRevisionStatus = Infer<typeof revisionStatusValidator>;
export type TDeadlineStatus = Infer<typeof deadlineStatusValidator>;

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
  deadlineAt: v.optional(v.number()),
  deadlineStatus: v.optional(deadlineStatusValidator),
  deadlineReminderState: v.optional(v.any()),
  revisionPolicy: v.optional(revisionPolicyValidator),
  revisionLimit: v.optional(v.union(v.number(), v.null())),
  revisionCount: v.optional(v.number()),
  activeRevisionId: v.optional(v.id("revisionRequests")),
  lastRevisionRequestedAt: v.optional(v.number()),
  revisionStatus: v.optional(revisionStatusValidator),
  submittedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  approvedAt: v.optional(v.number()),
  overdueAt: v.optional(v.number()),
  jobHash: v.string(),
  createdAt: v.number(),
})
  .index("by_clientWallet", ["clientWallet"])
  .index("by_status", ["status"])
  .index("by_selectedFreelancerWallet", ["selectedFreelancerWallet"])
  .index("by_jobHash", ["jobHash"])
  .index("by_deadlineAt", ["deadlineAt"]);
