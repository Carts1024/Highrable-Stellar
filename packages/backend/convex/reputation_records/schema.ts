import { defineTable } from "convex/server";
import { v } from "convex/values";

export default defineTable({
  escrowId: v.string(),
  jobId: v.id("jobs"),
  clientWallet: v.string(),
  freelancerWallet: v.string(),
  amount: v.number(),
  rating: v.number(),
  reviewText: v.optional(v.string()),
  reviewHash: v.optional(v.string()),
  txHash: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_escrowId", ["escrowId"])
  .index("by_jobId", ["jobId"])
  .index("by_freelancerWallet", ["freelancerWallet"])
  .index("by_clientWallet", ["clientWallet"]);
