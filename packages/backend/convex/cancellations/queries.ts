import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { assertCanViewAttachment } from "../attachments/helpers";
import {
  assertCanCreateCancellationRequest,
  assertCanRespondToCancellation,
  assertCanViewCancellation,
  getActiveCancellationRequestForParentInternal,
  getCancellationEligibilityForParent,
  withCancellationAttachments,
} from "./helpers";
import { cancellationParentTypeValidator } from "./schema";

async function withEventAttachments(
  ctx: QueryCtx,
  event: Doc<"cancellationEvents">,
  viewerWallet?: string,
) {
  const attachmentIds: Id<"attachments">[] =
    typeof event.metadata === "object" &&
    event.metadata !== null &&
    "attachmentIds" in event.metadata &&
    Array.isArray(event.metadata.attachmentIds)
      ? (event.metadata.attachmentIds as Id<"attachments">[])
      : [];
  const attachments = [];
  for (const attachmentId of attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) continue;
    try {
      await assertCanViewAttachment(ctx, attachment, viewerWallet);
      attachments.push({
        ...attachment,
        url: attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null,
      });
    } catch {
      // Hide inaccessible response evidence.
    }
  }
  return { ...event, attachments };
}

export const getCancellationRequest = query({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.cancellationRequestId);
    if (!request) return null;
    return await withCancellationAttachments(ctx, request, args.viewerWallet);
  },
});

export const getActiveCancellationRequestForParent = query({
  args: {
    parentType: cancellationParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await getActiveCancellationRequestForParentInternal(ctx, args);
    if (!request) return null;
    return await withCancellationAttachments(ctx, request, args.viewerWallet);
  },
});

export const getLatestCancellationRequestForParent = query({
  args: {
    parentType: cancellationParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requests = await ctx.db
      .query("cancellationRequests")
      .withIndex("by_parent_status", (q) =>
        q.eq("parentType", args.parentType).eq("parentId", args.parentId),
      )
      .order("desc")
      .take(50);
    const request = requests.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
    if (!request) return null;
    return await withCancellationAttachments(ctx, request, args.viewerWallet);
  },
});

export const getCancellationRequestsForWallet = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [clientRequests, freelancerRequests] = await Promise.all([
      ctx.db
        .query("cancellationRequests")
        .withIndex("by_client", (q) => q.eq("clientWallet", walletAddress))
        .order("desc")
        .take(50),
      ctx.db
        .query("cancellationRequests")
        .withIndex("by_freelancer", (q) => q.eq("freelancerWallet", walletAddress))
        .order("desc")
        .take(50),
    ]);

    const byId = new Map<string, Doc<"cancellationRequests">>();
    for (const request of [...clientRequests, ...freelancerRequests]) {
      byId.set(request._id, request);
    }

    return Array.from(byId.values()).sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const getCancellationTimeline = query({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.cancellationRequestId);
    if (!request) return [];
    assertCanViewCancellation(request, args.viewerWallet);

    const events = await ctx.db
      .query("cancellationEvents")
      .withIndex("by_cancellation", (q) =>
        q.eq("cancellationRequestId", args.cancellationRequestId),
      )
      .order("asc")
      .take(200);

    return await Promise.all(
      events.map((event) => withEventAttachments(ctx, event, args.viewerWallet)),
    );
  },
});

export const getCancellationEligibility = query({
  args: {
    parentType: cancellationParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const eligibility = await getCancellationEligibilityForParent(ctx, args);
    if (args.viewerWallet !== undefined) {
      const wallet = normalizeWalletAddress(args.viewerWallet);
      const activeRequestId = eligibility.activeCancellationRequestId;
      if (activeRequestId !== undefined) {
        const request = await ctx.db.get(activeRequestId);
        if (request) assertCanViewCancellation(request, wallet);
      }
    }
    return eligibility;
  },
});

export const canClientCancel = query({
  args: {
    parentType: cancellationParentTypeValidator,
    parentId: v.string(),
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const result = await assertCanCreateCancellationRequest(ctx, {
        parentType: args.parentType,
        parentId: args.parentId,
        requestedByWallet: args.clientWallet,
      });
      return {
        allowed: true,
        reason: null,
        eligibility: result.eligibility,
        parent: result.parent,
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Cancellation is not available.",
        eligibility: null,
        parent: null,
      };
    }
  },
});

export const canFreelancerRespondToCancellation = query({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.cancellationRequestId);
    if (!request) {
      return { allowed: false, reason: "Cancellation request not found.", role: null };
    }
    try {
      assertCanRespondToCancellation(request, args.freelancerWallet);
      return { allowed: true, reason: null, role: "freelancer" as const };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "You cannot respond to this request.",
        role: null,
      };
    }
  },
});
