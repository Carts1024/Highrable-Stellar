import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { BadRequestError, NotFoundError } from "../_shared/errors";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanCreateWorkAgreement,
  assertCanEditWorkAgreement,
  assertCanViewWorkAgreement,
  buildAgreementSnapshot,
  buildBaseAgreementFields,
  createWorkAgreementEvent as insertWorkAgreementEvent,
  renderHighrableAgreementMarkdown,
  resolveAgreementSource,
  sanitizeAgreementUpdate,
  validateAgreementSourceAttachment,
} from "./helpers";
import {
  agreementActorRoleValidator,
  agreementEventTypeValidator,
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
