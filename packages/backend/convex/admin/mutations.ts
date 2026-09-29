import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { TEscrowStatus, TEscrowTransactionType } from "../escrows/schema";
import type { TWalletType } from "../users/schema";

import { mutation } from "../_generated/server";
import { isConfiguredAdminWallet } from "../_shared/adminAuth";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress, optionalNonEmptyString } from "../_shared/input";
import {
  computeDeadlineStatus,
  resolveDeadlineParent,
  upsertDeadlineReminders,
} from "../deadlines/helpers";
import {
  createDisputeEvent,
  createDisputeNotification,
  createDisputeSystemMessage,
  getStellarExpertUrl,
  sanitizeDisputeMessage,
} from "../disputes/helpers";
import { getJobStatusFromEscrowStatus } from "../escrows/helpers";
import { patchMilestoneForEscrowStatus } from "../milestones/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  ADMIN_RESOLUTION_STATUSES,
  ADMIN_REVIEW_STATUSES,
  assertAdminContext,
  assertAssignedDisputeAdmin,
  assertDisputeActorIsNotParticipant,
  assertDisputeAdminContext,
  assertDisputeCanEnterReviewFlow,
  assertNoActiveSettlement,
  getAdminScope,
  getDisputeOrThrow,
  resolveFreelancerShareBps,
  sanitizeResolutionNote,
  type TAdminResolutionStatus,
  type TAdminReviewStatus,
} from "./helpers";

const DEFAULT_ADMIN_WALLET_TYPE: TWalletType = "external_wallet";

function mergeMetadata(
  previousMetadata: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(typeof previousMetadata === "object" && previousMetadata !== null
      ? (previousMetadata as Record<string, unknown>)
      : {}),
    ...patch,
  };
}

function getResolutionEventType(status: TAdminResolutionStatus) {
  if (status === "resolved_client") {
    return "resolved_client" as const;
  }

  if (status === "resolved_freelancer") {
    return "resolved_freelancer" as const;
  }

  return "split_resolution" as const;
}

function getEscrowSettlement(status: TAdminResolutionStatus): {
  escrowStatus: Extract<TEscrowStatus, "released" | "cancelled">;
  txType: TEscrowTransactionType;
} {
  if (status === "resolved_client") {
    return {
      escrowStatus: "cancelled",
      txType: "cancel_escrow",
    };
  }

  return {
    escrowStatus: "released",
    txType: "release_payment",
  };
}

function getEscrowTxHashField(txType: TEscrowTransactionType): "releaseTxHash" | "cancelTxHash" {
  return txType === "release_payment" ? "releaseTxHash" : "cancelTxHash";
}

function computeResolutionAmounts(
  totalAmount: number,
  freelancerShareBps: number,
): {
  freelancerPayoutAmount: number;
  clientRefundAmount: number;
} {
  const freelancerPayoutAmount = Math.trunc((totalAmount * freelancerShareBps) / 10_000);
  const clientRefundAmount = totalAmount - freelancerPayoutAmount;

  return {
    freelancerPayoutAmount,
    clientRefundAmount,
  };
}

async function notifyParticipants(
  ctx: MutationCtx,
  dispute: Doc<"disputes">,
  title: string,
  body: string,
  metadata?: unknown,
): Promise<void> {
  await createDisputeNotification(ctx, {
    dispute,
    recipientWallet: dispute.clientWallet,
    type: "dispute_status_changed",
    title,
    body,
    ...(metadata !== undefined ? { metadata } : {}),
  });

  await createDisputeNotification(ctx, {
    dispute,
    recipientWallet: dispute.freelancerWallet,
    type: "dispute_status_changed",
    title,
    body,
    ...(metadata !== undefined ? { metadata } : {}),
  });
}

async function assertDisputeCanResolve(ctx: MutationCtx, dispute: Doc<"disputes">) {
  if (!dispute.escrowId) {
    throw new BadRequestError("Dispute escrow context is missing.");
  }

  const escrow = await ctx.db.get(dispute.escrowId);
  if (!escrow) {
    throw new NotFoundError("Escrow not found for dispute.");
  }

  if (escrow.status !== "disputed") {
    throw new BadRequestError("Escrow must be disputed before settlement.");
  }

  return escrow;
}

function isActiveSettlementStatus(status: string): boolean {
  return !["succeeded", "failed"].includes(status);
}

function getActiveOperationError(): ConflictError {
  return new ConflictError("A membership operation is already pending for this wallet.");
}

export const claimDispute = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    disputeId: v.id("disputes"),
  },
  handler: async (ctx, args) => {
    const adminWallet = await assertDisputeAdminContext(ctx, args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertDisputeCanEnterReviewFlow(dispute.status);
    assertDisputeActorIsNotParticipant(adminWallet, dispute);
    if (dispute.assignedAdminWallet) {
      throw new ConflictError("This case has already been claimed.");
    }

    const now = Date.now();
    await ctx.db.patch(dispute._id, {
      assignedAdminWallet: adminWallet,
      assignedAt: now,
      assignedByWallet: adminWallet,
      updatedAt: now,
    });
    await ctx.db.insert("disputeAssignmentEvents", {
      disputeId: dispute._id,
      type: "claimed",
      actorWallet: adminWallet,
      assignedAdminWallet: adminWallet,
      createdAt: now,
    });
    return { assignedAdminWallet: adminWallet };
  },
});

export const assignDispute = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    disputeId: v.id("disputes"),
    assignedAdminWallet: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const ownerWallet = assertAdminContext(args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertDisputeActorIsNotParticipant(ownerWallet, dispute);
    const nextWallet = args.assignedAdminWallet
      ? normalizeWalletAddress(args.assignedAdminWallet)
      : null;
    const previousWallet = dispute.assignedAdminWallet?.trim().toUpperCase() ?? null;
    if (nextWallet === previousWallet) {
      return { assignedAdminWallet: previousWallet };
    }

    await assertNoActiveSettlement(ctx, dispute);
    if (nextWallet) {
      assertDisputeActorIsNotParticipant(nextWallet, dispute);
      if (!isConfiguredAdminWallet(nextWallet)) {
        const scope = getAdminScope();
        const membership = await ctx.db
          .query("disputeAdmins")
          .withIndex("by_scope_wallet", (q) =>
            q
              .eq("network", scope.network)
              .eq("contractId", scope.contractId)
              .eq("wallet", nextWallet),
          )
          .unique();
        if (membership?.accessState !== "active") {
          throw new ForbiddenError("Cases can only be assigned to an active dispute admin.");
        }
      }
    }

    const now = Date.now();
    await ctx.db.patch(dispute._id, {
      assignedAdminWallet: nextWallet ?? undefined,
      assignedAt: nextWallet ? now : undefined,
      assignedByWallet: nextWallet ? ownerWallet : undefined,
      updatedAt: now,
    });
    await ctx.db.insert("disputeAssignmentEvents", {
      disputeId: dispute._id,
      type: nextWallet ? "owner_reassignment" : "released",
      actorWallet: ownerWallet,
      ...(previousWallet ? { previousAdminWallet: previousWallet } : {}),
      ...(nextWallet ? { assignedAdminWallet: nextWallet } : {}),
      createdAt: now,
    });
    return { assignedAdminWallet: nextWallet };
  },
});

export const startDisputeAdminOperation = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    wallet: v.string(),
    action: v.union(v.literal("grant"), v.literal("revoke")),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerWallet = assertAdminContext(args);
    const wallet = normalizeWalletAddress(args.wallet);
    const operationId = optionalNonEmptyString(args.operationId, "operationId")!;
    if (wallet === ownerWallet) {
      throw new BadRequestError(
        "The platform owner is implicitly authorized and cannot be changed.",
      );
    }

    const scope = getAdminScope();
    const duplicate = await ctx.db
      .query("disputeAdminOperations")
      .withIndex("by_operationId", (q) => q.eq("operationId", operationId))
      .unique();
    if (duplicate) {
      if (duplicate.wallet !== wallet || duplicate.action !== args.action) {
        throw new ConflictError(
          "The operation ID is already used for a different membership change.",
        );
      }
      return duplicate;
    }

    const walletOperations = await ctx.db
      .query("disputeAdminOperations")
      .withIndex("by_scope_wallet_createdAt", (q) =>
        q.eq("network", scope.network).eq("contractId", scope.contractId).eq("wallet", wallet),
      )
      .order("desc")
      .take(50);
    const activeOperation = walletOperations.find((operation) =>
      isActiveSettlementStatus(operation.status),
    );
    if (activeOperation) {
      if (
        activeOperation.action === args.action &&
        activeOperation.status === "awaiting_signature"
      ) {
        return activeOperation;
      }
      throw getActiveOperationError();
    }

    const now = Date.now();
    const membership = await ctx.db
      .query("disputeAdmins")
      .withIndex("by_scope_wallet", (q) =>
        q.eq("network", scope.network).eq("contractId", scope.contractId).eq("wallet", wallet),
      )
      .unique();
    if (args.action === "revoke") {
      if (membership) {
        await ctx.db.patch(membership._id, {
          accessState: "revoking",
          revokedByWallet: ownerWallet,
          revokedAt: now,
          lastOperationId: operationId,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("disputeAdmins", {
          ...scope,
          wallet,
          accessState: "revoking",
          revokedByWallet: ownerWallet,
          revokedAt: now,
          lastOperationId: operationId,
          updatedAt: now,
        });
      }
    }

    const operationDocId = await ctx.db.insert("disputeAdminOperations", {
      ...scope,
      wallet,
      action: args.action,
      status: "awaiting_signature",
      actorWallet: ownerWallet,
      operationId,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(operationDocId);
  },
});

export const recordDisputeAdminOperationTransaction = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    operationId: v.string(),
    transactionHash: v.string(),
    transactionValidUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerWallet = assertAdminContext(args);
    const operationId = optionalNonEmptyString(args.operationId, "operationId")!;
    const transactionHash = optionalNonEmptyString(args.transactionHash, "transactionHash")!;
    const operation = await ctx.db
      .query("disputeAdminOperations")
      .withIndex("by_operationId", (q) => q.eq("operationId", operationId))
      .unique();
    if (!operation) {
      throw new NotFoundError("Membership operation not found.");
    }
    if (operation.actorWallet !== ownerWallet) {
      throw new ForbiddenError("Only the platform owner can record membership transactions.");
    }
    if (operation.transactionHash && operation.transactionHash !== transactionHash) {
      throw new ConflictError(
        "A different transaction hash is already recorded for this operation.",
      );
    }
    if (
      operation.transactionValidUntil !== undefined &&
      operation.transactionValidUntil !== args.transactionValidUntil
    ) {
      throw new ConflictError("The transaction expiry is already recorded for this operation.");
    }
    if (operation.status === "succeeded") {
      return operation;
    }
    if (operation.status === "failed") {
      throw new ConflictError("A failed membership operation cannot accept another transaction.");
    }
    await ctx.db.patch(operation._id, {
      status: "submitted",
      transactionHash,
      transactionValidUntil: args.transactionValidUntil,
      updatedAt: Date.now(),
      errorMessage: undefined,
    });
    return await ctx.db.get(operation._id);
  },
});

export const completeDisputeAdminOperation = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    operationId: v.string(),
    result: v.union(v.literal("succeeded"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerWallet = assertAdminContext(args);
    const operation = await ctx.db
      .query("disputeAdminOperations")
      .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
      .unique();
    if (!operation) {
      throw new NotFoundError("Membership operation not found.");
    }
    if (operation.actorWallet !== ownerWallet) {
      throw new ForbiddenError("Only the platform owner can complete membership operations.");
    }
    if (operation.status === "succeeded") {
      return operation;
    }
    if (operation.status === "failed") {
      return operation;
    }
    if (!operation.transactionHash) {
      throw new ConflictError("The membership transaction has not been recorded yet.");
    }

    const now = Date.now();
    await ctx.db.patch(operation._id, {
      status: args.result,
      ...(args.result === "failed"
        ? { errorMessage: optionalNonEmptyString(args.errorMessage, "errorMessage") }
        : {}),
      updatedAt: now,
      completedAt: now,
    });
    const scope = { network: operation.network, contractId: operation.contractId };
    const membership = await ctx.db
      .query("disputeAdmins")
      .withIndex("by_scope_wallet", (q) =>
        q
          .eq("network", scope.network)
          .eq("contractId", scope.contractId)
          .eq("wallet", operation.wallet),
      )
      .unique();

    if (args.result === "succeeded") {
      if (operation.action === "grant") {
        if (membership) {
          await ctx.db.patch(membership._id, {
            accessState: "active",
            grantedByWallet: ownerWallet,
            grantedAt: now,
            revokedByWallet: undefined,
            revokedAt: undefined,
            lastOperationId: operation.operationId,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("disputeAdmins", {
            ...scope,
            wallet: operation.wallet,
            accessState: "active",
            grantedByWallet: ownerWallet,
            grantedAt: now,
            lastOperationId: operation.operationId,
            updatedAt: now,
          });
        }
      } else if (membership) {
        await ctx.db.patch(membership._id, {
          accessState: "revoked",
          revokedByWallet: ownerWallet,
          revokedAt: now,
          lastOperationId: operation.operationId,
          updatedAt: now,
        });
      }
    }

    return await ctx.db.get(operation._id);
  },
});

export const failDisputeAdminOperationBeforeSubmission = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    operationId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerWallet = assertAdminContext(args);
    const operation = await ctx.db
      .query("disputeAdminOperations")
      .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
      .unique();
    if (!operation) {
      throw new NotFoundError("Membership operation not found.");
    }
    if (operation.actorWallet !== ownerWallet) {
      throw new ForbiddenError("Only the platform owner can fail membership operations.");
    }
    if (operation.status === "succeeded") {
      return operation;
    }
    if (operation.transactionHash) {
      throw new ConflictError("Signed membership transactions must be reconciled on Stellar.");
    }
    if (operation.status === "failed") {
      return operation;
    }
    const now = Date.now();
    await ctx.db.patch(operation._id, {
      status: "failed",
      errorMessage: sanitizeDisputeMessage(args.errorMessage),
      updatedAt: now,
      completedAt: now,
    });
    return await ctx.db.get(operation._id);
  },
});

async function patchEscrowAndParentForResolution(args: {
  ctx: MutationCtx;
  dispute: Doc<"disputes">;
  escrow: Doc<"escrows">;
  status: TAdminResolutionStatus;
  transactionHash: string;
  now: number;
}): Promise<void> {
  const { ctx, dispute, escrow, status, transactionHash, now } = args;
  const settlement = getEscrowSettlement(status);
  const txHashField = getEscrowTxHashField(settlement.txType);

  await ctx.db.patch(escrow._id, {
    status: settlement.escrowStatus,
    updatedAt: now,
    [txHashField]: transactionHash,
  });

  if (escrow.milestoneId) {
    await patchMilestoneForEscrowStatus(ctx, {
      milestoneId: escrow.milestoneId,
      escrowId: escrow.escrowId,
      status: settlement.escrowStatus,
      txHash: transactionHash,
      txType: settlement.txType,
    });

    const milestone = await ctx.db.get(escrow.milestoneId);
    if (milestone) {
      const completedAt = settlement.escrowStatus === "released" ? now : milestone.completedAt;
      await ctx.db.patch(milestone._id, {
        deadlineStatus: computeDeadlineStatus({
          deadlineAt: milestone.deadlineAt,
          submittedAt: milestone.submittedAt,
          completedAt,
          approvedAt: settlement.escrowStatus === "released" ? now : milestone.approvedAt,
          escrowStatus: settlement.escrowStatus,
          workStatus: settlement.escrowStatus,
        }),
        ...(settlement.escrowStatus === "released" ? { completedAt: now, approvedAt: now } : {}),
        updatedAt: now,
      });

      await upsertDeadlineReminders(
        ctx,
        await resolveDeadlineParent(ctx, {
          parentType: "milestone",
          parentId: milestone._id,
        }),
      );
    }

    return;
  }

  const job = await ctx.db.get(escrow.jobId);
  await ctx.db.patch(escrow.jobId, {
    status: getJobStatusFromEscrowStatus(settlement.escrowStatus),
    deadlineStatus: computeDeadlineStatus({
      deadlineAt: job?.deadlineAt,
      submittedAt: job?.submittedAt,
      completedAt: settlement.escrowStatus === "released" ? now : job?.completedAt,
      approvedAt: settlement.escrowStatus === "released" ? now : job?.approvedAt,
      escrowStatus: settlement.escrowStatus,
      workStatus: getJobStatusFromEscrowStatus(settlement.escrowStatus),
    }),
    updatedAt: now,
    ...(settlement.escrowStatus === "released" ? { completedAt: now, approvedAt: now } : {}),
  });

  await upsertDeadlineReminders(
    ctx,
    await resolveDeadlineParent(ctx, {
      parentType: "micro_gig",
      parentId: escrow.jobId,
    }),
  );

  const refreshedDispute = await ctx.db.get(dispute._id);
  if (refreshedDispute) {
    await createDisputeSystemMessage(ctx, {
      dispute: refreshedDispute,
      eventType: "dispute_status_changed",
      body: "Escrow terminal state was synchronized after dispute settlement.",
      transactionHash,
    });
  }
}

export const addModeratorNote = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    disputeId: v.id("disputes"),
    message: v.string(),
    adminWalletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const adminWallet = await assertDisputeAdminContext(ctx, args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertAssignedDisputeAdmin(adminWallet, dispute);
    const message = sanitizeDisputeMessage(args.message);
    const now = Date.now();

    await ctx.db.patch(dispute._id, { updatedAt: now });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "moderator_note_added",
      actorWallet: adminWallet,
      actorWalletType: args.adminWalletType ?? DEFAULT_ADMIN_WALLET_TYPE,
      actorRole: "moderator",
      message,
    });

    const updatedDispute = await getDisputeOrThrow(ctx, args.disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute: updatedDispute,
      eventType: "dispute_status_changed",
      body: "Moderator note was added to this dispute.",
    });
    await notifyParticipants(
      ctx,
      updatedDispute,
      "Moderator note added",
      "Highrable review team added a moderator note to this dispute.",
    );

    return true;
  },
});

export const changeDisputeReviewStatus = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    disputeId: v.id("disputes"),
    status: v.union(
      v.literal(ADMIN_REVIEW_STATUSES[0]),
      v.literal(ADMIN_REVIEW_STATUSES[1]),
      v.literal(ADMIN_REVIEW_STATUSES[2]),
    ),
    message: v.optional(v.string()),
    adminWalletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const adminWallet = await assertDisputeAdminContext(ctx, args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertAssignedDisputeAdmin(adminWallet, dispute);
    assertDisputeCanEnterReviewFlow(dispute.status);

    const nextStatus: TAdminReviewStatus = args.status;
    const message =
      optionalNonEmptyString(args.message, "message") ??
      `Dispute status changed to ${nextStatus.replaceAll("_", " ")}.`;
    const now = Date.now();

    await ctx.db.patch(dispute._id, {
      status: nextStatus,
      updatedAt: now,
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "status_changed",
      actorWallet: adminWallet,
      actorWalletType: args.adminWalletType ?? DEFAULT_ADMIN_WALLET_TYPE,
      actorRole: "moderator",
      message,
      oldStatus: dispute.status,
      newStatus: nextStatus,
    });

    const updatedDispute = await getDisputeOrThrow(ctx, args.disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute: updatedDispute,
      eventType: "dispute_status_changed",
      body: message,
    });
    await notifyParticipants(
      ctx,
      updatedDispute,
      "Dispute status changed",
      `Highrable review team updated this dispute to ${nextStatus.replaceAll("_", " ")}.`,
    );

    return true;
  },
});

export const recordDisputeResolutionStarted = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    disputeId: v.id("disputes"),
    status: v.union(
      v.literal(ADMIN_RESOLUTION_STATUSES[0]),
      v.literal(ADMIN_RESOLUTION_STATUSES[1]),
      v.literal(ADMIN_RESOLUTION_STATUSES[2]),
    ),
    freelancerShareBps: v.number(),
    operationId: v.string(),
    resolutionNote: v.optional(v.string()),
    adminWalletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const adminWallet = await assertDisputeAdminContext(ctx, args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertAssignedDisputeAdmin(adminWallet, dispute);
    assertDisputeCanEnterReviewFlow(dispute.status);
    const escrow = await assertDisputeCanResolve(ctx, dispute);

    const resolutionStatus: TAdminResolutionStatus = args.status;
    const freelancerShareBps = resolveFreelancerShareBps(resolutionStatus, args.freelancerShareBps);
    const resolutionNote = sanitizeResolutionNote(args.resolutionNote);
    const operationId = optionalNonEmptyString(args.operationId, "operationId")!;
    const existingAttempt = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_operationId", (q) => q.eq("operationId", operationId))
      .unique();
    if (existingAttempt) {
      if (
        existingAttempt.disputeId !== dispute._id ||
        existingAttempt.actorWallet !== adminWallet ||
        existingAttempt.freelancerShareBps !== freelancerShareBps ||
        existingAttempt.resolutionStatus !== resolutionStatus ||
        existingAttempt.resolutionNote !== resolutionNote
      ) {
        throw new ConflictError("Settlement operation ID is already bound to a different attempt.");
      }
      return { operationId: existingAttempt.operationId, freelancerShareBps };
    }

    const activeAttempts = await Promise.all(
      (["started", "signed", "submission_unknown", "submitted"] as const).map((status) =>
        ctx.db
          .query("settlementAttempts")
          .withIndex("by_escrow_status", (q) =>
            q.eq("escrowDocumentId", escrow._id).eq("status", status),
          )
          .first(),
      ),
    );
    if (activeAttempts.some(Boolean)) {
      throw new ConflictError("A settlement attempt is already pending for this escrow.");
    }

    const scope = getAdminScope();
    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      walletAddress: adminWallet,
      walletType: args.adminWalletType ?? DEFAULT_ADMIN_WALLET_TYPE,
      type: "resolve_dispute",
      status: "pending",
      clientRequestId: operationId,
      escrowId: dispute.onChainEscrowId ?? escrow.escrowId,
      onChainEscrowId: dispute.onChainEscrowId ?? escrow.escrowId,
      ...(dispute.jobId ? { jobId: dispute.jobId } : {}),
      ...(dispute.milestoneId ? { milestoneId: dispute.milestoneId } : {}),
      network: scope.network,
      sourceAccount: adminWallet,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("settlementAttempts", {
      disputeId: dispute._id,
      escrowDocumentId: escrow._id,
      onChainEscrowId: dispute.onChainEscrowId ?? escrow.escrowId,
      ...scope,
      actorWallet: adminWallet,
      status: "started",
      resolutionStatus,
      freelancerShareBps,
      ...(resolutionNote !== undefined ? { resolutionNote } : {}),
      operationId,
      transactionId,
      createdAt: now,
      updatedAt: now,
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "resolution_proposed",
      actorWallet: adminWallet,
      actorWalletType: args.adminWalletType ?? DEFAULT_ADMIN_WALLET_TYPE,
      actorRole: "moderator",
      message: sanitizeDisputeMessage(
        `Dispute resolution started with ${resolutionStatus.replaceAll("_", " ")} (${freelancerShareBps} bps freelancer share).`,
      ),
      metadata: {
        resolutionStatus,
        freelancerShareBps,
        ...(resolutionNote !== undefined ? { resolutionNote } : {}),
      },
    });

    const updatedDispute = await getDisputeOrThrow(ctx, args.disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute: updatedDispute,
      eventType: "dispute_status_changed",
      body: "Dispute settlement processing started by the Highrable review team.",
    });
    await notifyParticipants(
      ctx,
      updatedDispute,
      "Dispute settlement started",
      "Highrable review team started processing dispute settlement.",
    );

    return { operationId, freelancerShareBps };
  },
});

export const recordDisputeResolutionSucceeded = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    operationId: v.string(),
    transactionHash: v.string(),
    transactionValidUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const actingWallet = await assertDisputeAdminContext(ctx, args);
    const operationId = optionalNonEmptyString(args.operationId, "operationId")!;
    const attempt = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_operationId", (q) => q.eq("operationId", operationId))
      .unique();
    if (!attempt) {
      throw new NotFoundError("Settlement attempt not found.");
    }
    const txHash = optionalNonEmptyString(args.transactionHash, "transactionHash")!;
    if (attempt.transactionValidUntil !== args.transactionValidUntil) {
      throw new ConflictError("Settlement expiry does not match the persisted signed operation.");
    }
    if (attempt.status === "succeeded") {
      if (attempt.transactionHash !== txHash) {
        throw new ConflictError(
          "A later callback cannot replace the confirmed settlement transaction.",
        );
      }
      return {
        status: attempt.resolutionStatus,
        freelancerShareBps: attempt.freelancerShareBps,
        resolutionTxHash: txHash,
      };
    }
    if (attempt.status === "failed") {
      throw new ConflictError("A definitively failed settlement attempt cannot be completed.");
    }
    if (!attempt.transactionHash || attempt.transactionHash !== txHash) {
      throw new ConflictError(
        "Settlement transaction does not match the persisted signed operation.",
      );
    }

    const isOwner = isConfiguredAdminWallet(actingWallet);
    const dispute = await getDisputeOrThrow(ctx, attempt.disputeId);
    if (!isOwner) {
      assertAssignedDisputeAdmin(actingWallet, dispute);
      if (attempt.actorWallet !== actingWallet) {
        throw new ForbiddenError("Only the assigned actor may complete this settlement attempt.");
      }
    }
    assertDisputeActorIsNotParticipant(attempt.actorWallet, dispute);
    assertDisputeCanEnterReviewFlow(dispute.status);

    const escrow = await assertDisputeCanResolve(ctx, dispute);
    if (escrow._id !== attempt.escrowDocumentId) {
      throw new ConflictError("Settlement attempt escrow no longer matches the dispute.");
    }
    const resolutionStatus = attempt.resolutionStatus;
    const freelancerShareBps = attempt.freelancerShareBps;
    const resolutionNote = attempt.resolutionNote;
    const settlementUrl = getStellarExpertUrl(txHash);
    const amounts = computeResolutionAmounts(escrow.amount, freelancerShareBps);
    const now = Date.now();

    await patchEscrowAndParentForResolution({
      ctx,
      dispute,
      escrow,
      status: resolutionStatus,
      transactionHash: txHash,
      now,
    });

    await ctx.db.patch(dispute._id, {
      status: resolutionStatus,
      resolvedAt: now,
      updatedAt: now,
      resolutionTxHash: txHash,
      resolutionStellarExpertUrl: settlementUrl,
      resolvedByWallet: attempt.actorWallet,
      freelancerShareBps,
      freelancerPayoutAmount: amounts.freelancerPayoutAmount,
      clientRefundAmount: amounts.clientRefundAmount,
      ...(resolutionNote !== undefined ? { resolutionNote } : {}),
      metadata: mergeMetadata(dispute.metadata, {
        resolution: {
          phase: "succeeded",
          status: resolutionStatus,
          settledAt: now,
          freelancerShareBps,
          freelancerPayoutAmount: amounts.freelancerPayoutAmount,
          clientRefundAmount: amounts.clientRefundAmount,
          ...(resolutionNote !== undefined ? { resolutionNote } : {}),
        },
      }),
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: getResolutionEventType(resolutionStatus),
      actorWallet: attempt.actorWallet,
      actorWalletType: DEFAULT_ADMIN_WALLET_TYPE,
      actorRole: "moderator",
      message: sanitizeDisputeMessage(
        `Dispute resolved as ${resolutionStatus.replaceAll("_", " ")}.`,
      ),
      oldStatus: dispute.status,
      newStatus: resolutionStatus,
      transactionHash: txHash,
      metadata: {
        freelancerShareBps,
        freelancerPayoutAmount: amounts.freelancerPayoutAmount,
        clientRefundAmount: amounts.clientRefundAmount,
        ...(resolutionNote !== undefined ? { resolutionNote } : {}),
      },
    });

    const updatedDispute = await getDisputeOrThrow(ctx, attempt.disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute: updatedDispute,
      eventType: "dispute_resolved",
      body: `Dispute resolved as ${resolutionStatus.replaceAll("_", " ")} through Highrable review flow.`,
      transactionHash: txHash,
    });
    await notifyParticipants(
      ctx,
      updatedDispute,
      "Dispute resolved",
      `Highrable review team resolved this dispute as ${resolutionStatus.replaceAll("_", " ")}.`,
      {
        freelancerShareBps,
        freelancerPayoutAmount: amounts.freelancerPayoutAmount,
        clientRefundAmount: amounts.clientRefundAmount,
      },
    );

    await ctx.db.patch(attempt._id, {
      status: "succeeded",
      transactionHash: txHash,
      updatedAt: now,
      completedAt: now,
      errorMessage: undefined,
    });
    if (attempt.transactionId) {
      await ctx.db.patch(attempt.transactionId, {
        status: "success",
        txHash,
        transactionHash: txHash,
        confirmedAt: now,
        updatedAt: now,
        errorMessage: undefined,
      });
    }

    return {
      status: resolutionStatus,
      freelancerShareBps,
      freelancerPayoutAmount: amounts.freelancerPayoutAmount,
      clientRefundAmount: amounts.clientRefundAmount,
      resolutionTxHash: txHash,
      resolutionStellarExpertUrl: settlementUrl,
    };
  },
});

export const recordDisputeResolutionSigned = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    operationId: v.string(),
    transactionHash: v.string(),
    transactionValidUntil: v.number(),
  },
  handler: async (ctx, args) => {
    const adminWallet = await assertDisputeAdminContext(ctx, args);
    const operationId = optionalNonEmptyString(args.operationId, "operationId")!;
    const transactionHash = optionalNonEmptyString(args.transactionHash, "transactionHash")!;
    const attempt = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_operationId", (q) => q.eq("operationId", operationId))
      .unique();
    if (!attempt) {
      throw new NotFoundError("Settlement attempt not found.");
    }
    if (attempt.actorWallet !== adminWallet) {
      throw new ForbiddenError("Only the initiating admin can persist this signed transaction.");
    }
    const dispute = await getDisputeOrThrow(ctx, attempt.disputeId);
    assertAssignedDisputeAdmin(adminWallet, dispute);
    if (attempt.status === "succeeded") {
      if (attempt.transactionHash !== transactionHash) {
        throw new ConflictError("Settlement already succeeded with a different transaction.");
      }
      return { operationId, transactionHash };
    }
    if (attempt.status === "failed") {
      throw new ConflictError("A failed settlement attempt cannot accept a transaction hash.");
    }
    if (attempt.transactionHash && attempt.transactionHash !== transactionHash) {
      throw new ConflictError("Settlement transaction identity is already fixed.");
    }
    if (
      attempt.transactionValidUntil !== undefined &&
      attempt.transactionValidUntil !== args.transactionValidUntil
    ) {
      throw new ConflictError("Settlement transaction expiry is already fixed.");
    }

    const now = Date.now();
    await ctx.db.patch(attempt._id, {
      status: "signed",
      transactionHash,
      transactionValidUntil: args.transactionValidUntil,
      updatedAt: now,
      errorMessage: undefined,
    });
    if (attempt.transactionId) {
      await ctx.db.patch(attempt.transactionId, {
        txHash: transactionHash,
        transactionHash,
        updatedAt: now,
      });
    }
    return { operationId, transactionHash };
  },
});

export const recordDisputeResolutionSubmissionUnknown = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    operationId: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminWallet = await assertDisputeAdminContext(ctx, args);
    const attempt = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
      .unique();
    if (!attempt) {
      throw new NotFoundError("Settlement attempt not found.");
    }
    const ownerRecovery = isConfiguredAdminWallet(adminWallet);
    if (!ownerRecovery) {
      const dispute = await getDisputeOrThrow(ctx, attempt.disputeId);
      assertAssignedDisputeAdmin(adminWallet, dispute);
      if (attempt.actorWallet !== adminWallet) {
        throw new ForbiddenError("Only the initiating admin can update this settlement attempt.");
      }
    }
    if (["succeeded", "failed"].includes(attempt.status)) {
      return { status: attempt.status };
    }
    if (!attempt.transactionHash) {
      throw new ConflictError("An unknown submission requires a persisted transaction hash.");
    }
    const now = Date.now();
    const errorMessage = optionalNonEmptyString(args.errorMessage, "errorMessage");
    await ctx.db.patch(attempt._id, {
      status: "submission_unknown",
      ...(errorMessage ? { errorMessage: sanitizeDisputeMessage(errorMessage) } : {}),
      updatedAt: now,
    });
    if (attempt.transactionId) {
      await ctx.db.patch(attempt.transactionId, {
        status: "pending",
        ...(errorMessage ? { errorMessage: sanitizeDisputeMessage(errorMessage) } : {}),
        updatedAt: now,
      });
    }
    return { status: "submission_unknown" as const };
  },
});

export const recordDisputeResolutionFailed = mutation({
  args: {
    adminWallet: v.string(),
    adminApiSecret: v.string(),
    operationId: v.string(),
    errorMessage: v.string(),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminWallet = await assertDisputeAdminContext(ctx, args);
    const attempt = await ctx.db
      .query("settlementAttempts")
      .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
      .unique();
    if (!attempt) {
      throw new NotFoundError("Settlement attempt not found.");
    }
    if (!isConfiguredAdminWallet(adminWallet)) {
      const dispute = await getDisputeOrThrow(ctx, attempt.disputeId);
      assertAssignedDisputeAdmin(adminWallet, dispute);
      if (attempt.actorWallet !== adminWallet) {
        throw new ForbiddenError("Only the initiating admin can fail this settlement attempt.");
      }
    }
    if (attempt.status === "succeeded") {
      return true;
    }
    if (attempt.status === "failed") {
      return true;
    }
    if (attempt.transactionHash && attempt.transactionHash !== args.transactionHash) {
      throw new ConflictError("Signed submissions must be reconciled with Stellar before release.");
    }

    const errorMessage = sanitizeDisputeMessage(args.errorMessage);
    const now = Date.now();

    await ctx.db.patch(attempt._id, {
      status: "failed",
      errorMessage,
      updatedAt: now,
      completedAt: now,
    });
    const dispute = await getDisputeOrThrow(ctx, attempt.disputeId);
    await ctx.db.patch(dispute._id, { updatedAt: now });
    if (attempt.transactionId) {
      await ctx.db.patch(attempt.transactionId, {
        status: "failed",
        errorMessage,
        updatedAt: now,
      });
    }
    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "moderator_note_added",
      actorWallet: attempt.actorWallet,
      actorWalletType: DEFAULT_ADMIN_WALLET_TYPE,
      actorRole: "moderator",
      message: sanitizeDisputeMessage(`Resolution attempt failed: ${errorMessage}`),
      metadata: {
        operationId: attempt.operationId,
        resolutionStatus: attempt.resolutionStatus,
        freelancerShareBps: attempt.freelancerShareBps,
      },
    });

    const updatedDispute = await getDisputeOrThrow(ctx, attempt.disputeId);
    await createDisputeSystemMessage(ctx, {
      dispute: updatedDispute,
      eventType: "dispute_status_changed",
      body: "Dispute settlement attempt failed and can be retried by the review team.",
    });
    await notifyParticipants(
      ctx,
      updatedDispute,
      "Dispute settlement retry required",
      "Highrable review team encountered a settlement failure and will retry.",
    );

    return true;
  },
});
