import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { serializeAttachmentForViewer } from "../attachments/helpers";
import { walletTypeValidator } from "../users/schema";
import {
  assertCanCreateWorkAgreement,
  assertCanViewWorkAgreement,
  getActiveAgreementByJob,
  getAgreementOrThrow,
} from "./helpers";

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
    return await serializeAgreementForViewer(ctx, agreement, args.viewerWallet);
  },
});

export const getWorkAgreementByJob = query({
  args: {
    jobId: v.id("jobs"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agreement = await getActiveAgreementByJob(ctx, args.jobId);
    if (!agreement) {
      return null;
    }
    return await serializeAgreementForViewer(ctx, agreement, args.viewerWallet);
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
