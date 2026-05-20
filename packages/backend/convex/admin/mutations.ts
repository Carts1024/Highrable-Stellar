import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { TEscrowStatus, TEscrowTransactionType } from "../escrows/schema";
import type { TWalletType } from "../users/schema";

import { mutation } from "../_generated/server";
import { BadRequestError, NotFoundError } from "../_shared/errors";
import { optionalNonEmptyString } from "../_shared/input";
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
  assertDisputeCanEnterReviewFlow,
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
    const adminWallet = assertAdminContext(args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
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
    const adminWallet = assertAdminContext(args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
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
    resolutionNote: v.optional(v.string()),
    adminWalletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const adminWallet = assertAdminContext(args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertDisputeCanEnterReviewFlow(dispute.status);
    await assertDisputeCanResolve(ctx, dispute);

    const resolutionStatus: TAdminResolutionStatus = args.status;
    const freelancerShareBps = resolveFreelancerShareBps(resolutionStatus, args.freelancerShareBps);
    const resolutionNote = sanitizeResolutionNote(args.resolutionNote);
    const now = Date.now();

    await ctx.db.patch(dispute._id, {
      updatedAt: now,
      metadata: mergeMetadata(dispute.metadata, {
        resolution: {
          phase: "started",
          status: resolutionStatus,
          freelancerShareBps,
          startedAt: now,
          ...(resolutionNote !== undefined ? { resolutionNote } : {}),
        },
      }),
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

    return {
      freelancerShareBps,
    };
  },
});

export const recordDisputeResolutionSucceeded = mutation({
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
    transactionHash: v.string(),
    stellarExpertUrl: v.optional(v.string()),
    resolutionNote: v.optional(v.string()),
    adminWalletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const adminWallet = assertAdminContext(args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertDisputeCanEnterReviewFlow(dispute.status);

    const escrow = await assertDisputeCanResolve(ctx, dispute);
    const resolutionStatus: TAdminResolutionStatus = args.status;
    const freelancerShareBps = resolveFreelancerShareBps(resolutionStatus, args.freelancerShareBps);
    const txHash = optionalNonEmptyString(args.transactionHash, "transactionHash");
    if (!txHash) {
      throw new BadRequestError("transactionHash is required.");
    }

    const resolutionNote = sanitizeResolutionNote(args.resolutionNote);
    const settlementUrl =
      optionalNonEmptyString(args.stellarExpertUrl, "stellarExpertUrl") ??
      getStellarExpertUrl(txHash);
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
      resolvedByWallet: adminWallet,
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
      actorWallet: adminWallet,
      actorWalletType: args.adminWalletType ?? DEFAULT_ADMIN_WALLET_TYPE,
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

    const updatedDispute = await getDisputeOrThrow(ctx, args.disputeId);
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

export const recordDisputeResolutionFailed = mutation({
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
    errorMessage: v.string(),
    resolutionNote: v.optional(v.string()),
    adminWalletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const adminWallet = assertAdminContext(args);
    const dispute = await getDisputeOrThrow(ctx, args.disputeId);
    assertDisputeCanEnterReviewFlow(dispute.status);

    const resolutionStatus: TAdminResolutionStatus = args.status;
    const freelancerShareBps = resolveFreelancerShareBps(resolutionStatus, args.freelancerShareBps);
    const resolutionNote = sanitizeResolutionNote(args.resolutionNote);
    const errorMessage = sanitizeDisputeMessage(args.errorMessage);
    const now = Date.now();

    await ctx.db.patch(dispute._id, {
      updatedAt: now,
      metadata: mergeMetadata(dispute.metadata, {
        resolution: {
          phase: "failed",
          status: resolutionStatus,
          failedAt: now,
          freelancerShareBps,
          errorMessage,
          ...(resolutionNote !== undefined ? { resolutionNote } : {}),
        },
      }),
    });

    await createDisputeEvent(ctx, {
      disputeId: dispute._id,
      type: "moderator_note_added",
      actorWallet: adminWallet,
      actorWalletType: args.adminWalletType ?? DEFAULT_ADMIN_WALLET_TYPE,
      actorRole: "moderator",
      message: sanitizeDisputeMessage(`Resolution attempt failed: ${errorMessage}`),
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
