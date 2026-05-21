import { defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

import { createStringEnum } from "../_shared/enum";
import { walletTypeValidator } from "../users/schema";
import { workSubmissionParentTypeValidator } from "../work_submissions/schema";

const revisionRequestStatusEnum = createStringEnum([
  "requested",
  "acknowledged",
  "revision_submitted",
  "accepted",
  "cancelled",
  "expired",
] as const);

export const REVISION_REQUEST_STATUSES = revisionRequestStatusEnum.map;
export const revisionRequestStatusValidator = revisionRequestStatusEnum.validator;

export type TRevisionRequestStatus = Infer<typeof revisionRequestStatusValidator>;

export default defineTable({
  parentType: workSubmissionParentTypeValidator,
  parentId: v.string(),
  jobId: v.optional(v.id("jobs")),
  milestoneId: v.optional(v.id("milestones")),
  escrowId: v.optional(v.id("escrows")),
  workSubmissionId: v.id("workSubmissions"),
  previousSubmissionId: v.optional(v.id("workSubmissions")),
  revisionSubmissionId: v.optional(v.id("workSubmissions")),
  agreementId: v.optional(v.id("workAgreements")),
  agreementVersionId: v.optional(v.id("workAgreementVersions")),
  agreementHash: v.optional(v.string()),
  clientWallet: v.string(),
  freelancerWallet: v.string(),
  requestedByWallet: v.string(),
  requestedByWalletType: walletTypeValidator,
  revisionNumber: v.number(),
  reason: v.string(),
  requestedChanges: v.string(),
  attachmentIds: v.array(v.id("attachments")),
  status: revisionRequestStatusValidator,
  deadlineAt: v.optional(v.number()),
  requestedAt: v.number(),
  respondedAt: v.optional(v.number()),
  resolvedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_parent", ["parentType", "parentId", "status"])
  .index("by_workSubmission", ["workSubmissionId", "status"])
  .index("by_job", ["jobId", "status"])
  .index("by_milestone", ["milestoneId", "status"])
  .index("by_escrow", ["escrowId", "status"])
  .index("by_client", ["clientWallet", "requestedAt"])
  .index("by_freelancer", ["freelancerWallet", "requestedAt"]);
