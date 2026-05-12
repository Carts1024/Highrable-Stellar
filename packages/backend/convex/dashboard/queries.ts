import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

import { query } from "../_generated/server";
import { normalizeWalletAddress } from "../_shared/input";

const RELEASED_STATUS = "released" as const;
const ONGOING_ESCROW_STATUSES = new Set(["funded", "submitted"] as const);
const PENDING_STATUSES = new Set(["funded", "submitted"] as const);
const AWAITING_FUNDING_STATUS = "created" as const;
const RECENT_PAYOUTS_LIMIT = 5;

type TAssetAmountRow = { asset: string; amount: number };

type TRecentPayoutRow = {
  escrowId: string;
  jobId: Id<"jobs">;
  jobTitle: string | undefined;
  clientWallet: string;
  freelancerWallet: string;
  amount: number;
  asset: string;
  releaseTxHash: string | undefined;
  releasedAt: number | undefined;
  rating: number | undefined;
  reviewText: string | undefined;
};

type TFreelancerIncomeSummaryResult = {
  totalEarnedByAsset: TAssetAmountRow[];
  pendingEscrowByAsset: TAssetAmountRow[];
  completedJobs: number;
  activeJobs: number;
  awaitingFunding: number;
  recentPayouts: TRecentPayoutRow[];
};

type TDerivedApplicationStatus =
  | "pending"
  | "selected"
  | "funded"
  | "submitted"
  | "completed"
  | "cancelled"
  | "disputed"
  | "not_selected";

type TFreelancerAppliedJobRow = {
  applicationId: Id<"applications">;
  jobId: Id<"jobs">;
  applicationCreatedAt: number;
  proposalPreview: string;
  title: string;
  budget: number;
  asset: string;
  jobStatus: string;
  derivedApplicationStatus: TDerivedApplicationStatus;
  selectedFreelancerWallet: string | undefined;
  escrowStatus: string | undefined;
  escrowUpdatedAt: number | undefined;
};

type TFreelancerOngoingJobRow = {
  escrowId: string;
  jobId: Id<"jobs">;
  title: string;
  budget: number;
  asset: string;
  clientWallet: string;
  escrowStatus: "funded" | "submitted";
  updatedAt: number;
};

type TClientPostedJobRow = {
  jobId: Id<"jobs">;
  title: string;
  budget: number;
  asset: string;
  createdAt: number;
  jobStatus: string;
  selectedFreelancerWallet: string | undefined;
  applicationCount: number;
  escrowStatus: string | undefined;
};

function sumByAsset(escrows: Array<{ asset: string; amount: number }>): TAssetAmountRow[] {
  const byAsset = new Map<string, number>();

  for (const escrow of escrows) {
    byAsset.set(escrow.asset, (byAsset.get(escrow.asset) ?? 0) + escrow.amount);
  }

  return Array.from(byAsset.entries()).map(([asset, amount]) => ({ asset, amount }));
}

async function buildRecentPayoutRow(
  ctx: QueryCtx,
  escrow: {
    escrowId: string;
    jobId: Id<"jobs">;
    clientWallet: string;
    freelancerWallet: string;
    amount: number;
    asset: string;
    releaseTxHash?: string;
    updatedAt: number;
  },
): Promise<TRecentPayoutRow> {
  const [job, reputationRecord] = await Promise.all([
    ctx.db.get(escrow.jobId),
    ctx.db
      .query("reputationRecords")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow.escrowId))
      .unique(),
  ]);

  return {
    escrowId: escrow.escrowId,
    jobId: escrow.jobId,
    jobTitle: job?.title,
    clientWallet: escrow.clientWallet,
    freelancerWallet: escrow.freelancerWallet,
    amount: escrow.amount,
    asset: escrow.asset,
    releaseTxHash: escrow.releaseTxHash,
    releasedAt: escrow.updatedAt,
    rating: reputationRecord?.rating,
    reviewText: reputationRecord?.reviewText,
  };
}

function deriveApplicationStatus(args: {
  freelancerWallet: string;
  selectedFreelancerWallet: string | undefined;
  jobStatus: string;
}): TDerivedApplicationStatus {
  const normalizedSelected = args.selectedFreelancerWallet?.toUpperCase();
  const isSelectedFreelancer = normalizedSelected === args.freelancerWallet;

  if (normalizedSelected && !isSelectedFreelancer) {
    return "not_selected";
  }

  if (args.jobStatus === "open") {
    return "pending";
  }

  if (args.jobStatus === "selected") {
    return "selected";
  }

  if (args.jobStatus === "funded") {
    return "funded";
  }

  if (args.jobStatus === "submitted") {
    return "submitted";
  }

  if (args.jobStatus === "completed") {
    return "completed";
  }

  if (args.jobStatus === "cancelled") {
    return "cancelled";
  }

  if (args.jobStatus === "disputed") {
    return "disputed";
  }

  return "pending";
}

function toProposalPreview(proposal: string): string {
  const sanitized = proposal.trim().replace(/\s+/g, " ");
  return sanitized.slice(0, 160);
}

async function countApplicationsByJobId(ctx: QueryCtx, jobId: Id<"jobs">): Promise<number> {
  const applications = await ctx.db
    .query("applications")
    .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
    .take(500);

  return applications.length;
}

export const getFreelancerIncomeSummary = query({
  args: {
    freelancerWallet: v.string(),
  },
  handler: async (ctx, args): Promise<TFreelancerIncomeSummaryResult> => {
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);

    const allEscrows = await ctx.db
      .query("escrows")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .take(200);

    const releasedEscrows = allEscrows.filter(
      (e): e is typeof e & { freelancerWallet: string } =>
        e.status === RELEASED_STATUS && e.freelancerWallet !== undefined,
    );
    const pendingEscrows = allEscrows.filter((e) =>
      PENDING_STATUSES.has(e.status as "funded" | "submitted"),
    );
    const awaitingFundingCount = allEscrows.filter(
      (e) => e.status === AWAITING_FUNDING_STATUS,
    ).length;

    const sortedRecent = [...releasedEscrows]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, RECENT_PAYOUTS_LIMIT);

    // NOTE: N+1 reads here are acceptable for MVP (at most 5 × 2 extra reads).
    // TODO: Batch with a single query per table post-MVP if dataset grows.
    const recentPayouts = await Promise.all(sortedRecent.map((e) => buildRecentPayoutRow(ctx, e)));

    return {
      totalEarnedByAsset: sumByAsset(releasedEscrows),
      pendingEscrowByAsset: sumByAsset(pendingEscrows),
      completedJobs: releasedEscrows.length,
      activeJobs: pendingEscrows.length,
      awaitingFunding: awaitingFundingCount,
      recentPayouts,
    };
  },
});

export const listFreelancerAppliedJobsPage = query({
  args: {
    freelancerWallet: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);

    const page = await ctx.db
      .query("applications")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .order("desc")
      .paginate(args.paginationOpts);

    const rows = await Promise.all(
      page.page.map(async (application): Promise<TFreelancerAppliedJobRow | null> => {
        const [job, escrow] = await Promise.all([
          ctx.db.get(application.jobId),
          ctx.db
            .query("escrows")
            .withIndex("by_jobId", (q) => q.eq("jobId", application.jobId))
            .unique(),
        ]);

        if (!job) {
          return null;
        }

        return {
          applicationId: application._id,
          jobId: application.jobId,
          applicationCreatedAt: application.createdAt,
          proposalPreview: toProposalPreview(application.proposal),
          title: job.title,
          budget: job.budget,
          asset: job.asset,
          jobStatus: job.status,
          derivedApplicationStatus: deriveApplicationStatus({
            freelancerWallet,
            selectedFreelancerWallet: job.selectedFreelancerWallet,
            jobStatus: job.status,
          }),
          selectedFreelancerWallet: job.selectedFreelancerWallet,
          escrowStatus: escrow?.status,
          escrowUpdatedAt: escrow?.updatedAt,
        };
      }),
    );

    return {
      ...page,
      page: rows.filter((row): row is TFreelancerAppliedJobRow => row !== null),
    };
  },
});

export const listFreelancerOngoingJobsPage = query({
  args: {
    freelancerWallet: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const freelancerWallet = normalizeWalletAddress(args.freelancerWallet);

    const page = await ctx.db
      .query("escrows")
      .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", freelancerWallet))
      .order("desc")
      .paginate(args.paginationOpts);

    const rows = await Promise.all(
      page.page.map(async (escrow): Promise<TFreelancerOngoingJobRow | null> => {
        if (!ONGOING_ESCROW_STATUSES.has(escrow.status as "funded" | "submitted")) {
          return null;
        }

        const job = await ctx.db.get(escrow.jobId);

        if (!job) {
          return null;
        }

        return {
          escrowId: escrow.escrowId,
          jobId: escrow.jobId,
          title: job.title,
          budget: job.budget,
          asset: job.asset,
          clientWallet: escrow.clientWallet,
          escrowStatus: escrow.status as "funded" | "submitted",
          updatedAt: escrow.updatedAt,
        };
      }),
    );

    return {
      ...page,
      page: rows.filter((row): row is TFreelancerOngoingJobRow => row !== null),
    };
  },
});

export const listClientPostedJobsPage = query({
  args: {
    clientWallet: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const clientWallet = normalizeWalletAddress(args.clientWallet);

    const page = await ctx.db
      .query("jobs")
      .withIndex("by_clientWallet", (q) => q.eq("clientWallet", clientWallet))
      .order("desc")
      .paginate(args.paginationOpts);

    const rows = await Promise.all(
      page.page.map(async (job): Promise<TClientPostedJobRow> => {
        const [escrow, applicationCount] = await Promise.all([
          ctx.db
            .query("escrows")
            .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
            .unique(),
          countApplicationsByJobId(ctx, job._id),
        ]);

        return {
          jobId: job._id,
          title: job.title,
          budget: job.budget,
          asset: job.asset,
          createdAt: job.createdAt,
          jobStatus: job.status,
          selectedFreelancerWallet: job.selectedFreelancerWallet,
          applicationCount,
          escrowStatus: escrow?.status,
        };
      }),
    );

    return {
      ...page,
      page: rows,
    };
  },
});
