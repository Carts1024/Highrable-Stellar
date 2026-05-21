import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { TAgreementStatus } from "./schema";

import { query } from "../_generated/server";
import { ForbiddenError, NotFoundError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { serializeAttachmentForViewer } from "../attachments/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanAcceptAgreement,
  assertCanCreateWorkAgreement,
  assertCanLockAgreement,
  assertCanRejectAgreement,
  assertCanSendAgreement,
  assertCanViewWorkAgreement,
  buildAgreementVersionFromAgreement,
  getActiveAgreementVersionForAgreement,
  getAcceptedAgreementForJob,
  getActiveAgreementByJob,
  getAgreementOrThrow,
  getCurrentAgreementByJob,
  resolveAgreementContextForParent,
  hasAcceptedAgreement as hasAcceptedAgreementForJob,
  requiresAcceptedAgreement as requiresAcceptedAgreementForParent,
} from "./helpers";

const FREELANCER_VISIBLE_AGREEMENT_STATUSES = new Set<TAgreementStatus>([
  "pending_acceptance",
  "accepted",
  "locked",
  "rejected",
  "superseded",
]);

function isSameWallet(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  return normalizeWalletAddress(left) === normalizeWalletAddress(right);
}

function isFreelancerVisibleAgreement(agreement: Doc<"workAgreements">): boolean {
  return FREELANCER_VISIBLE_AGREEMENT_STATUSES.has(agreement.status);
}

function compareAgreementsByVersionThenUpdate(
  left: Doc<"workAgreements">,
  right: Doc<"workAgreements">,
): number {
  if (left.version !== right.version) {
    return right.version - left.version;
  }
  return right.updatedAt - left.updatedAt;
}

async function getWorkAgreementByJobForViewer(
  ctx: QueryCtx,
  input: { jobId: Id<"jobs">; viewerWallet?: string },
) {
  const agreements = await ctx.db
    .query("workAgreements")
    .withIndex("by_job", (q) => q.eq("jobId", input.jobId))
    .collect();

  if (!input.viewerWallet) {
    return getCurrentAgreementByJob(ctx, input.jobId);
  }

  const viewerWallet = normalizeWalletAddress(input.viewerWallet);
  const clientAgreement = agreements.find((agreement) =>
    isSameWallet(agreement.clientWallet, viewerWallet),
  );

  if (clientAgreement) {
    return getCurrentAgreementByJob(ctx, input.jobId);
  }

  return (
    agreements
      .filter(
        (agreement) =>
          isSameWallet(agreement.freelancerWallet, viewerWallet) &&
          isFreelancerVisibleAgreement(agreement),
      )
      .sort(compareAgreementsByVersionThenUpdate)[0] ?? null
  );
}

async function serializeAgreementForViewer(
  ctx: QueryCtx,
  agreement: Doc<"workAgreements">,
  viewerWallet?: string,
) {
  await assertCanViewWorkAgreement(ctx, agreement, viewerWallet);
  const sourceAttachment = agreement.sourceAttachmentId
    ? await ctx.db.get(agreement.sourceAttachmentId)
    : null;

  return {
    ...agreement,
    sourceAttachment:
      sourceAttachment && viewerWallet
        ? await serializeAttachmentForViewer(ctx, sourceAttachment, viewerWallet)
        : null,
  };
}

export const getWorkAgreement = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agreement = await getAgreementOrThrow(ctx, args.agreementId);
    if (
      args.viewerWallet &&
      isSameWallet(agreement.freelancerWallet, args.viewerWallet) &&
      !isFreelancerVisibleAgreement(agreement)
    ) {
      return null;
    }
    return await serializeAgreementForViewer(ctx, agreement, args.viewerWallet);
  },
});

export const getAgreementForReview = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const agreement = await getAgreementOrThrow(ctx, args.agreementId);
    if (
      isSameWallet(agreement.freelancerWallet, args.viewerWallet) &&
      !isFreelancerVisibleAgreement(agreement)
    ) {
      return null;
    }
    return await serializeAgreementForViewer(ctx, agreement, args.viewerWallet);
  },
});

export const getAcceptedAgreementForParent = query({
  args: {
    jobId: v.id("jobs"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agreement = await getAcceptedAgreementForJob(ctx, args.jobId);
    if (!agreement) return null;
    return await serializeAgreementForViewer(ctx, agreement, args.viewerWallet);
  },
});

export const getAgreementStatusForParent = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const agreement = await getActiveAgreementByJob(ctx, args.jobId);
    return {
      status: agreement?.status ?? null,
      agreementId: agreement?._id ?? null,
      agreementHash: agreement?.agreementHash ?? null,
    };
  },
});

export const getWorkAgreementByJob = query({
  args: {
    jobId: v.id("jobs"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agreement = await getWorkAgreementByJobForViewer(ctx, args);
    if (!agreement) {
      return null;
    }
    try {
      return await serializeAgreementForViewer(ctx, agreement, args.viewerWallet);
    } catch (error) {
      if (!(error instanceof ForbiddenError) && !(error instanceof NotFoundError)) {
        throw error;
      }
      return null;
    }
  },
});

export const getWorkAgreementsForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [clientAgreements, freelancerAgreements] = await Promise.all([
      ctx.db
        .query("workAgreements")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", walletAddress))
        .order("desc")
        .take(100),
      ctx.db
        .query("workAgreements")
        .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", walletAddress))
        .order("desc")
        .take(100),
    ]);

    return [...clientAgreements, ...freelancerAgreements]
      .filter((agreement) => agreement.status !== "cancelled")
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 100);
  },
});

export const getWorkAgreementEvents = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const agreement = await getAgreementOrThrow(ctx, args.agreementId);
    await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
    return await ctx.db
      .query("workAgreementEvents")
      .withIndex("by_agreement", (q) => q.eq("agreementId", args.agreementId))
      .order("desc")
      .take(100);
  },
});

export const getAgreementEvents = getWorkAgreementEvents;

export const getAgreementAuditTimeline = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const agreement = await getAgreementOrThrow(ctx, args.agreementId);
    await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
    return await ctx.db
      .query("workAgreementEvents")
      .withIndex("by_agreement", (q) => q.eq("agreementId", args.agreementId))
      .order("asc")
      .take(200);
  },
});

export const getAgreementVersions = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const agreement = await getAgreementOrThrow(ctx, args.agreementId);
    await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
    const versions = await ctx.db
      .query("workAgreementVersions")
      .withIndex("by_agreement_version", (q) => q.eq("agreementId", args.agreementId))
      .order("asc")
      .take(50);
    if (versions.length > 0) return versions;
    if (agreement.status === "accepted" || agreement.status === "locked") {
      return [
        {
          ...buildAgreementVersionFromAgreement(agreement),
          _id: null,
          _creationTime: agreement._creationTime,
        },
      ];
    }
    return [];
  },
});

export const getActiveAgreementVersion = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const agreement = await getAgreementOrThrow(ctx, args.agreementId);
    await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
    return (
      (await getActiveAgreementVersionForAgreement(ctx, agreement)) ??
      (agreement.status === "accepted" || agreement.status === "locked"
        ? {
            ...buildAgreementVersionFromAgreement(agreement),
            _id: null,
            _creationTime: agreement._creationTime,
          }
        : null)
    );
  },
});

export const getAgreementVersion = query({
  args: {
    agreementVersionId: v.id("workAgreementVersions"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.agreementVersionId);
    if (!version) return null;
    const agreement = await getAgreementOrThrow(ctx, version.agreementId);
    await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
    return version;
  },
});

export const getAgreementContextForProof = query({
  args: {
    submissionId: v.optional(v.id("workSubmissions")),
    jobId: v.optional(v.id("jobs")),
    escrowId: v.optional(v.id("escrows")),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.submissionId) {
      const submission = await ctx.db.get(args.submissionId);
      if (!submission) return null;
      if (submission.agreementVersionId) {
        const version = await ctx.db.get(submission.agreementVersionId);
        if (version) {
          const agreement = await getAgreementOrThrow(ctx, version.agreementId);
          await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
          return {
            agreement,
            version,
            label: `Agreement v${version.versionNumber}`,
            agreementHash: submission.agreementHash ?? version.agreementHash ?? null,
            versionNumber: version.versionNumber,
            fallback: null,
          };
        }
      }
      return await resolveAgreementContextForParent(ctx, {
        ...(submission.jobId ? { jobId: submission.jobId } : {}),
        ...(submission.escrowId ? { escrowId: submission.escrowId } : {}),
        viewerWallet: args.viewerWallet,
      });
    }
    return await resolveAgreementContextForParent(ctx, args);
  },
});

export const getAgreementContextForRevision = query({
  args: {
    revisionRequestId: v.id("revisionRequests"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const revision = await ctx.db.get(args.revisionRequestId);
    if (!revision) return null;
    return await resolveAgreementContextForParent(ctx, {
      jobId: revision.jobId,
      ...(revision.escrowId ? { escrowId: revision.escrowId } : {}),
      viewerWallet: args.viewerWallet,
    });
  },
});

export const getAgreementContextForDispute = query({
  args: {
    disputeId: v.id("disputes"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) return null;
    if (dispute.agreementVersionId) {
      const version = await ctx.db.get(dispute.agreementVersionId);
      if (version) {
        const agreement = await getAgreementOrThrow(ctx, version.agreementId);
        await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
        return {
          agreement,
          version,
          label: `Agreement v${version.versionNumber}`,
          agreementHash: dispute.agreementHash ?? version.agreementHash ?? null,
          versionNumber: version.versionNumber,
          fallback: null,
        };
      }
    }
    return await resolveAgreementContextForParent(ctx, {
      ...(dispute.jobId ? { jobId: dispute.jobId } : {}),
      ...(dispute.escrowId ? { escrowId: dispute.escrowId } : {}),
      viewerWallet: args.viewerWallet,
    });
  },
});

export const getAgreementContextForCancellation = query({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.cancellationRequestId);
    if (!request) return null;
    if (request.agreementVersionId) {
      const version = await ctx.db.get(request.agreementVersionId);
      if (version) {
        const agreement = await getAgreementOrThrow(ctx, version.agreementId);
        await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
        return {
          agreement,
          version,
          label: `Agreement v${version.versionNumber}`,
          agreementHash: request.agreementHash ?? version.agreementHash ?? null,
          versionNumber: version.versionNumber,
          fallback: null,
        };
      }
    }
    return await resolveAgreementContextForParent(ctx, {
      ...(request.jobId ? { jobId: request.jobId } : {}),
      ...(request.escrowId ? { escrowId: request.escrowId } : {}),
      viewerWallet: args.viewerWallet,
    });
  },
});

export const canProposeAgreementAmendment = query({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const agreement = await getAgreementOrThrow(ctx, args.agreementId);
    try {
      await assertCanViewWorkAgreement(ctx, agreement, args.walletAddress);
    } catch (error) {
      return {
        allowed: false,
        reason:
          error instanceof Error
            ? error.message
            : "Only agreement participants can view this agreement.",
      };
    }
    return {
      allowed: false,
      reason:
        "Agreement amendments are deferred for this phase. Locked terms remain immutable until a reviewed amendment flow is enabled.",
    };
  },
});

export const canAcceptAgreementAmendment = canProposeAgreementAmendment;

export const canExportAgreement = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const agreement = await getAgreementOrThrow(ctx, args.agreementId);
      await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
      return {
        allowed: agreement.status === "accepted" || agreement.status === "locked",
        reason:
          agreement.status === "accepted" || agreement.status === "locked"
            ? null
            : "Only accepted or locked agreement versions can be exported.",
      };
    } catch (error) {
      return {
        allowed: false,
        reason:
          error instanceof Error ? error.message : "Agreement export failed. Please try again.",
      };
    }
  },
});

export const canCreateWorkAgreement = query({
  args: {
    jobId: v.id("jobs"),
    walletAddress: v.string(),
    walletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    try {
      await assertCanCreateWorkAgreement(ctx, args);
      return { allowed: true, reason: null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Work agreement cannot be created.",
      };
    }
  },
});

export const canSendAgreement = query({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await assertCanSendAgreement(ctx, args);
      return { allowed: true, reason: null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Agreement cannot be sent.",
      };
    }
  },
});

export const canAcceptAgreement = query({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await assertCanAcceptAgreement(ctx, args);
      return { allowed: true, reason: null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Agreement cannot be accepted.",
      };
    }
  },
});

export const canRejectAgreement = query({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await assertCanRejectAgreement(ctx, args);
      return { allowed: true, reason: null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Agreement cannot be rejected.",
      };
    }
  },
});

export const canLockAgreement = query({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      await assertCanLockAgreement(ctx, {
        agreementId: args.agreementId,
        ...(args.walletAddress ? { actorWallet: args.walletAddress } : {}),
      });
      return { allowed: true, reason: null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Agreement cannot be locked.",
      };
    }
  },
});

export const hasAcceptedAgreement = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await hasAcceptedAgreementForJob(ctx, args.jobId);
  },
});

export const requiresAcceptedAgreement = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    return job ? requiresAcceptedAgreementForParent(job) : true;
  },
});

export const canViewWorkAgreement = query({
  args: {
    agreementId: v.id("workAgreements"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const agreement = await getAgreementOrThrow(ctx, args.agreementId);
      await assertCanViewWorkAgreement(ctx, agreement, args.viewerWallet);
      return { allowed: true, reason: null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Work agreement cannot be viewed.",
      };
    }
  },
});
