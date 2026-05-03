import { defineTable } from "convex/server";
import { v } from "convex/values";

export default defineTable({
  jobId: v.id("jobs"),
  freelancerWallet: v.string(),
  proposal: v.string(),
  createdAt: v.number(),
})
  .index("by_jobId", ["jobId"])
  .index("by_freelancerWallet", ["freelancerWallet"])
  .index("by_jobId_and_freelancerWallet", ["jobId", "freelancerWallet"]);
