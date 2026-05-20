import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { ForbiddenError } from "../_shared/errors";
import { normalizeWalletAddress } from "../_shared/input";
import { assertCanViewAttachment } from "../attachments/helpers";
import { workSubmissionParentTypeValidator } from "../work_submissions/schema";
import {
  assertCanRequestRevision,
  assertCanSubmitRevision,
  assertParticipantCanViewRevision,
  computeRemainingRevisions,
  getActiveRevisionRequestForParent,
  getRevisionPolicyConfig,
  resolveRevisionParent,
} from "./helpers";

type TRevisionDoc = Doc<"revisionRequests">;

async function withVisibleAttachments(
  ctx: QueryCtx,
  revision: TRevisionDoc,
  viewerWallet?: string,
) {
  assertParticipantCanViewRevision(revision, viewerWallet);

  const attachments = [];
  for (const attachmentId of revision.attachmentIds) {
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
      // Keep private attachment existence hidden.
    }
  }

  return { ...revision, attachments };
}

export const getRevisionPolicyForParent = query({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = await resolveRevisionParent(ctx, args);
    if (args.viewerWallet) {
      const viewerWallet = normalizeWalletAddress(args.viewerWallet);
      if (viewerWallet !== parent.clientWallet && viewerWallet !== parent.freelancerWallet) {
        throw new ForbiddenError("You do not have permission to view this revision policy.");
      }
    }
    const config = getRevisionPolicyConfig(parent);

    return {
      ...config,
      remainingRevisions: computeRemainingRevisions(config),
      activeRevisionId: parent.activeRevisionId,
      revisionStatus: parent.status,
    };
  },
});

export const getRemainingRevisionCount = query({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
  },
  handler: async (ctx, args) => {
    const parent = await resolveRevisionParent(ctx, args);
    return computeRemainingRevisions(getRevisionPolicyConfig(parent));
  },
});

export const getRevisionRequest = query({
  args: {
    revisionRequestId: v.id("revisionRequests"),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const revision = await ctx.db.get(args.revisionRequestId);
    if (!revision) {
      return null;
    }

    return await withVisibleAttachments(ctx, revision, args.viewerWallet);
  },
});

export const getRevisionRequestsByParent = query({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const revisions = await ctx.db
      .query("revisionRequests")
      .withIndex("by_parent", (q) => q.eq("parentType", args.parentType).eq("parentId", args.parentId))
      .order("desc")
      .take(50);

    const visible = [];
    for (const revision of revisions) {
      try {
        visible.push(await withVisibleAttachments(ctx, revision, args.viewerWallet));
      } catch {
        // Do not leak private revisions.
      }
    }

    return visible;
  },
});

export const getActiveRevisionRequest = query({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const revision = await getActiveRevisionRequestForParent(ctx, args);
    if (!revision) {
      return null;
    }

    return await withVisibleAttachments(ctx, revision, args.viewerWallet);
  },
});

export const canRequestRevision = query({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    clientWallet: v.string(),
    workSubmissionId: v.id("workSubmissions"),
  },
  handler: async (ctx, args) => {
    try {
      const result = await assertCanRequestRevision(ctx, args);
      return {
        allowed: true,
        reason: null,
        remainingRevisions: computeRemainingRevisions(result.config),
      };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Revision cannot be requested.",
        remainingRevisions: 0,
      };
    }
  },
});

export const canSubmitRevision = query({
  args: {
    revisionRequestId: v.id("revisionRequests"),
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await assertCanSubmitRevision(ctx, args);
      return { allowed: true, reason: null };
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : "Revision cannot be submitted.",
      };
    }
  },
});

export const getRevisionTimeline = query({
  args: {
    parentType: workSubmissionParentTypeValidator,
    parentId: v.string(),
    viewerWallet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [submissions, revisions] = await Promise.all([
      ctx.db
        .query("workSubmissions")
        .withIndex("by_parent", (q) =>
          q.eq("parentType", args.parentType).eq("parentId", args.parentId),
        )
        .take(100),
      ctx.db
        .query("revisionRequests")
        .withIndex("by_parent", (q) => q.eq("parentType", args.parentType).eq("parentId", args.parentId))
        .take(100),
    ]);

    const events: Array<{
      kind: "submission" | "revision_request";
      at: number;
      submission?: (typeof submissions)[number];
      revision?: TRevisionDoc;
    }> = [];

    for (const submission of submissions) {
      try {
        const viewer = args.viewerWallet ? normalizeWalletAddress(args.viewerWallet) : undefined;
        if (!viewer) {
          continue;
        }
        if (
          viewer !== submission.clientWallet &&
          viewer !== submission.freelancerWallet &&
          viewer !== submission.submittedByWallet
        ) {
          continue;
        }
        events.push({
          kind: "submission",
          at: submission.submittedAt ?? submission.createdAt,
          submission,
        });
      } catch {
        // Do not leak private submissions.
      }
    }

    for (const revision of revisions) {
      try {
        assertParticipantCanViewRevision(revision, args.viewerWallet);
        events.push({
          kind: "revision_request",
          at: revision.requestedAt,
          revision,
        });
      } catch {
        // Do not leak private revisions.
      }
    }

    return events.sort((left, right) => left.at - right.at);
  },
});
