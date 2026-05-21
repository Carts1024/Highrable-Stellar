import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, NotFoundError } from "../_shared/errors";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanAcceptAgreement,
  assertCanCreateWorkAgreement,
  assertCanEditWorkAgreement,
  assertCanLockAgreement,
  assertCanRejectAgreement,
  assertCanSendAgreement,
  assertCanViewWorkAgreement,
  buildAgreementHashManifest,
  buildAgreementImmutableSnapshot,
  buildAgreementSnapshot,
  buildBaseAgreementFields,
  createAgreementNotification,
  createAgreementSystemMessage,
  createWorkAgreementEvent as insertWorkAgreementEvent,
  ensureAgreementVersionForAgreement,
  hashAgreementManifest,
  lockWorkAgreementForCommitment,
  renderHighrableAgreementMarkdown,
  resolveAgreementSource,
  sanitizeAgreementUpdate,
  validateAgreementSourceAttachment,
} from "./helpers";
import {
  agreementActorRoleValidator,
  agreementEventTypeValidator,
  agreementLockReasonValidator,
  agreementLockedByValidator,
  agreementStatusValidator,
} from "./schema";

export const createWorkAgreementDraft = mutation({
  args: {
    jobId: v.id("jobs"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    agreementType: v.union(v.literal("client_uploaded"), v.literal("highrable_generated")),
    title: v.optional(v.string()),
    freelancerWalletType: v.optional(walletTypeValidator),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { job, walletAddress } = await assertCanCreateWorkAgreement(ctx, args);
    const { escrow } = await resolveAgreementSource(ctx, args.jobId);
    const now = Date.now();
    const agreementId = await ctx.db.insert("workAgreements", {
      ...buildBaseAgreementFields({
        now,
        job,
        escrow,
        walletAddress,
        walletType: args.walletType,
        freelancerWalletType: args.freelancerWalletType,
        agreementType: args.agreementType,
        title: args.title,
      }),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });

    await insertWorkAgreementEvent(ctx, {
      agreementId,
      jobId: args.jobId,
      ...(escrow ? { escrowId: escrow._id } : {}),
      type: "agreement_draft_created",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Work agreement draft created.",
      newStatus: "draft",
    });

    return agreementId;
  },
});

export const createClientUploadedAgreement = mutation({
  args: {
    jobId: v.id("jobs"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    sourceAttachmentId: v.id("attachments"),
    title: v.optional(v.string()),
    freelancerWalletType: v.optional(walletTypeValidator),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { job, walletAddress } = await assertCanCreateWorkAgreement(ctx, args);
    const { escrow } = await resolveAgreementSource(ctx, args.jobId);
    const source = await validateAgreementSourceAttachment(ctx, {
      attachmentId: args.sourceAttachmentId,
      clientWallet: walletAddress,
    });
    const now = Date.now();
    const agreementId = await ctx.db.insert("workAgreements", {
      ...buildBaseAgreementFields({
        now,
        job,
        escrow,
        walletAddress,
        walletType: args.walletType,
        freelancerWalletType: args.freelancerWalletType,
        agreementType: "client_uploaded",
        title: args.title ?? `${job.title} Client-Uploaded Agreement`,
      }),
      status: "pending_preview",
      sourceAttachmentId: args.sourceAttachmentId,
      metadata: {
        previewSupported: source.previewSupported,
        sourceFileName: source.attachment.name,
        ...(args.metadata && typeof args.metadata === "object" ? args.metadata : {}),
      },
    });

    await ctx.db.patch(args.sourceAttachmentId, {
      parentType: "work_agreement",
      parentId: agreementId,
      visibility: "participants",
      updatedAt: now,
    });

    await insertWorkAgreementEvent(ctx, {
      agreementId,
      jobId: args.jobId,
      ...(escrow ? { escrowId: escrow._id } : {}),
      type: "client_uploaded_agreement",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Client uploaded a work agreement file.",
      newStatus: "pending_preview",
      metadata: { sourceAttachmentId: args.sourceAttachmentId },
    });

    return agreementId;
  },
});

export const generateHighrableWorkAgreement = mutation({
  args: {
    jobId: v.id("jobs"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    title: v.optional(v.string()),
    freelancerWalletType: v.optional(walletTypeValidator),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { job, walletAddress } = await assertCanCreateWorkAgreement(ctx, args);
    const { escrow } = await resolveAgreementSource(ctx, args.jobId);
    const snapshot = await buildAgreementSnapshot(ctx, {
      jobId: args.jobId,
      generatedByWallet: walletAddress,
      generatedByWalletType: args.walletType,
      clientWalletType: args.walletType,
      freelancerWalletType: args.freelancerWalletType,
      version: 1,
    });
    const now = Date.now();
    const contentMarkdown = renderHighrableAgreementMarkdown(snapshot);
    const agreementId = await ctx.db.insert("workAgreements", {
      ...buildBaseAgreementFields({
        now,
        job,
        escrow,
        walletAddress,
        walletType: args.walletType,
        freelancerWalletType: args.freelancerWalletType,
        agreementType: "highrable_generated",
        title: args.title ?? `${job.title} Highrable Work Agreement`,
      }),
      status: "pending_preview",
      contentMarkdown,
      generatedFromSnapshot: snapshot,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });

    await insertWorkAgreementEvent(ctx, {
      agreementId,
      jobId: args.jobId,
      ...(escrow ? { escrowId: escrow._id } : {}),
      type: "highrable_agreement_generated",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Highrable-generated work agreement created.",
      newStatus: "pending_preview",
    });

    return agreementId;
  },
});

export const regenerateHighrableWorkAgreement = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    freelancerWalletType: v.optional(walletTypeValidator),
  },
  handler: async (ctx, args) => {
    const { agreement, walletAddress } = await assertCanEditWorkAgreement(ctx, args);
    if (agreement.agreementType !== "highrable_generated") {
      throw new BadRequestError("Only Highrable-generated agreement drafts can be regenerated.");
    }
    const version = agreement.version + 1;
    const snapshot = await buildAgreementSnapshot(ctx, {
      jobId: agreement.jobId,
      generatedByWallet: walletAddress,
      generatedByWalletType: args.walletType,
      clientWalletType: args.walletType,
      freelancerWalletType: args.freelancerWalletType ?? agreement.freelancerWalletType,
      version,
    });
    const contentMarkdown = renderHighrableAgreementMarkdown(snapshot);
    const now = Date.now();

    await ctx.db.patch(args.agreementId, {
      version,
      contentMarkdown,
      generatedFromSnapshot: snapshot,
      paymentAmount: snapshot.paymentAmount,
      paymentAssetContractId: snapshot.paymentAssetContractId,
      paymentAssetSymbol: snapshot.paymentAssetSymbol,
      paymentAssetDecimals: snapshot.paymentAssetDecimals,
      ...(snapshot.deadlineAt ? { deadlineAt: snapshot.deadlineAt } : {}),
      updatedAt: now,
    });

    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_updated",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Highrable work agreement draft regenerated.",
      oldStatus: agreement.status,
      newStatus: agreement.status,
      metadata: { version },
    });

    return true;
  },
});

export const updateWorkAgreementDraft = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    title: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { agreement, walletAddress } = await assertCanEditWorkAgreement(ctx, args);
    const patch = sanitizeAgreementUpdate(args);
    if (Object.keys(patch).length === 0) {
      throw new BadRequestError("No agreement updates were provided.");
    }
    await ctx.db.patch(args.agreementId, { ...patch, updatedAt: Date.now() });
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_updated",
      actorWallet: walletAddress,
      actorWalletType: agreement.createdByWalletType,
      actorRole: "client",
      message: "Work agreement draft updated.",
      oldStatus: agreement.status,
      newStatus: agreement.status,
    });
    return true;
  },
});

export const markWorkAgreementReadyToSend = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    status: v.optional(v.union(v.literal("ready_to_send"), v.literal("pending_acceptance"))),
  },
  handler: async (ctx, args) => {
    const { agreement, walletAddress } = await assertCanEditWorkAgreement(ctx, args);
    if (agreement.agreementType === "highrable_generated" && !agreement.contentMarkdown) {
      throw new BadRequestError("Agreement preview could not be generated. Please try again.");
    }
    if (agreement.agreementType === "client_uploaded" && !agreement.sourceAttachmentId) {
      throw new BadRequestError("Uploaded agreement file missing.");
    }
    const newStatus = args.status ?? "ready_to_send";
    await ctx.db.patch(args.agreementId, {
      status: newStatus,
      updatedAt: Date.now(),
    });
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_ready_to_send",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Work agreement prepared for review.",
      oldStatus: agreement.status,
      newStatus,
    });
    return true;
  },
});

export const sendAgreementForAcceptance = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const { agreement, walletAddress, freelancerWalletType } = await assertCanSendAgreement(
      ctx,
      args,
    );
    const now = Date.now();
    await ctx.db.patch(args.agreementId, {
      status: "pending_acceptance",
      sentToFreelancerAt: now,
      freelancerWalletType,
      updatedAt: now,
    });
    const updatedAgreement = {
      ...agreement,
      status: "pending_acceptance" as const,
      sentToFreelancerAt: now,
      freelancerWalletType,
      updatedAt: now,
    };
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_sent",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Client sent the work agreement for freelancer review.",
      oldStatus: agreement.status,
      newStatus: "pending_acceptance",
    });
    await createAgreementSystemMessage(ctx, {
      agreement: updatedAgreement,
      eventType: "agreement_sent",
      body: "Work agreement sent: Client sent the agreement for freelancer review.",
    });
    if (agreement.freelancerWallet) {
      await createAgreementNotification(ctx, {
        recipientWallet: agreement.freelancerWallet,
        recipientWalletType: freelancerWalletType,
        type: "agreement_sent",
        title: "Work agreement ready for review",
        body: "The client sent a work agreement for your review.",
        jobId: agreement.jobId,
        ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
        ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
        agreementId: args.agreementId,
      });
    }
    return true;
  },
});

export const recordAgreementViewed = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    const viewerWallet = await assertCanViewWorkAgreement(ctx, agreement, args.walletAddress);
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_viewed_by_freelancer",
      actorWallet: viewerWallet,
      actorWalletType: args.walletType,
      actorRole: viewerWallet === agreement.freelancerWallet ? "freelancer" : "client",
      message: "Work agreement viewed.",
      oldStatus: agreement.status,
      newStatus: agreement.status,
    });
    return true;
  },
});

export const acceptWorkAgreement = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const { agreement, walletAddress } = await assertCanAcceptAgreement(ctx, args);
    const acceptedAt = Date.now();
    const immutableSnapshot = await buildAgreementImmutableSnapshot(ctx, {
      agreement,
      acceptedAt,
      freelancerWalletType: args.walletType,
    });
    const manifest = await buildAgreementHashManifest(ctx, { agreement, immutableSnapshot });
    const agreementHash = await hashAgreementManifest(manifest);
    await ctx.db.patch(args.agreementId, {
      status: "accepted",
      acceptedByFreelancerAt: acceptedAt,
      acceptedByFreelancerWallet: walletAddress,
      acceptedByFreelancerWalletType: args.walletType,
      immutableSnapshot,
      agreementHash,
      hashAlgorithm: "sha256",
      hashEncoding: "hex",
      acceptedSnapshotHash: agreementHash,
      updatedAt: acceptedAt,
    });
    const updatedAgreement = {
      ...agreement,
      status: "accepted" as const,
      agreementHash,
      immutableSnapshot,
      acceptedByFreelancerAt: acceptedAt,
      acceptedByFreelancerWallet: walletAddress,
      acceptedByFreelancerWalletType: args.walletType,
      updatedAt: acceptedAt,
    };
    const acceptedVersion = await ensureAgreementVersionForAgreement(ctx, {
      agreement: updatedAgreement,
      status: "accepted",
    });
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      ...(acceptedVersion ? { agreementVersionId: acceptedVersion._id } : {}),
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_hash_generated",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "freelancer",
      message: "Agreement hash generated.",
      oldStatus: agreement.status,
      newStatus: "accepted",
      metadata: { agreementHash, hashAlgorithm: "sha256", hashEncoding: "hex" },
    });
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      ...(acceptedVersion ? { agreementVersionId: acceptedVersion._id } : {}),
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_accepted",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "freelancer",
      message: "Freelancer accepted the work agreement.",
      oldStatus: agreement.status,
      newStatus: "accepted",
      metadata: { agreementHash },
    });
    await createAgreementSystemMessage(ctx, {
      agreement: updatedAgreement,
      eventType: "agreement_accepted",
      body: "Work agreement accepted: Freelancer accepted the agreement.",
      agreementHash,
    });
    await createAgreementNotification(ctx, {
      recipientWallet: agreement.clientWallet,
      recipientWalletType: agreement.clientWalletType,
      type: "agreement_accepted",
      title: "Work agreement accepted",
      body: "The selected freelancer accepted the work agreement.",
      jobId: agreement.jobId,
      ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      agreementId: args.agreementId,
      agreementHash,
    });
    return { agreementHash };
  },
});

export const rejectWorkAgreement = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { agreement, walletAddress } = await assertCanRejectAgreement(ctx, args);
    const now = Date.now();
    const rejectionReason = args.rejectionReason?.replace(/\r\n?/g, "\n").trim().slice(0, 1000);
    await ctx.db.patch(args.agreementId, {
      status: "rejected",
      rejectedByFreelancerAt: now,
      rejectedByFreelancerWallet: walletAddress,
      rejectedByFreelancerWalletType: args.walletType,
      ...(rejectionReason ? { rejectionReason } : {}),
      updatedAt: now,
    });
    const updatedAgreement = { ...agreement, status: "rejected" as const, updatedAt: now };
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_rejected",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "freelancer",
      message: "Freelancer rejected the work agreement.",
      oldStatus: agreement.status,
      newStatus: "rejected",
      ...(rejectionReason ? { metadata: { rejectionReason } } : {}),
    });
    await createAgreementSystemMessage(ctx, {
      agreement: updatedAgreement,
      eventType: "agreement_rejected",
      body: "Work agreement rejected: Freelancer rejected the agreement.",
    });
    await createAgreementNotification(ctx, {
      recipientWallet: agreement.clientWallet,
      recipientWalletType: agreement.clientWalletType,
      type: "agreement_rejected",
      title: "Work agreement rejected",
      body: "The selected freelancer rejected the work agreement.",
      jobId: agreement.jobId,
      ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      agreementId: args.agreementId,
    });
    return true;
  },
});

export const confirmAcceptedAgreement = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    if (agreement.clientWallet !== args.walletAddress) {
      throw new BadRequestError("Only the client can confirm this agreement.");
    }
    if (agreement.status !== "accepted") {
      throw new BadRequestError("Only accepted agreements can be confirmed.");
    }
    const now = Date.now();
    await ctx.db.patch(args.agreementId, {
      clientConfirmedAt: now,
      clientConfirmedByWallet: args.walletAddress,
      clientConfirmedByWalletType: args.walletType,
      updatedAt: now,
    });
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "client_confirmation_recorded",
      actorWallet: args.walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Client confirmed the accepted work agreement.",
      oldStatus: agreement.status,
      newStatus: agreement.status,
    });
    return true;
  },
});

export const lockWorkAgreement = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    lockedBy: v.optional(agreementLockedByValidator),
    lockReason: v.optional(agreementLockReasonValidator),
  },
  handler: async (ctx, args) => {
    const agreement = await assertCanLockAgreement(ctx, {
      agreementId: args.agreementId,
      actorWallet: args.walletAddress,
    });
    return await lockWorkAgreementForCommitment(ctx, {
      agreement,
      lockedBy: args.lockedBy ?? "client",
      lockReason: args.lockReason ?? "manual_lock",
      actorWallet: args.walletAddress,
      actorWalletType: args.walletType,
    });
  },
});

export const cancelWorkAgreementDraft = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const { agreement, walletAddress } = await assertCanEditWorkAgreement(ctx, args);
    await ctx.db.patch(args.agreementId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_cancelled",
      actorWallet: walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Work agreement draft cancelled.",
      oldStatus: agreement.status,
      newStatus: "cancelled",
    });
    return true;
  },
});

export const cancelPendingAgreement = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    statusReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    if (agreement.clientWallet !== args.walletAddress) {
      throw new BadRequestError("Only the client can cancel this agreement.");
    }
    if (
      agreement.status !== "draft" &&
      agreement.status !== "pending_preview" &&
      agreement.status !== "ready_to_send" &&
      agreement.status !== "pending_acceptance" &&
      agreement.status !== "accepted"
    ) {
      throw new BadRequestError("This agreement cannot be cancelled.");
    }
    const job = await ctx.db.get(agreement.jobId);
    const escrow = agreement.escrowId ? await ctx.db.get(agreement.escrowId) : null;
    if (
      agreement.status === "accepted" &&
      (job?.status === "funded" || job?.status === "submitted" || escrow?.status === "funded")
    ) {
      throw new BadRequestError(
        "Accepted agreement cannot be cancelled after work starts or escrow is funded.",
      );
    }
    const now = Date.now();
    const statusReason = args.statusReason?.trim().slice(0, 500);
    await ctx.db.patch(args.agreementId, {
      status: "cancelled",
      ...(statusReason ? { statusReason } : {}),
      updatedAt: now,
    });
    await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_cancelled",
      actorWallet: args.walletAddress,
      actorWalletType: args.walletType,
      actorRole: "client",
      message: "Work agreement flow cancelled.",
      oldStatus: agreement.status,
      newStatus: "cancelled",
      ...(statusReason ? { metadata: { statusReason } } : {}),
    });
    return true;
  },
});

export const createAgreementVersionFromLockedAgreement = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    await assertCanViewWorkAgreement(ctx, agreement, args.walletAddress);
    if (agreement.status !== "accepted" && agreement.status !== "locked") {
      throw new BadRequestError("Only accepted or locked agreements can be versioned.");
    }
    return await ensureAgreementVersionForAgreement(ctx, { agreement });
  },
});

export const proposeAgreementAmendment = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    await assertCanViewWorkAgreement(ctx, agreement, args.walletAddress);
    await insertWorkAgreementEvent(ctx, {
      agreementId: agreement._id,
      jobId: agreement.jobId,
      ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "amendment_proposed",
      actorWallet: args.walletAddress,
      actorWalletType: args.walletType,
      actorRole: agreement.clientWallet === args.walletAddress ? "client" : "freelancer",
      message: "Agreement amendment requested, but amendment editing is not enabled yet.",
      oldStatus: agreement.status,
      newStatus: agreement.status,
      metadata: {
        deferred: true,
        ...(args.reason ? { reason: args.reason.slice(0, 500) } : {}),
      },
    });
    throw new BadRequestError(
      "Agreement amendments are deferred for this phase. Locked terms remain immutable.",
    );
  },
});

export const acceptAgreementAmendment = mutation({
  args: {
    agreementVersionId: v.id("workAgreementVersions"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
  },
  handler: async () => {
    throw new BadRequestError("Agreement amendments are deferred for this phase.");
  },
});

export const rejectAgreementAmendment = mutation({
  args: {
    agreementVersionId: v.id("workAgreementVersions"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    reason: v.optional(v.string()),
  },
  handler: async () => {
    throw new BadRequestError("Agreement amendments are deferred for this phase.");
  },
});

export const recordAgreementReferenced = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    agreementVersionId: v.optional(v.id("workAgreementVersions")),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    relatedEntityType: v.string(),
    relatedEntityId: v.string(),
    type: v.union(
      v.literal("agreement_referenced_in_proof_review"),
      v.literal("agreement_referenced_in_revision"),
      v.literal("agreement_referenced_in_dispute"),
      v.literal("agreement_referenced_in_cancellation"),
    ),
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    await assertCanViewWorkAgreement(ctx, agreement, args.walletAddress);
    return await insertWorkAgreementEvent(ctx, {
      agreementId: agreement._id,
      ...(args.agreementVersionId ? { agreementVersionId: args.agreementVersionId } : {}),
      jobId: agreement.jobId,
      ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: args.type,
      actorWallet: args.walletAddress,
      actorWalletType: args.walletType,
      actorRole: agreement.clientWallet === args.walletAddress ? "client" : "freelancer",
      message: "Agreement referenced for workflow review.",
      oldStatus: agreement.status,
      newStatus: agreement.status,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: args.relatedEntityId,
    });
  },
});

export const recordAgreementExported = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    agreementVersionId: v.optional(v.id("workAgreementVersions")),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    await assertCanViewWorkAgreement(ctx, agreement, args.walletAddress);
    if (agreement.status !== "accepted" && agreement.status !== "locked") {
      throw new BadRequestError("Only accepted or locked agreement versions can be exported.");
    }
    return await insertWorkAgreementEvent(ctx, {
      agreementId: agreement._id,
      ...(args.agreementVersionId ? { agreementVersionId: args.agreementVersionId } : {}),
      jobId: agreement.jobId,
      ...(agreement.milestoneId ? { milestoneId: agreement.milestoneId } : {}),
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: "agreement_exported",
      actorWallet: args.walletAddress,
      actorWalletType: args.walletType,
      actorRole: agreement.clientWallet === args.walletAddress ? "client" : "freelancer",
      message: "Agreement exported.",
      oldStatus: agreement.status,
      newStatus: agreement.status,
      metadata: { agreementHash: agreement.agreementHash },
    });
  },
});

export const createWorkAgreementEvent = mutation({
  args: {
    agreementId: v.id("workAgreements"),
    walletAddress: v.string(),
    walletType: walletTypeValidator,
    actorRole: agreementActorRoleValidator,
    type: agreementEventTypeValidator,
    message: v.string(),
    oldStatus: v.optional(agreementStatusValidator),
    newStatus: v.optional(agreementStatusValidator),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new NotFoundError("Work agreement not found.");
    }
    await assertCanViewWorkAgreement(ctx, agreement, args.walletAddress);
    return await insertWorkAgreementEvent(ctx, {
      agreementId: args.agreementId,
      jobId: agreement.jobId,
      ...(agreement.escrowId ? { escrowId: agreement.escrowId } : {}),
      type: args.type,
      actorWallet: args.walletAddress,
      actorWalletType: args.walletType,
      actorRole: args.actorRole,
      message: args.message,
      ...(args.oldStatus ? { oldStatus: args.oldStatus } : {}),
      ...(args.newStatus ? { newStatus: args.newStatus } : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  },
});
