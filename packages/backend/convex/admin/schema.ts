import { defineTable } from "convex/server";
import { v } from "convex/values";

export const disputeAdmins = defineTable({
  network: v.string(),
  contractId: v.string(),
  wallet: v.string(),
  accessState: v.union(v.literal("active"), v.literal("revoking"), v.literal("revoked")),
  grantedByWallet: v.optional(v.string()),
  grantedAt: v.optional(v.number()),
  updatedAt: v.number(),
  revokedByWallet: v.optional(v.string()),
  revokedAt: v.optional(v.number()),
  lastOperationId: v.optional(v.string()),
})
  .index("by_scope_wallet", ["network", "contractId", "wallet"])
  .index("by_scope_access", ["network", "contractId", "accessState"]);

export const disputeAdminOperations = defineTable({
  network: v.string(),
  contractId: v.string(),
  wallet: v.string(),
  action: v.union(v.literal("grant"), v.literal("revoke")),
  status: v.union(
    v.literal("awaiting_signature"),
    v.literal("submitted"),
    v.literal("submission_unknown"),
    v.literal("succeeded"),
    v.literal("failed"),
  ),
  actorWallet: v.string(),
  operationId: v.string(),
  transactionHash: v.optional(v.string()),
  transactionValidUntil: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_operationId", ["operationId"])
  .index("by_scope_wallet_createdAt", ["network", "contractId", "wallet", "createdAt"])
  .index("by_scope_status_createdAt", ["network", "contractId", "status", "createdAt"]);

export const disputeAssignmentEvents = defineTable({
  disputeId: v.id("disputes"),
  type: v.union(v.literal("claimed"), v.literal("released"), v.literal("owner_reassignment")),
  actorWallet: v.string(),
  previousAdminWallet: v.optional(v.string()),
  assignedAdminWallet: v.optional(v.string()),
  createdAt: v.number(),
  operationId: v.optional(v.string()),
})
  .index("by_dispute", ["disputeId", "createdAt"])
  .index("by_actor", ["actorWallet", "createdAt"]);

export const settlementAttempts = defineTable({
  disputeId: v.id("disputes"),
  escrowDocumentId: v.id("escrows"),
  onChainEscrowId: v.string(),
  network: v.string(),
  contractId: v.string(),
  actorWallet: v.string(),
  status: v.union(
    v.literal("started"),
    v.literal("signed"),
    v.literal("submission_unknown"),
    v.literal("submitted"),
    v.literal("succeeded"),
    v.literal("failed"),
  ),
  resolutionStatus: v.union(
    v.literal("resolved_client"),
    v.literal("resolved_freelancer"),
    v.literal("split_resolution"),
  ),
  freelancerShareBps: v.number(),
  resolutionNote: v.optional(v.string()),
  operationId: v.string(),
  transactionHash: v.optional(v.string()),
  transactionValidUntil: v.optional(v.number()),
  transactionId: v.optional(v.id("transactions")),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index("by_operationId", ["operationId"])
  .index("by_dispute_createdAt", ["disputeId", "createdAt"])
  .index("by_escrow_status", ["escrowDocumentId", "status"])
  .index("by_scope_status_createdAt", ["network", "contractId", "status", "createdAt"]);
