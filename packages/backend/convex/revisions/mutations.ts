import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { resolveDeadlineParent, upsertDeadlineReminders } from "../deadlines/helpers";
import { revisionPolicyValidator } from "../jobs/schema";
import { walletTypeValidator } from "../users/schema";
import { workSubmissionParentTypeValidator } from "../work_submissions/schema";
import {
  assertCanRequestRevision,
  assertCanSubmitRevision,
  assertParticipantCanViewRevision,
  assertRevisionAttachmentsOwnedByClient,
  computeRemainingRevisions,
  createRevisionEventMessage,
  createRevisionNotification,
  patchRevisionParent,
  resolveRevisionParent,
  sanitizeRevisionDeadline,
  sanitizeRevisionText,
  validateRevisionPolicy,
} from "./helpers";

export const setRevisionPolicy = mutation({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    clientWallet: v.string(),
    revisionPolicy: revisionPolicyValidator,
    revisionLimit: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const parent = await resolveRevisionParent(ctx, args);
    const clientWallet = normalizeWalletAddress(args.clientWallet);
    if (parent.clientWallet !== clientWallet) {
      throw new ForbiddenError("Only the client can update revision policy.");
    }
    if (parent.status !== "open" && parent.status !== "selected" && parent.status !== "assigned") {
      throw new ForbiddenError("Revision policy can only be changed before work has started.");
    }

    const config = validateRevisionPolicy({
      revisionPolicy: args.revisionPolicy,
      revisionLimit: args.revisionLimit,
    });
    const patch = {
      revisionPolicy: config.revisionPolicy,
      revisionLimit: config.revisionLimit,
      revisionCount: parent.revisionCount ?? 0,
      revisionStatus: "none" as const,
    };

    if (parent.parentType === "milestone" && parent.milestoneId !== undefined) {
      await ctx.db.patch(parent.milestoneId, { ...patch, updatedAt: Date.now() });
      return await ctx.db.get(parent.milestoneId);
    }

    if (!parent.jobId) {
      throw new NotFoundError("Work item not found.");
    }
    await ctx.db.patch(parent.jobId, patch);
    return await ctx.db.get(parent.jobId);
  },
});

export const requestRevision = mutation({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    workSubmissionId: v.id("workSubmissions"),
    clientWallet: v.string(),
    requestedByWalletType: walletTypeValidator,
    reason: v.string(),
    requestedChanges: v.string(),
    attachmentIds: v.array(v.id("attachments")),
    deadlineAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const requestedChanges = sanitizeRevisionText(args.requestedChanges, "requestedChanges");
    const reason = sanitizeRevisionText(args.reason, "reason");
    const deadlineAt = sanitizeRevisionDeadline(args.deadlineAt);
    const { parent, submission, config, clientWallet } = await assertCanRequestRevision(ctx, {
      parentType: args.parentType,
      parentId: args.parentId,
      clientWallet: args.clientWallet,
      workSubmissionId: args.workSubmissionId,
    });
    if (!parent.freelancerWallet) {
      throw new ForbiddenError("This work item does not have an assigned freelancer.");
    }

    const now = Date.now();
    const revisionNumber = config.revisionCount + 1;
    const revisionRequestId = await ctx.db.insert("revisionRequests", {
      parentType: parent.parentType,
      parentId: parent.parentId,
      ...(parent.jobId !== undefined ? { jobId: parent.jobId } : {}),
      ...(parent.milestoneId !== undefined ? { milestoneId: parent.milestoneId } : {}),
      ...(parent.escrowId !== undefined ? { escrowId: parent.escrowId } : {}),
      workSubmissionId: submission._id,
      ...(submission.previousSubmissionId !== undefined
        ? { previousSubmissionId: submission.previousSubmissionId }
        : {}),
      clientWallet,
      freelancerWallet: parent.freelancerWallet,
      requestedByWallet: clientWallet,
      requestedByWalletType: args.requestedByWalletType,
      revisionNumber,
      reason,
      requestedChanges,
      attachmentIds: args.attachmentIds,
      status: "requested",
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });

    await assertRevisionAttachmentsOwnedByClient(ctx, {
      attachmentIds: args.attachmentIds,
      clientWallet,
      revisionRequestId,
    });

    if (submission.status === "submitted_for_review") {
      await ctx.db.patch(submission._id, {
        status: "revision_requested",
        updatedAt: now,
      });
    }

    await patchRevisionParent(ctx, parent, {
      status: "revision_requested",
      activeRevisionId: revisionRequestId,
      lastRevisionRequestedAt: now,
      revisionStatus: "revision_requested",
      revisionCount: revisionNumber,
    });

    const deadlineParent = await resolveDeadlineParent(ctx, {
      parentType: parent.parentType === "milestone" ? "milestone" : "micro_gig",
      parentId: parent.parentId,
    });
    await upsertDeadlineReminders(ctx, {
      ...deadlineParent,
      submittedAt: deadlineParent.submittedAt ?? submission.submittedAt,
      status: "revision_requested",
    });

    await createRevisionEventMessage(ctx, {
      parent,
      eventType: "revision_requested",
      body: `Revision requested: Client requested changes for Submission #${revisionNumber}.`,
      revisionRequestId,
      workSubmissionId: submission._id,
      proofHash: submission.proofHash,
      transactionHash: submission.transactionHash,
    });

    await createRevisionNotification(ctx, {
      recipientWallet: parent.freelancerWallet,
      type: "revision_requested",
      title: "Revision requested",
      body: "Client requested changes to the submitted proof.",
      parentType: parent.parentType === "milestone" ? "milestone" : "micro_gig",
      parentId: parent.parentId,
      jobId: parent.jobId,
      milestoneId: parent.milestoneId,
      escrowId: parent.escrowId,
      metadata: {
        revisionRequestId,
        workSubmissionId: submission._id,
        revisionNumber,
        remainingRevisions: computeRemainingRevisions({
          ...config,
          revisionCount: revisionNumber,
        }),
      },
    });

    const refreshed = await ctx.db.get(revisionRequestId);
    if (!refreshed) {
      throw new NotFoundError("Revision request not found after creation.");
    }
    return refreshed;
  },
});

export const markRevisionSubmitted = mutation({
  args: {
    revisionRequestId: v.id("revisionRequests"),
    revisionSubmissionId: v.id("workSubmissions"),
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const { revision, parent } = await assertCanSubmitRevision(ctx, {
      revisionRequestId: args.revisionRequestId,
      freelancerWallet: args.freelancerWallet,
    });
    const submission = await ctx.db.get(args.revisionSubmissionId);
    if (!submission || submission.status === "cancelled") {
      throw new NotFoundError("Revision proof submission not found.");
    }
    if (submission.revisionRequestId !== revision._id) {
      throw new BadRequestError("Revision proof is not linked to this revision request.");
    }

    const now = Date.now();
    await ctx.db.patch(args.revisionRequestId, {
      revisionSubmissionId: submission._id,
      status: "revision_submitted",
      respondedAt: now,
      updatedAt: now,
    });

    await patchRevisionParent(ctx, parent, {
      status: "revision_submitted",
      activeRevisionId: undefined,
      revisionStatus: "revision_submitted",
    });

    const deadlineParent = await resolveDeadlineParent(ctx, {
      parentType: parent.parentType === "milestone" ? "milestone" : "micro_gig",
      parentId: parent.parentId,
    });
    await upsertDeadlineReminders(ctx, {
      ...deadlineParent,
      submittedAt: submission.submittedAt ?? now,
      status: "revision_submitted",
    });

    await createRevisionEventMessage(ctx, {
      parent,
      eventType: "revision_submitted",
      body: `Revision submitted: Freelancer submitted revised proof for Revision #${revision.revisionNumber}.`,
      revisionRequestId: revision._id,
      workSubmissionId: submission._id,
      proofHash: submission.proofHash,
      transactionHash: submission.transactionHash,
    });

    await createRevisionNotification(ctx, {
      recipientWallet: revision.clientWallet,
      type: "revision_submitted",
      title: "Revision submitted",
      body: "Freelancer submitted revised proof for your review.",
      parentType: parent.parentType === "milestone" ? "milestone" : "micro_gig",
      parentId: parent.parentId,
      jobId: parent.jobId,
      milestoneId: parent.milestoneId,
      escrowId: parent.escrowId,
      metadata: {
        revisionRequestId: revision._id,
        workSubmissionId: submission._id,
        proofHash: submission.proofHash,
        transactionHash: submission.transactionHash,
      },
    });

    return await ctx.db.get(args.revisionRequestId);
  },
});

export const markRevisionAccepted = mutation({
  args: {
    revisionRequestId: v.id("revisionRequests"),
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = normalizeWalletAddress(args.clientWallet);
    const revision = await ctx.db.get(args.revisionRequestId);
    if (!revision) {
      throw new NotFoundError("Revision request not found.");
    }
    assertParticipantCanViewRevision(revision, clientWallet);
    if (revision.clientWallet !== clientWallet) {
      throw new ForbiddenError("Only the client can accept a revision.");
    }

    await ctx.db.patch(args.revisionRequestId, {
      status: "accepted",
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    });
    const parent = await resolveRevisionParent(ctx, {
      parentType: revision.parentType,
      parentId: revision.parentId,
    });
    await patchRevisionParent(
      ctx,
      {
        ...parent,
        activeRevisionId: undefined,
      },
      {
        revisionStatus: "revision_resolved",
      },
    );

    return await ctx.db.get(args.revisionRequestId);
  },
});

export const cancelRevisionRequest = mutation({
  args: {
    revisionRequestId: v.id("revisionRequests"),
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = normalizeWalletAddress(args.clientWallet);
    const revision = await ctx.db.get(args.revisionRequestId);
    if (!revision) {
      throw new NotFoundError("Revision request not found.");
    }
    if (revision.clientWallet !== clientWallet) {
      throw new ForbiddenError("Only the client can cancel a revision request.");
    }
    if (revision.status !== "requested" && revision.status !== "acknowledged") {
      throw new BadRequestError("Only an active revision request can be cancelled.");
    }

    await ctx.db.patch(args.revisionRequestId, {
      status: "cancelled",
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    });
    const parent = await resolveRevisionParent(ctx, {
      parentType: revision.parentType,
      parentId: revision.parentId,
    });
    await patchRevisionParent(ctx, parent, {
      activeRevisionId: undefined,
      revisionStatus: "revision_resolved",
    });

    return await ctx.db.get(args.revisionRequestId);
  },
});
