import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { assertReputationCreationAllowed, sanitizeReputationInput } from "./helpers";

export const createReputationRecord = mutation({
  args: {
    escrowId: v.string(),
    jobId: v.id("jobs"),
    clientWallet: v.string(),
    freelancerWallet: v.string(),
    amount: v.number(),
    rating: v.number(),
    reviewText: v.optional(v.string()),
    reviewHash: v.optional(v.string()),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sanitizedArgs = sanitizeReputationInput(args);
    await assertReputationCreationAllowed(ctx, {
      escrowId: sanitizedArgs.escrowId,
      jobId: args.jobId,
    });

    return await ctx.db.insert("reputationRecords", {
      escrowId: sanitizedArgs.escrowId,
      jobId: args.jobId,
      clientWallet: sanitizedArgs.clientWallet,
      freelancerWallet: sanitizedArgs.freelancerWallet,
      amount: sanitizedArgs.amount,
      rating: sanitizedArgs.rating,
      createdAt: Date.now(),
      ...(sanitizedArgs.reviewText !== undefined ? { reviewText: sanitizedArgs.reviewText } : {}),
      ...(sanitizedArgs.reviewHash !== undefined ? { reviewHash: sanitizedArgs.reviewHash } : {}),
      ...(sanitizedArgs.txHash !== undefined ? { txHash: sanitizedArgs.txHash } : {}),
    });
  },
});
