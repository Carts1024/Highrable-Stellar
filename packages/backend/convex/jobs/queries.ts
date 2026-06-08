import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { TConversationParentType } from "../conversations/schema";

import { query } from "../_generated/server";
import { sanitizeClientWallet, sanitizeFreelancerWallet } from "./helpers";

const MARKETPLACE_JOB_STATUSES = [
  "open",
  "selected",
  "funded",
  "submitted",
  "revision_requested",
  "revision_submitted",
] as const;
const MARKETPLACE_STATUS_LIMIT = 75;

type TConversationParentRef = {
  parentType: TConversationParentType;
  parentId: string;
};

function isBlockingMarketplaceConversation(conversation: Doc<"conversations"> | null): boolean {
  return Boolean(
    conversation &&
    (conversation.status === "active" ||
      conversation.lastMessageId !== undefined ||
      conversation.lastMessageAt !== undefined),
  );
}

async function hasBlockingConversationForParent(
  ctx: QueryCtx,
  parent: TConversationParentRef,
): Promise<boolean> {
  const conversation = await ctx.db
    .query("conversations")
    .withIndex("by_parent", (q) =>
      q.eq("parentType", parent.parentType).eq("parentId", parent.parentId),
    )
    .first();

  return isBlockingMarketplaceConversation(conversation);
}

async function canShowJobInPublicFeeds(ctx: QueryCtx, job: Doc<"jobs">): Promise<boolean> {
  if (job.selectedFreelancerWallet !== undefined) {
    return false;
  }

  const milestones = await ctx.db
    .query("milestones")
    .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
    .take(500);

  if (milestones.some((milestone) => milestone.assignedFreelancerWallet !== undefined)) {
    return false;
  }

  const escrows = await ctx.db
    .query("escrows")
    .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
    .take(100);

  const conversationParents: TConversationParentRef[] = [
    { parentType: "job", parentId: job._id },
    { parentType: "micro_gig", parentId: job._id },
    ...milestones.map((milestone) => ({
      parentType: "milestone" as const,
      parentId: milestone._id,
    })),
    ...escrows.map((escrow) => ({
      parentType: "escrow" as const,
      parentId: escrow._id,
    })),
  ];

  for (const parent of conversationParents) {
    if (await hasBlockingConversationForParent(ctx, parent)) {
      return false;
    }
  }

  return true;
}

async function getFirstEscrowForJob(ctx: QueryCtx, jobId: Id<"jobs">) {
  const escrows = await ctx.db
    .query("escrows")
    .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
    .take(1);

  return escrows[0] ?? null;
}

export const getJob = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const listOpenJobs = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(100);

    const visibleJobs = [];
    for (const job of jobs) {
      if (await canShowJobInPublicFeeds(ctx, job)) {
        visibleJobs.push(job);
      }
    }

    return visibleJobs;
  },
});

export const listMarketplaceJobs = query({
  args: {},
  handler: async (ctx) => {
    const jobsByStatus = await Promise.all(
      MARKETPLACE_JOB_STATUSES.map((status) =>
        ctx.db
          .query("jobs")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .take(MARKETPLACE_STATUS_LIMIT),
      ),
    );

    const rows = [];
    for (const job of jobsByStatus.flat()) {
      if (!(await canShowJobInPublicFeeds(ctx, job))) {
        continue;
      }

      rows.push({
        job,
        escrow: await getFirstEscrowForJob(ctx, job._id),
      });
    }

    return rows;
  },
});

export const listJobsByClient = query({
  args: {
    clientWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const clientWallet = sanitizeClientWallet(args.clientWallet);

    return await ctx.db
      .query("jobs")
      .withIndex("by_clientWallet", (q) => q.eq("clientWallet", clientWallet))
      .order("desc")
      .take(100);
  },
});

export const listJobsByFreelancer = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const freelancerWallet = sanitizeFreelancerWallet(args.freelancerWallet);

    return await ctx.db
      .query("jobs")
      .withIndex("by_selectedFreelancerWallet", (q) =>
        q.eq("selectedFreelancerWallet", freelancerWallet),
      )
      .order("desc")
      .take(100);
  },
});
