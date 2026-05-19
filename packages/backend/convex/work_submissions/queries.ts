import { v } from "convex/values";

import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";
import { assertCanViewAttachment } from "../attachments/helpers";
import {
  assertCanViewSubmission,
  getEscrowByOnChainIdOrThrow,
  getSubmissionOrThrow,
} from "./helpers";
import { workSubmissionParentTypeValidator } from "./schema";

type TWorkSubmissionDoc = Awaited<ReturnType<typeof getSubmissionOrThrow>>;

function sortSubmissionsNewestFirst<
  TSubmission extends { submittedAt?: number; createdAt: number },
>(submissions: TSubmission[]): TSubmission[] {
  return [...submissions].sort((left, right) => {
    const leftTimestamp = left.submittedAt ?? left.createdAt;
    const rightTimestamp = right.submittedAt ?? right.createdAt;
    return rightTimestamp - leftTimestamp;
  });
}

async function withVisibleAttachments(
  ctx: QueryCtx,
  submission: TWorkSubmissionDoc,
  viewerWallet?: string,
) {
  assertCanViewSubmission(submission, viewerWallet);

  const attachments = [];
  for (const attachmentId of submission.attachmentIds) {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) {
      continue;
    }

    try {
      await assertCanViewAttachment(ctx, attachment, viewerWallet);
      attachments.push({
        ...attachment,
        url: attachment.storageId ? await ctx.storage.getUrl(attachment.storageId) : null,
      });
    } catch {
      // Keep private attachment existence hidden from unauthorized viewers.
    }
  }

  return {
    ...submission,
    attachments,
  };
}

export const getWorkSubmission = query({
  args: {
    submissionId: v.id("workSubmissions"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await getSubmissionOrThrow(ctx, args.submissionId);
    return await withVisibleAttachments(ctx, submission, args.viewerWallet);
  },
});

export const getSubmissionsByParent = query({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submissions = await ctx.db
      .query("workSubmissions")
      .withIndex("by_parent", (q) =>
        q.eq("parentType", args.parentType).eq("parentId", args.parentId),
      )
      .order("desc")
      .take(50);

    const visible = [];
    for (const submission of sortSubmissionsNewestFirst(submissions)) {
      try {
        visible.push(await withVisibleAttachments(ctx, submission, args.viewerWallet));
      } catch {
        // Do not leak private submissions.
      }
    }

    return visible;
  },
});

export const getSubmissionsByEscrow = query({
  args: {
    onChainEscrowId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const escrow = await getEscrowByOnChainIdOrThrow(ctx, args.onChainEscrowId);
    const submissions = await ctx.db
      .query("workSubmissions")
      .withIndex("by_convex_escrow", (q) => q.eq("escrowId", escrow._id))
      .order("desc")
      .take(50);

    const visible = [];
    for (const submission of sortSubmissionsNewestFirst(submissions)) {
      try {
        visible.push(await withVisibleAttachments(ctx, submission, args.viewerWallet));
      } catch {
        // Do not leak private submissions.
      }
    }

    return visible;
  },
});

export const getLatestSubmissionForEscrow = query({
  args: {
    onChainEscrowId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const escrow = await getEscrowByOnChainIdOrThrow(ctx, args.onChainEscrowId);
    const submissions = await ctx.db
      .query("workSubmissions")
      .withIndex("by_convex_escrow", (q) => q.eq("escrowId", escrow._id))
      .order("desc")
      .take(10);

    for (const submission of sortSubmissionsNewestFirst(submissions)) {
      try {
        return await withVisibleAttachments(ctx, submission, args.viewerWallet);
      } catch {
        // Try the next visible submission.
      }
    }

    return null;
  },
});

export const getMyWorkSubmissions = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const submissions = await ctx.db
      .query("workSubmissions")
      .withIndex("by_submitter", (q) => q.eq("submittedByWallet", walletAddress))
      .order("desc")
      .take(50);

    return await Promise.all(
      sortSubmissionsNewestFirst(submissions).map((submission) =>
        withVisibleAttachments(ctx, submission, walletAddress),
      ),
    );
  },
});
