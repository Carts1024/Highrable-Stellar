import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { createSystemMessageForEvent } from "../conversations/helpers";
import {
  computeDeadlineStatus,
  resolveDeadlineParent,
  upsertDeadlineReminders,
} from "../deadlines/helpers";
import {
  assertCanSubmitRevision,
  createRevisionEventMessage,
  createRevisionNotification,
  patchRevisionParent,
  resolveRevisionParent,
} from "../revisions/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  assertAttachmentsOwnedBySubmitter,
  assertCanAnchorSubmission,
  assertCanCreateSubmission,
  assertSubmissionIsMutable,
  getSubmissionOrThrow,
  sanitizeErrorMessage,
  sanitizeProofHash,
  sanitizeProofNotes,
} from "./helpers";

export const createWorkSubmissionDraft = mutation({
  args: {
    onChainEscrowId: v.string(),
    submittedByWallet: v.string(),
    submittedByWalletType: walletTypeValidator,
    revisionRequestId: v.optional(v.id("revisionRequests")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const context = await assertCanCreateSubmission(ctx, args);
    const revisionContext =
      args.revisionRequestId !== undefined
        ? await assertCanSubmitRevision(ctx, {
            revisionRequestId: args.revisionRequestId,
            freelancerWallet: args.submittedByWallet,
          })
        : null;
    const now = Date.now();

    return await ctx.db.insert("workSubmissions", {
      parentType: context.parentType,
      parentId: context.parentId,
      jobId: context.escrow.jobId,
      ...(context.escrow.milestoneId !== undefined
        ? { milestoneId: context.escrow.milestoneId }
        : {}),
      escrowId: context.escrow._id,
      onChainEscrowId: context.escrow.escrowId,
      ...(revisionContext
        ? {
            revisionRequestId: revisionContext.revision._id,
            revisionNumber: revisionContext.revision.revisionNumber,
            previousSubmissionId: revisionContext.revision.workSubmissionId,
          }
        : {}),
      clientWallet: context.escrow.clientWallet,
      freelancerWallet: context.escrow.freelancerWallet!,
      freelancerWalletType: args.submittedByWalletType,
      submittedByWallet: context.submittedByWallet,
      submittedByWalletType: args.submittedByWalletType,
      notes: "",
      attachmentIds: [],
      hashAlgorithm: "sha256",
      hashEncoding: "hex",
      proofVersion: revisionContext ? "v1_revision" : "v1",
      status: "draft",
      onChainStatus: "not_submitted",
      createdAt: now,
      updatedAt: now,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  },
});

export const submitWorkProofMetadata = mutation({
  args: {
    submissionId: v.id("workSubmissions"),
    submittedByWallet: v.string(),
    notes: v.string(),
    attachmentIds: v.array(v.id("attachments")),
    normalizedManifest: v.any(),
    proofHash: v.string(),
    submittedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const submission = await getSubmissionOrThrow(ctx, args.submissionId);
    assertSubmissionIsMutable(submission);

    const submittedByWallet = normalizeWalletAddress(args.submittedByWallet);
    if (submittedByWallet !== submission.submittedByWallet) {
      throw new BadRequestError("Only the assigned freelancer can submit proof for this escrow.");
    }

    const notes = sanitizeProofNotes(args.notes);
    if (!notes && args.attachmentIds.length === 0) {
      throw new BadRequestError("Add notes or at least one attachment before submitting proof.");
    }

    const proofHash = sanitizeProofHash(args.proofHash);
    await assertAttachmentsOwnedBySubmitter(ctx, {
      attachmentIds: args.attachmentIds,
      submittedByWallet,
      submissionId: args.submissionId,
    });

    const now = Date.now();
    for (const attachmentId of args.attachmentIds) {
      await ctx.db.patch(attachmentId, {
        parentType: "work_submission",
        parentId: args.submissionId,
        ownerRole: "freelancer",
        visibility: "participants",
        updatedAt: now,
      });
    }

    const parent = await resolveDeadlineParent(ctx, {
      parentType: submission.parentType === "milestone" ? "milestone" : "micro_gig",
      parentId: submission.parentId,
    });
    const deadlineStatus = computeDeadlineStatus({
      deadlineAt: parent.deadlineAt,
      submittedAt: args.submittedAt,
      completedAt: parent.completedAt,
      approvedAt: parent.approvedAt,
      escrowStatus: parent.escrowStatus,
      workStatus: parent.status,
    });

    await ctx.db.patch(args.submissionId, {
      notes,
      attachmentIds: args.attachmentIds,
      normalizedManifest: args.normalizedManifest,
      proofHash,
      status: "submitted",
      onChainStatus: "not_submitted",
      submittedAt: args.submittedAt,
      ...(parent.deadlineAt !== undefined ? { deadlineAt: parent.deadlineAt } : {}),
      deadlineStatus,
      submittedLate: deadlineStatus === "submitted_late",
      updatedAt: now,
    });

    if (submission.revisionRequestId !== undefined) {
      const { revision } = await assertCanSubmitRevision(ctx, {
        revisionRequestId: submission.revisionRequestId,
        freelancerWallet: submittedByWallet,
      });
      const parentContext = await resolveRevisionParent(ctx, {
        parentType: revision.parentType,
        parentId: revision.parentId,
      });
      await ctx.db.patch(revision._id, {
        revisionSubmissionId: args.submissionId,
        status: "revision_submitted",
        respondedAt: now,
        updatedAt: now,
      });
      await patchRevisionParent(ctx, parentContext, {
        status: "revision_submitted",
        activeRevisionId: undefined,
        revisionStatus: "revision_submitted",
      });
      await createRevisionEventMessage(ctx, {
        parent: parentContext,
        eventType: "revision_submitted",
        body: `Revision submitted: Freelancer submitted revised proof for Revision #${revision.revisionNumber}.`,
        revisionRequestId: revision._id,
        workSubmissionId: args.submissionId,
        proofHash,
      });
      await createRevisionNotification(ctx, {
        recipientWallet: revision.clientWallet,
        type: "revision_submitted",
        title: "Revision submitted",
        body: "Freelancer submitted revised proof for your review.",
        parentType: parentContext.parentType === "milestone" ? "milestone" : "micro_gig",
        parentId: parentContext.parentId,
        jobId: parentContext.jobId,
        milestoneId: parentContext.milestoneId,
        escrowId: parentContext.escrowId,
        metadata: {
          revisionRequestId: revision._id,
          workSubmissionId: args.submissionId,
          proofHash,
        },
      });
    }

    if (parent.parentType === "micro_gig") {
      await ctx.db.patch(parent.jobId, {
        submittedAt: args.submittedAt,
        deadlineStatus,
      });
    } else if (parent.milestoneId !== undefined) {
      await ctx.db.patch(parent.milestoneId, {
        submittedAt: args.submittedAt,
        deadlineStatus,
        updatedAt: now,
      });
    }
    await upsertDeadlineReminders(ctx, {
      ...parent,
      submittedAt: args.submittedAt,
    });

    if (submission.revisionRequestId === undefined) {
      await createSystemMessageForEvent(ctx, {
        parentType: submission.escrowId !== undefined ? "escrow" : "work_submission",
        parentId: submission.escrowId ?? args.submissionId,
        eventType: "work_submitted",
        body: "Proof of work was submitted.",
        eventPayload: {
          workSubmissionId: args.submissionId,
          escrowId: submission.escrowId,
          onChainEscrowId: submission.onChainEscrowId,
          proofHash,
        },
      });

      await createSystemMessageForEvent(ctx, {
        parentType: submission.escrowId !== undefined ? "escrow" : "work_submission",
        parentId: submission.escrowId ?? args.submissionId,
        eventType: "deadline_warning",
        body:
          deadlineStatus === "submitted_late"
            ? "Proof submitted after the deadline."
            : "Proof submitted on time.",
        eventPayload: {
          workSubmissionId: args.submissionId,
          deadlineAt: parent.deadlineAt,
          deadlineStatus,
        },
      });
    }

    return await getSubmissionOrThrow(ctx, args.submissionId);
  },
});

export const markSubmissionAnchoring = mutation({
  args: {
    submissionId: v.id("workSubmissions"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await getSubmissionOrThrow(ctx, args.submissionId);
    assertCanAnchorSubmission(submission, args.walletAddress);

    await ctx.db.patch(args.submissionId, {
      status: "anchoring",
      onChainStatus: "pending",
      anchorErrorMessage: undefined,
      updatedAt: Date.now(),
    });

    return await getSubmissionOrThrow(ctx, args.submissionId);
  },
});

export const markSubmissionAnchored = mutation({
  args: {
    submissionId: v.id("workSubmissions"),
    walletAddress: v.string(),
    transactionHash: v.string(),
    stellarExpertUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await getSubmissionOrThrow(ctx, args.submissionId);
    const normalizedWallet = normalizeWalletAddress(args.walletAddress);
    if (normalizedWallet !== submission.submittedByWallet) {
      throw new BadRequestError("Only the assigned freelancer can update this proof submission.");
    }

    const now = Date.now();
    await ctx.db.patch(args.submissionId, {
      status: "anchored",
      onChainStatus: "confirmed",
      transactionHash: args.transactionHash.trim(),
      ...(args.stellarExpertUrl ? { stellarExpertUrl: args.stellarExpertUrl.trim() } : {}),
      anchoredAt: now,
      updatedAt: now,
      anchorErrorMessage: undefined,
    });

    await createSystemMessageForEvent(ctx, {
      parentType: submission.escrowId !== undefined ? "escrow" : "work_submission",
      parentId: submission.escrowId ?? args.submissionId,
      eventType: "proof_anchored",
      body: "Proof hash was anchored on-chain.",
      eventPayload: {
        workSubmissionId: args.submissionId,
        escrowId: submission.escrowId,
        onChainEscrowId: submission.onChainEscrowId,
        proofHash: submission.proofHash,
        transactionHash: args.transactionHash.trim(),
        ...(args.stellarExpertUrl ? { stellarExpertUrl: args.stellarExpertUrl.trim() } : {}),
      },
    });

    return await getSubmissionOrThrow(ctx, args.submissionId);
  },
});

export const markSubmissionAnchorFailed = mutation({
  args: {
    submissionId: v.id("workSubmissions"),
    walletAddress: v.string(),
    errorMessage: v.optional(v.string()),
    transactionHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await getSubmissionOrThrow(ctx, args.submissionId);
    const normalizedWallet = normalizeWalletAddress(args.walletAddress);
    if (normalizedWallet !== submission.submittedByWallet) {
      throw new BadRequestError("Only the assigned freelancer can update this proof submission.");
    }

    await ctx.db.patch(args.submissionId, {
      status: "anchor_failed",
      onChainStatus: "failed",
      ...(args.transactionHash ? { transactionHash: args.transactionHash.trim() } : {}),
      ...(sanitizeErrorMessage(args.errorMessage) !== undefined
        ? { anchorErrorMessage: sanitizeErrorMessage(args.errorMessage) }
        : {}),
      updatedAt: Date.now(),
    });

    return await getSubmissionOrThrow(ctx, args.submissionId);
  },
});

export const retrySubmissionAnchor = mutation({
  args: {
    submissionId: v.id("workSubmissions"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await getSubmissionOrThrow(ctx, args.submissionId);
    assertCanAnchorSubmission(submission, args.walletAddress);

    await ctx.db.patch(args.submissionId, {
      status: "submitted",
      onChainStatus: "not_submitted",
      anchorErrorMessage: undefined,
      updatedAt: Date.now(),
    });

    return await getSubmissionOrThrow(ctx, args.submissionId);
  },
});

export const cancelSubmissionDraft = mutation({
  args: {
    submissionId: v.id("workSubmissions"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const submission = await getSubmissionOrThrow(ctx, args.submissionId);
    assertSubmissionIsMutable(submission);

    const normalizedWallet = normalizeWalletAddress(args.walletAddress);
    if (normalizedWallet !== submission.submittedByWallet) {
      throw new BadRequestError("Only the assigned freelancer can cancel this proof draft.");
    }

    await ctx.db.patch(args.submissionId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return true;
  },
});
