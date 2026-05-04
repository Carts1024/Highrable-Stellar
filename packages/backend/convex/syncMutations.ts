import { v } from "convex/values";

import type { TSyncResult } from "./sync";

import { internalMutation } from "./_generated/server";
import { getEscrowByEscrowId, getJobStatusFromEscrowStatus } from "./escrows/helpers";
import { escrowStatusValidator } from "./escrows/schema";
import { getStatusRank } from "./lib/stellarReads";

const TERMINAL_STATUSES = new Set(["released", "cancelled", "disputed"] as const);

function isSafeStatusUpdate(currentStatus: string, incomingStatus: string): boolean {
  if (currentStatus === incomingStatus) {
    return false;
  }

  if (TERMINAL_STATUSES.has(currentStatus as "released" | "cancelled" | "disputed")) {
    return false;
  }

  const currentRank = getStatusRank(currentStatus as Parameters<typeof getStatusRank>[0]);
  const incomingRank = getStatusRank(incomingStatus as Parameters<typeof getStatusRank>[0]);

  return incomingRank > currentRank;
}

export const applyEscrowStatusSync = internalMutation({
  args: {
    escrowId: v.string(),
    onChainStatus: escrowStatusValidator,
  },
  handler: async (ctx, args): Promise<TSyncResult> => {
    const escrow = await getEscrowByEscrowId(ctx, args.escrowId);
    if (!escrow) {
      return { ok: false, reason: "convex_escrow_not_found" };
    }

    const previousStatus = escrow.status;
    const incomingStatus = args.onChainStatus;

    if (previousStatus === incomingStatus) {
      return { ok: true, changed: false, escrowId: args.escrowId, newStatus: previousStatus };
    }

    if (!isSafeStatusUpdate(previousStatus, incomingStatus)) {
      return {
        ok: false,
        reason: "unsafe_status_downgrade",
        escrowId: args.escrowId,
        previousStatus,
        newStatus: incomingStatus,
      };
    }

    await ctx.db.patch(escrow._id, {
      status: incomingStatus,
      updatedAt: Date.now(),
    });

    if (incomingStatus !== "created") {
      const jobStatusPatch = getJobStatusFromEscrowStatus(
        incomingStatus as "funded" | "submitted" | "released" | "cancelled" | "disputed",
      );
      await ctx.db.patch(escrow.jobId, { status: jobStatusPatch });
    }

    return {
      ok: true,
      changed: true,
      escrowId: args.escrowId,
      previousStatus,
      newStatus: incomingStatus,
    };
  },
});

export const createReputationRecordFromSync = internalMutation({
  args: {
    escrowId: v.string(),
    clientWallet: v.string(),
    freelancerWallet: v.string(),
    rating: v.number(),
    reviewHash: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<TSyncResult> => {
    const escrow = await getEscrowByEscrowId(ctx, args.escrowId);
    if (!escrow) {
      return { ok: false, reason: "convex_escrow_not_found" };
    }

    if (escrow.status !== "released") {
      return { ok: false, reason: "escrow_not_released" };
    }

    const existingRecord = await ctx.db
      .query("reputationRecords")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", args.escrowId))
      .unique();

    if (existingRecord) {
      return { ok: true, changed: false, reason: "already_exists", escrowId: args.escrowId };
    }

    await ctx.db.insert("reputationRecords", {
      escrowId: args.escrowId,
      jobId: escrow.jobId,
      clientWallet: args.clientWallet,
      freelancerWallet: args.freelancerWallet,
      amount: escrow.amount,
      rating: args.rating,
      createdAt: Date.now(),
      ...(args.reviewHash !== undefined ? { reviewHash: args.reviewHash } : {}),
    });

    return { ok: true, changed: true, escrowId: args.escrowId };
  },
});
