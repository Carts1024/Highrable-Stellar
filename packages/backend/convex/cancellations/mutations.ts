import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

import { mutation } from "../_generated/server";
import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress, optionalNonEmptyString } from "../_shared/input";
import {
  computeDeadlineStatus,
  resolveDeadlineParent,
  upsertDeadlineReminders,
} from "../deadlines/helpers";
import { patchMilestoneForEscrowStatus } from "../milestones/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  createAgreementSystemMessage,
  createWorkAgreementEvent,
  ensureAgreementVersionForAgreement,
  getAcceptedAgreementForJob,
  getActiveAgreementVersionForAgreement,
} from "../work_agreements/helpers";
import {
  assertCanCreateCancellationRequest,
  assertCanExecuteCancellation,
  assertCanRespondToCancellation,
  assertCanViewCancellation,
  assertCanCancelImmediately,
  attachEvidenceToCancellation,
  buildCancellationEligibilitySnapshot,
  buildCancellationNumber,
  createCancellationEvent,
  createCancellationNotification,
  createCancellationSystemMessage,
  getCancellationExpiresAt,
  getCancellationReasonLabel,
  getStellarExpertUrl,
  refreshCancellationEligibilityForRequest,
  sanitizeCancellationReasonText,
  sanitizeCancellationResponseMessage,
  sanitizeOptionalEscrowContractId,
  validateCancellationAttachmentIds,
} from "./helpers";
import { cancellationParentTypeValidator, cancellationReasonCategoryValidator } from "./schema";

async function getCancellationRequestOrThrow(
  ctx: MutationCtx,
  cancellationRequestId: Id<"cancellationRequests">,
) {
  const request = await ctx.db.get(cancellationRequestId);
  if (!request) {
    throw new NotFoundError("Cancellation request not found.");
  }
  return request;
}

function getCancellationActorRole(args: {
  actorWallet: string;
  clientWallet: string;
  freelancerWallet?: string;
}) {
  const wallet = normalizeWalletAddress(args.actorWallet);
  if (wallet === args.clientWallet) return "client" as const;
  if (args.freelancerWallet && wallet === args.freelancerWallet) return "freelancer" as const;
  throw new ForbiddenError("Only authorized cancellation participants can update this request.");
}

async function patchParentCancelled(
  ctx: MutationCtx,
  args: { escrowId: Id<"escrows">; txHash: string },
) {
  const escrow = await ctx.db.get(args.escrowId);
  if (!escrow) {
    throw new NotFoundError("Escrow not found.");
  }
  const now = Date.now();
  await ctx.db.patch(escrow._id, {
    status: "cancelled",
    cancelTxHash: args.txHash,
    updatedAt: now,
  });

  if (escrow.milestoneId !== undefined) {
    await patchMilestoneForEscrowStatus(ctx, {
      milestoneId: escrow.milestoneId,
      escrowId: escrow.escrowId,
      status: "cancelled",
      txHash: args.txHash,
      txType: "cancel_escrow",
    });
    const milestone = await ctx.db.get(escrow.milestoneId);
    if (milestone) {
      await ctx.db.patch(escrow.milestoneId, {
        deadlineStatus: computeDeadlineStatus({
          deadlineAt: milestone.deadlineAt,
          submittedAt: milestone.submittedAt,
          completedAt: milestone.completedAt,
          approvedAt: milestone.approvedAt,
          escrowStatus: "cancelled",
          workStatus: "cancelled",
        }),
        updatedAt: now,
      });
      await upsertDeadlineReminders(
        ctx,
        await resolveDeadlineParent(ctx, {
          parentType: "milestone",
          parentId: escrow.milestoneId,
        }),
      );
    }
    return;
  }

  const job = await ctx.db.get(escrow.jobId);
  await ctx.db.patch(escrow.jobId, {
    status: "cancelled",
    deadlineStatus: computeDeadlineStatus({
      deadlineAt: job?.deadlineAt,
      submittedAt: job?.submittedAt,
      completedAt: job?.completedAt,
      approvedAt: job?.approvedAt,
      escrowStatus: "cancelled",
      workStatus: "cancelled",
    }),
    updatedAt: Date.now(),
  });
  await upsertDeadlineReminders(
    ctx,
    await resolveDeadlineParent(ctx, { parentType: "micro_gig", parentId: escrow.jobId }),
  );
}

async function patchWorkCancelledWithoutEscrow(
  ctx: MutationCtx,
  args: { jobId: Id<"jobs">; milestoneId?: Id<"milestones"> },
) {
  const now = Date.now();
  if (args.milestoneId !== undefined) {
    const milestone = await ctx.db.get(args.milestoneId);
    if (!milestone) {
      throw new NotFoundError("Milestone not found.");
    }
    await ctx.db.patch(args.milestoneId, {
      status: "cancelled",
      deadlineStatus: computeDeadlineStatus({
        deadlineAt: milestone.deadlineAt,
        submittedAt: milestone.submittedAt,
        completedAt: milestone.completedAt,
        approvedAt: milestone.approvedAt,
        workStatus: "cancelled",
      }),
      updatedAt: now,
    });
    await upsertDeadlineReminders(
      ctx,
      await resolveDeadlineParent(ctx, { parentType: "milestone", parentId: args.milestoneId }),
    );
    return;
  }

  const job = await ctx.db.get(args.jobId);
  if (!job) {
    throw new NotFoundError("Job not found.");
  }
  await ctx.db.patch(args.jobId, {
    status: "cancelled",
    deadlineStatus: computeDeadlineStatus({
      deadlineAt: job.deadlineAt,
      submittedAt: job.submittedAt,
      completedAt: job.completedAt,
      approvedAt: job.approvedAt,
      workStatus: "cancelled",
    }),
    updatedAt: Date.now(),
  });
  await upsertDeadlineReminders(
    ctx,
    await resolveDeadlineParent(ctx, { parentType: "micro_gig", parentId: args.jobId }),
  );
}

async function notifyBothParties(
  ctx: MutationCtx,
  input: {
    requestId: Id<"cancellationRequests">;
    type:
      | "cancellation_approved"
      | "cancellation_on_chain_started"
      | "cancellation_on_chain_succeeded"
      | "cancellation_on_chain_failed"
      | "cancellation_expired";
    title: string;
    body: string;
  },
) {
  const request = await getCancellationRequestOrThrow(ctx, input.requestId);
  await createCancellationNotification(ctx, {
    request,
    recipientWallet: request.clientWallet,
    recipientWalletType: request.clientWalletType,
    type: input.type,
    title: input.title,
    body: input.body,
  });
  if (request.freelancerWallet) {
    await createCancellationNotification(ctx, {
      request,
      recipientWallet: request.freelancerWallet,
      recipientWalletType: request.freelancerWalletType,
      type: input.type,
      title: input.title,
      body: input.body,
    });
  }
}

export const createCancellationRequest = mutation({
  args: {
    parentType: cancellationParentTypeValidator,
    parentId: v.string(),
    requestedByWallet: v.string(),
    requestedByWalletType: walletTypeValidator,
    clientWalletType: v.optional(walletTypeValidator),
    freelancerWalletType: v.optional(walletTypeValidator),
    reasonCategory: cancellationReasonCategoryValidator,
    reasonText: v.string(),
    clientWarningAccepted: v.boolean(),
    proofWarningAccepted: v.boolean(),
    escrowContractId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const reasonText = sanitizeCancellationReasonText(args.reasonText);
    if (!args.clientWarningAccepted) {
      throw new BadRequestError("You must confirm the cancellation consequences.");
    }

    const { parent, requestedByWallet, eligibility } = await assertCanCreateCancellationRequest(
      ctx,
      {
        parentType: args.parentType,
        parentId: args.parentId,
        requestedByWallet: args.requestedByWallet,
      },
    );
    if (eligibility.proofSubmitted && !args.proofWarningAccepted) {
      throw new BadRequestError("You must acknowledge the proof submission warning.");
    }
    if (eligibility.canCancelImmediately) {
      assertCanCancelImmediately(eligibility);
    }

    const now = Date.now();
    const agreement = await getAcceptedAgreementForJob(ctx, parent.jobId);
    const agreementVersion = agreement
      ? ((await getActiveAgreementVersionForAgreement(ctx, agreement)) ??
        (await ensureAgreementVersionForAgreement(ctx, { agreement })))
      : null;
    const completesWithoutOnChain =
      eligibility.canCancelImmediately && !eligibility.canExecuteOnChain;
    const status = completesWithoutOnChain
      ? "cancelled_on_chain"
      : eligibility.requiresFreelancerResponse
        ? "pending_freelancer_response"
        : "approved_for_cancel";
    const onChainStatus = completesWithoutOnChain
      ? "not_required"
      : eligibility.canExecuteOnChain || eligibility.requiresFreelancerResponse
        ? "not_submitted"
        : "not_required";
    const requestId = await ctx.db.insert("cancellationRequests", {
      requestNumber: buildCancellationNumber(now),
      parentType: parent.parentType,
      parentId: parent.parentId,
      jobId: parent.jobId,
      ...(parent.microGigId !== undefined ? { microGigId: parent.microGigId } : {}),
      ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
      ...(parent.escrowId !== undefined ? { escrowId: parent.escrowId } : {}),
      ...(parent.onChainEscrowId !== undefined ? { onChainEscrowId: parent.onChainEscrowId } : {}),
      ...(sanitizeOptionalEscrowContractId(args.escrowContractId) !== undefined
        ? { escrowContractId: sanitizeOptionalEscrowContractId(args.escrowContractId) }
        : {}),
      clientWallet: parent.clientWallet,
      ...(args.clientWalletType !== undefined ? { clientWalletType: args.clientWalletType } : {}),
      ...(parent.freelancerWallet !== undefined
        ? { freelancerWallet: parent.freelancerWallet }
        : {}),
      ...(args.freelancerWalletType !== undefined
        ? { freelancerWalletType: args.freelancerWalletType }
        : {}),
      ...(agreement ? { agreementId: agreement._id } : {}),
      ...(agreementVersion ? { agreementVersionId: agreementVersion._id } : {}),
      ...((agreementVersion?.agreementHash ?? agreement?.agreementHash)
        ? { agreementHash: agreementVersion?.agreementHash ?? agreement?.agreementHash }
        : {}),
      requestedByWallet,
      requestedByWalletType: args.requestedByWalletType,
      requestedByRole: "client",
      cancellationType: eligibility.cancellationType,
      reasonCategory: args.reasonCategory,
      reasonText,
      clientWarningAccepted: args.clientWarningAccepted,
      proofWarningAccepted: args.proofWarningAccepted,
      freelancerResponseRequired: eligibility.requiresFreelancerResponse,
      freelancerResponseStatus: eligibility.requiresFreelancerResponse ? "pending" : "not_required",
      status,
      onChainStatus,
      eligibilitySnapshot: buildCancellationEligibilitySnapshot(eligibility),
      requestedAt: now,
      ...(completesWithoutOnChain ? { cancelledAt: now } : {}),
      ...(eligibility.requiresFreelancerResponse
        ? { expiresAt: getCancellationExpiresAt(now) }
        : {}),
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });

    if (completesWithoutOnChain) {
      await patchWorkCancelledWithoutEscrow(ctx, {
        jobId: parent.jobId,
        ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
      });
    }

    await createCancellationEvent(ctx, {
      cancellationRequestId: requestId,
      parentType: parent.parentType,
      parentId: parent.parentId,
      ...(parent.escrowId !== undefined ? { escrowId: parent.escrowId } : {}),
      type: "cancellation_requested",
      actorWallet: requestedByWallet,
      actorWalletType: args.requestedByWalletType,
      actorRole: "client",
      message: `Cancellation requested: Client requested to cancel this escrow (${getCancellationReasonLabel(args.reasonCategory)}).`,
      newStatus: status,
      metadata: { eligibilitySnapshot: eligibility, reasonText },
      createdAt: now,
    });

    if (agreement) {
      await createWorkAgreementEvent(ctx, {
        agreementId: agreement._id,
        ...(agreementVersion ? { agreementVersionId: agreementVersion._id } : {}),
        jobId: agreement.jobId,
        ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
        ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
        type: "agreement_referenced_in_cancellation",
        actorWallet: requestedByWallet,
        actorWalletType: args.requestedByWalletType,
        actorRole: "client",
        message: "Agreement referenced for cancellation review.",
        oldStatus: agreement.status,
        newStatus: agreement.status,
        relatedEntityType: "cancellation",
        relatedEntityId: requestId,
        metadata: {
          agreementHash: agreementVersion?.agreementHash ?? agreement.agreementHash,
          versionNumber: agreementVersion?.versionNumber ?? agreement.version,
        },
      });
    }

    if (eligibility.requiresFreelancerResponse) {
      await createCancellationEvent(ctx, {
        cancellationRequestId: requestId,
        parentType: parent.parentType,
        parentId: parent.parentId,
        ...(parent.escrowId !== undefined ? { escrowId: parent.escrowId } : {}),
        type: "freelancer_response_required",
        actorWallet: "system",
        actorWalletType: "system",
        actorRole: "system",
        message: "Freelancer agreement is required before cancellation can continue.",
        newStatus: status,
        createdAt: now,
      });
    }

    const request = await getCancellationRequestOrThrow(ctx, requestId);
    await createCancellationSystemMessage(ctx, {
      request,
      eventType: "cancellation_requested",
      body: "Cancellation requested: Client requested to cancel this escrow.",
    });
    if (agreement) {
      await createAgreementSystemMessage(ctx, {
        agreement,
        eventType: "agreement_referenced_in_cancellation",
        body: `Cancellation review: Agreement v${agreementVersion?.versionNumber ?? agreement.version} was attached as context.`,
        agreementHash: agreementVersion?.agreementHash ?? agreement.agreementHash,
      });
    }
    if (request.freelancerWallet) {
      await createCancellationNotification(ctx, {
        request,
        recipientWallet: request.freelancerWallet,
        recipientWalletType: request.freelancerWalletType,
        type: "cancellation_requested",
        title: "Cancellation requested",
        body: "Client requested cancellation. Review and respond before the request expires.",
      });
    }

    if (completesWithoutOnChain) {
      await createCancellationSystemMessage(ctx, {
        request,
        eventType: "cancellation_on_chain_succeeded",
        body: "Cancellation confirmed: Work was cancelled before escrow funding.",
      });
    }

    return await getCancellationRequestOrThrow(ctx, requestId);
  },
});

export const withdrawCancellationRequest = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    const actorWallet = normalizeWalletAddress(args.actorWallet);
    if (actorWallet !== request.clientWallet) {
      throw new ForbiddenError("Only the client can withdraw cancellation.");
    }
    if (
      request.status === "cancelled_on_chain" ||
      request.status === "cancel_pending_on_chain" ||
      request.status === "expired"
    ) {
      throw new BadRequestError("This cancellation request can no longer be withdrawn.");
    }
    const oldStatus = request.status;
    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "withdrawn",
      updatedAt: now,
    });
    await createCancellationEvent(ctx, {
      cancellationRequestId: request._id,
      parentType: request.parentType,
      parentId: request.parentId,
      ...(request.escrowId !== undefined ? { escrowId: request.escrowId } : {}),
      type: "client_withdrew",
      actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole: "client",
      message: args.message ?? "Client withdrew the cancellation request.",
      oldStatus,
      newStatus: "withdrawn",
    });
    const updated = await getCancellationRequestOrThrow(ctx, request._id);
    await createCancellationSystemMessage(ctx, {
      request: updated,
      eventType: "cancellation_withdrawn",
      body: "Cancellation withdrawn: Client withdrew the cancellation request.",
    });
    return true;
  },
});

export const respondToCancellationRequest = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    freelancerWallet: v.string(),
    freelancerWalletType: walletTypeValidator,
    responseStatus: v.union(v.literal("accepted"), v.literal("rejected")),
    responseMessage: v.string(),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    assertCanRespondToCancellation(request, args.freelancerWallet);
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);
    const responseMessage = sanitizeCancellationResponseMessage(args.responseMessage);
    const attachmentIds = args.attachmentIds ?? [];
    await validateCancellationAttachmentIds(ctx, {
      attachmentIds,
      walletAddress: freelancerWallet,
      parentId: request._id,
    });
    await attachEvidenceToCancellation(ctx, {
      attachmentIds,
      cancellationRequestId: request._id,
    });

    const oldStatus = request.status;
    const newStatus =
      args.responseStatus === "accepted" ? "approved_for_cancel" : "rejected_by_freelancer";
    const now = Date.now();
    await ctx.db.patch(request._id, {
      freelancerResponseStatus: args.responseStatus,
      freelancerResponseMessage: responseMessage,
      freelancerResponseAttachmentIds: attachmentIds,
      status: newStatus,
      respondedAt: now,
      updatedAt: now,
    });
    await createCancellationEvent(ctx, {
      cancellationRequestId: request._id,
      parentType: request.parentType,
      parentId: request.parentId,
      ...(request.escrowId !== undefined ? { escrowId: request.escrowId } : {}),
      type: args.responseStatus === "accepted" ? "freelancer_accepted" : "freelancer_rejected",
      actorWallet: freelancerWallet,
      actorWalletType: args.freelancerWalletType,
      actorRole: "freelancer",
      message:
        args.responseStatus === "accepted"
          ? "Cancellation accepted: Freelancer agreed to cancel this work."
          : "Cancellation rejected: Freelancer declined the cancellation request.",
      oldStatus,
      newStatus,
      metadata: { responseMessage, attachmentIds },
    });

    const updated = await getCancellationRequestOrThrow(ctx, request._id);
    await createCancellationSystemMessage(ctx, {
      request: updated,
      eventType:
        args.responseStatus === "accepted" ? "cancellation_accepted" : "cancellation_rejected",
      body:
        args.responseStatus === "accepted"
          ? "Cancellation accepted: Freelancer agreed to cancel this work."
          : "Cancellation rejected: Freelancer declined the cancellation request.",
    });
    await createCancellationNotification(ctx, {
      request: updated,
      recipientWallet: updated.clientWallet,
      recipientWalletType: updated.clientWalletType,
      type: "cancellation_freelancer_responded",
      title: args.responseStatus === "accepted" ? "Cancellation accepted" : "Cancellation rejected",
      body:
        args.responseStatus === "accepted"
          ? "Freelancer accepted cancellation. You can now execute on-chain cancellation if the escrow state allows it."
          : "Freelancer rejected cancellation. You can continue work review or open a dispute.",
    });
    return true;
  },
});

export const markCancellationApproved = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    const actorRole = getCancellationActorRole({
      actorWallet: args.actorWallet,
      clientWallet: request.clientWallet,
      freelancerWallet: request.freelancerWallet,
    });
    const eligibility = await refreshCancellationEligibilityForRequest(ctx, request);
    if (!eligibility.canCancelImmediately && request.freelancerResponseStatus !== "accepted") {
      throw new ForbiddenError(
        eligibility.reason ?? "Cancellation is not approved for on-chain execution.",
      );
    }
    const oldStatus = request.status;
    await ctx.db.patch(request._id, {
      status: "approved_for_cancel",
      eligibilitySnapshot: buildCancellationEligibilitySnapshot(eligibility),
      updatedAt: Date.now(),
    });
    await createCancellationEvent(ctx, {
      cancellationRequestId: request._id,
      parentType: request.parentType,
      parentId: request.parentId,
      ...(request.escrowId !== undefined ? { escrowId: request.escrowId } : {}),
      type: "status_changed",
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole,
      message: "Cancellation approved for on-chain execution.",
      oldStatus,
      newStatus: "approved_for_cancel",
    });
    const updated = await getCancellationRequestOrThrow(ctx, request._id);
    await createCancellationSystemMessage(ctx, {
      request: updated,
      eventType: "cancellation_approved",
      body: "Cancellation approved for on-chain execution.",
    });
    await notifyBothParties(ctx, {
      requestId: updated._id,
      type: "cancellation_approved",
      title: "Cancellation approved",
      body: "Cancellation is approved for on-chain execution.",
    });
    return true;
  },
});

export const markCancelOnChainStarted = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    const actorWallet = normalizeWalletAddress(args.actorWallet);
    if (actorWallet !== request.clientWallet) {
      throw new ForbiddenError("Only the client can execute cancellation.");
    }
    assertCanExecuteCancellation(request);
    const eligibility = await refreshCancellationEligibilityForRequest(ctx, request);
    if (!eligibility.canExecuteOnChain) {
      throw new ForbiddenError(
        eligibility.reason ?? "This escrow cannot be cancelled in its current state.",
      );
    }
    const oldStatus = request.status;
    await ctx.db.patch(request._id, {
      status: "cancel_pending_on_chain",
      onChainStatus: "pending",
      eligibilitySnapshot: buildCancellationEligibilitySnapshot(eligibility),
      updatedAt: Date.now(),
    });
    await createCancellationEvent(ctx, {
      cancellationRequestId: request._id,
      parentType: request.parentType,
      parentId: request.parentId,
      ...(request.escrowId !== undefined ? { escrowId: request.escrowId } : {}),
      type: "on_chain_cancel_started",
      actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole: "client",
      message: "On-chain cancellation started.",
      oldStatus,
      newStatus: "cancel_pending_on_chain",
    });
    const updated = await getCancellationRequestOrThrow(ctx, request._id);
    await createCancellationSystemMessage(ctx, {
      request: updated,
      eventType: "cancellation_on_chain_started",
      body: "On-chain update: Escrow cancellation started.",
    });
    return true;
  },
});

export const markCancelOnChainSucceeded = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    transactionHash: v.string(),
    stellarExpertUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    const actorWallet = normalizeWalletAddress(args.actorWallet);
    if (actorWallet !== request.clientWallet) {
      throw new ForbiddenError("Only the client can confirm cancellation execution.");
    }
    if (request.escrowId === undefined) {
      throw new BadRequestError("No escrow record is linked to this cancellation request.");
    }
    const transactionHash = optionalNonEmptyString(args.transactionHash, "transactionHash");
    if (!transactionHash) {
      throw new BadRequestError("transactionHash is required.");
    }
    const now = Date.now();
    const stellarExpertUrl = args.stellarExpertUrl ?? getStellarExpertUrl(transactionHash);
    const oldStatus = request.status;
    await patchParentCancelled(ctx, { escrowId: request.escrowId, txHash: transactionHash });
    await ctx.db.patch(request._id, {
      status: "cancelled_on_chain",
      onChainStatus: "confirmed",
      transactionHash,
      stellarExpertUrl,
      cancelledAt: now,
      updatedAt: now,
    });
    await createCancellationEvent(ctx, {
      cancellationRequestId: request._id,
      parentType: request.parentType,
      parentId: request.parentId,
      escrowId: request.escrowId,
      type: "on_chain_cancel_succeeded",
      actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole: "client",
      message: "On-chain update: Escrow cancellation was confirmed.",
      oldStatus,
      newStatus: "cancelled_on_chain",
      transactionHash,
    });
    const updated = await getCancellationRequestOrThrow(ctx, request._id);
    await createCancellationSystemMessage(ctx, {
      request: updated,
      eventType: "cancellation_on_chain_succeeded",
      body: "On-chain update: Escrow cancellation was confirmed.",
      transactionHash,
    });
    await notifyBothParties(ctx, {
      requestId: updated._id,
      type: "cancellation_on_chain_succeeded",
      title: "Escrow cancelled",
      body: "Escrow cancellation was confirmed on-chain.",
    });
    return true;
  },
});

export const markCancelOnChainFailed = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    actorWallet: v.string(),
    actorWalletType: walletTypeValidator,
    errorMessage: v.string(),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    const actorRole = getCancellationActorRole({
      actorWallet: args.actorWallet,
      clientWallet: request.clientWallet,
      freelancerWallet: request.freelancerWallet,
    });
    const transactionHash = optionalNonEmptyString(args.transactionHash, "transactionHash");
    const oldStatus = request.status;
    const errorMessage = sanitizeCancellationResponseMessage(args.errorMessage);
    await ctx.db.patch(request._id, {
      status: "cancel_failed",
      onChainStatus: "failed",
      ...(transactionHash !== undefined ? { transactionHash } : {}),
      updatedAt: Date.now(),
      metadata: {
        ...(typeof request.metadata === "object" && request.metadata !== null
          ? request.metadata
          : {}),
        onChainCancelError: errorMessage,
      },
    });
    await createCancellationEvent(ctx, {
      cancellationRequestId: request._id,
      parentType: request.parentType,
      parentId: request.parentId,
      ...(request.escrowId !== undefined ? { escrowId: request.escrowId } : {}),
      type: "on_chain_cancel_failed",
      actorWallet: args.actorWallet,
      actorWalletType: args.actorWalletType,
      actorRole,
      message: "Cancellation request was saved, but on-chain cancellation failed. Please retry.",
      oldStatus,
      newStatus: "cancel_failed",
      ...(transactionHash !== undefined ? { transactionHash } : {}),
      metadata: { errorMessage },
    });
    const updated = await getCancellationRequestOrThrow(ctx, request._id);
    await createCancellationSystemMessage(ctx, {
      request: updated,
      eventType: "cancellation_on_chain_failed",
      body: "On-chain update: Escrow cancellation failed. Please retry.",
      ...(transactionHash !== undefined ? { transactionHash } : {}),
    });
    await createCancellationNotification(ctx, {
      request: updated,
      recipientWallet: updated.clientWallet,
      recipientWalletType: updated.clientWalletType,
      type: "cancellation_on_chain_failed",
      title: "Cancellation failed",
      body: "Cancellation request was saved, but on-chain cancellation failed. Please retry.",
    });
    return true;
  },
});

export const expireCancellationRequest = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    if (request.status !== "pending_freelancer_response") {
      return false;
    }
    if (request.expiresAt === undefined || request.expiresAt > Date.now()) {
      return false;
    }
    const oldStatus = request.status;
    await ctx.db.patch(request._id, {
      status: "expired",
      freelancerResponseStatus: "expired",
      updatedAt: Date.now(),
    });
    await createCancellationEvent(ctx, {
      cancellationRequestId: request._id,
      parentType: request.parentType,
      parentId: request.parentId,
      ...(request.escrowId !== undefined ? { escrowId: request.escrowId } : {}),
      type: "status_changed",
      actorWallet: "system",
      actorWalletType: "system",
      actorRole: "system",
      message: "Cancellation request expired.",
      oldStatus,
      newStatus: "expired",
    });
    const updated = await getCancellationRequestOrThrow(ctx, request._id);
    await createCancellationSystemMessage(ctx, {
      request: updated,
      eventType: "cancellation_expired",
      body: "Cancellation expired: freelancer response window ended.",
    });
    await notifyBothParties(ctx, {
      requestId: updated._id,
      type: "cancellation_expired",
      title: "Cancellation expired",
      body: "Cancellation request expired before freelancer response.",
    });
    return true;
  },
});

export const createCancellationNotificationMutation = mutation({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    recipientWallet: v.string(),
    recipientWalletType: v.optional(walletTypeValidator),
    type: v.union(
      v.literal("cancellation_requested"),
      v.literal("cancellation_freelancer_responded"),
      v.literal("cancellation_approved"),
      v.literal("cancellation_on_chain_started"),
      v.literal("cancellation_on_chain_succeeded"),
      v.literal("cancellation_on_chain_failed"),
      v.literal("cancellation_blocked"),
      v.literal("cancellation_withdrawn"),
      v.literal("cancellation_expired"),
    ),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await getCancellationRequestOrThrow(ctx, args.cancellationRequestId);
    assertCanViewCancellation(request, args.recipientWallet);
    await createCancellationNotification(ctx, {
      request,
      recipientWallet: args.recipientWallet,
      recipientWalletType: args.recipientWalletType,
      type: args.type,
      title: args.title,
      body: args.body,
    });
    return true;
  },
});
