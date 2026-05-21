import { defineTable } from "convex/server";
import { v } from "convex/values";

export default defineTable({
  jobId: v.id("jobs"),
  milestoneId: v.optional(v.id("milestones")),
  freelancerWallet: v.string(),
  proposal: v.string(),
  showcasedWorkEscrowId: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_jobId", ["jobId"])
  .index("by_milestoneId", ["milestoneId"])
  .index("by_freelancerWallet", ["freelancerWallet"])
  .index("by_jobId_and_freelancerWallet", ["jobId", "freelancerWallet"])
  .index("by_milestoneId_and_freelancerWallet", ["milestoneId", "freelancerWallet"]);
