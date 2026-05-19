import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

import { mutation, query } from "./_generated/server";
import { normalizeWalletAddress } from "./_shared/input";
import { findUserByWallet } from "./users/helpers";

const ACTIVE_ESCROW_STATUSES = new Set(["funded", "submitted"] as const);
const CLIENT_FUNDED_ESCROW_STATUSES = new Set(["funded", "submitted", "released"] as const);
const REVIEW_LIMIT = 10;
const CLIENT_RECENT_LIMIT = 10;

type TAssetAmountRow = {
  asset: string;
  amount: number;
};

type TFreelancerProfilePatch = {
  name?: string;
  bio?: string;
  skills?: string[];
  portfolioUrl?: string;
  websiteUrl?: string;
  location?: string;
  updatedAt: number;
};

type TClientProfilePatch = {
  name?: string;
  companyName?: string;
  bio?: string;
  websiteUrl?: string;
  location?: string;
  updatedAt: number;
};

function sanitizeLimitedOptionalString(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const sanitizedValue = value.trim();
  if (sanitizedValue.length === 0) {
    return undefined;
  }

  if (sanitizedValue.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less.`);
  }

  return sanitizedValue;
}

function sanitizeOptionalUrl(value: string | undefined, fieldName: string): string | undefined {
  const sanitizedValue = sanitizeLimitedOptionalString(value, fieldName, 240);
  if (sanitizedValue === undefined) {
    return undefined;
  }

  if (!sanitizedValue.startsWith("http://") && !sanitizedValue.startsWith("https://")) {
    throw new Error(`${fieldName} must start with http:// or https://.`);
  }

  return sanitizedValue;
}

function sanitizeSkills(skills: string[] | undefined): string[] | undefined {
  if (skills === undefined) {
    return undefined;
  }

  const sanitizedSkills = skills
    .map((skill) => skill.trim())
    .filter((skill, index, rows) => skill.length > 0 && rows.indexOf(skill) === index);

  if (sanitizedSkills.length > 10) {
    throw new Error("skills must include 10 items or fewer.");
  }

  for (const skill of sanitizedSkills) {
    if (skill.length > 40) {
      throw new Error("each skill must be 40 characters or less.");
    }
  }

  return sanitizedSkills;
}

function sumByAsset(escrows: Array<{ asset: string; amount: number }>): TAssetAmountRow[] {
  const byAsset = new Map<string, number>();

  for (const escrow of escrows) {
    byAsset.set(escrow.asset, (byAsset.get(escrow.asset) ?? 0) + escrow.amount);
  }

  return Array.from(byAsset.entries())
    .map(([asset, amount]) => ({ asset, amount }))
    .sort((left, right) => left.asset.localeCompare(right.asset));
}

function hasMilestoneId(escrow: Pick<Doc<"escrows">, "milestoneId">): boolean {
  return escrow.milestoneId !== undefined;
}

function getNullableRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

async function getEscrowByEscrowId(ctx: QueryCtx, escrowId: string) {
  return await ctx.db
    .query("escrows")
    .withIndex("by_escrowId", (q) => q.eq("escrowId", escrowId))
    .unique();
}

export const updateFreelancerProfile = mutation({
  args: {
    walletAddress: v.string(),
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    portfolioUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO: Replace walletAddress trust with signed wallet session/auth.
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const now = Date.now();
    const patch: TFreelancerProfilePatch = {
      updatedAt: now,
      ...(args.name !== undefined
        ? { name: sanitizeLimitedOptionalString(args.name, "name", 80) }
        : {}),
      ...(args.bio !== undefined
        ? { bio: sanitizeLimitedOptionalString(args.bio, "bio", 500) }
        : {}),
      ...(args.skills !== undefined ? { skills: sanitizeSkills(args.skills) } : {}),
      ...(args.portfolioUrl !== undefined
        ? { portfolioUrl: sanitizeOptionalUrl(args.portfolioUrl, "portfolioUrl") }
        : {}),
      ...(args.websiteUrl !== undefined
        ? { websiteUrl: sanitizeOptionalUrl(args.websiteUrl, "websiteUrl") }
        : {}),
      ...(args.location !== undefined
        ? { location: sanitizeLimitedOptionalString(args.location, "location", 80) }
        : {}),
    };

    const existingUser = await findUserByWallet(ctx, walletAddress);

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        ...patch,
        ...(existingUser.role === "freelancer" ? { role: "freelancer" as const } : {}),
      });
      return await ctx.db.get(existingUser._id);
    }

    const userId = await ctx.db.insert("users", {
      walletAddress,
      role: "freelancer",
      createdAt: now,
      ...patch,
    });

    return await ctx.db.get(userId);
  },
});

export const updateClientProfile = mutation({
  args: {
    walletAddress: v.string(),
    name: v.optional(v.string()),
    companyName: v.optional(v.string()),
    bio: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO: Replace walletAddress trust with signed wallet session/auth.
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const now = Date.now();
    const patch: TClientProfilePatch = {
      updatedAt: now,
      ...(args.name !== undefined
        ? { name: sanitizeLimitedOptionalString(args.name, "name", 80) }
        : {}),
      ...(args.companyName !== undefined
        ? { companyName: sanitizeLimitedOptionalString(args.companyName, "companyName", 100) }
        : {}),
      ...(args.bio !== undefined
        ? { bio: sanitizeLimitedOptionalString(args.bio, "bio", 500) }
        : {}),
      ...(args.websiteUrl !== undefined
        ? { websiteUrl: sanitizeOptionalUrl(args.websiteUrl, "websiteUrl") }
        : {}),
      ...(args.location !== undefined
        ? { location: sanitizeLimitedOptionalString(args.location, "location", 80) }
        : {}),
    };

    const existingUser = await findUserByWallet(ctx, walletAddress);

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        ...patch,
        ...(existingUser.role === "client" ? { role: "client" as const } : {}),
      });
      return await ctx.db.get(existingUser._id);
    }

    const userId = await ctx.db.insert("users", {
      walletAddress,
      role: "client",
      createdAt: now,
      ...patch,
    });

    return await ctx.db.get(userId);
  },
});

export const getFreelancerProfile = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [user, escrows, reputationRecords, applications, assignedMilestones, selectedJobs] =
      await Promise.all([
        findUserByWallet(ctx, walletAddress),
        ctx.db
          .query("escrows")
          .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", walletAddress))
          .take(500),
        ctx.db
          .query("reputationRecords")
          .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", walletAddress))
          .take(500),
        ctx.db
          .query("applications")
          .withIndex("by_freelancerWallet", (q) => q.eq("freelancerWallet", walletAddress))
          .take(1),
        ctx.db
          .query("milestones")
          .withIndex("by_assignedFreelancerWallet", (q) =>
            q.eq("assignedFreelancerWallet", walletAddress),
          )
          .take(1),
        ctx.db
          .query("jobs")
          .withIndex("by_selectedFreelancerWallet", (q) =>
            q.eq("selectedFreelancerWallet", walletAddress),
          )
          .take(1),
      ]);

    const hasAnyFreelancerData =
      user !== null ||
      escrows.length > 0 ||
      reputationRecords.length > 0 ||
      applications.length > 0 ||
      assignedMilestones.length > 0 ||
      selectedJobs.length > 0;

    if (!hasAnyFreelancerData) {
      return null;
    }

    const releasedEscrows = escrows.filter((escrow) => escrow.status === "released");
    const activeEscrows = escrows.filter((escrow) =>
      ACTIVE_ESCROW_STATUSES.has(escrow.status as "funded" | "submitted"),
    );
    const milestoneEscrows = releasedEscrows.filter(hasMilestoneId);
    const microGigEscrows = releasedEscrows.filter((escrow) => !hasMilestoneId(escrow));
    const activeMilestoneEscrows = activeEscrows.filter(hasMilestoneId);
    const disputedContracts = escrows.filter((escrow) => escrow.status === "disputed").length;
    const averageRating =
      reputationRecords.length === 0
        ? null
        : reputationRecords.reduce((sum, record) => sum + record.rating, 0) /
          reputationRecords.length;

    const reviews = await Promise.all(
      reputationRecords
        .slice()
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, REVIEW_LIMIT)
        .map(async (record) => {
          const [job, milestone, escrow] = await Promise.all([
            ctx.db.get(record.jobId),
            record.milestoneId ? ctx.db.get(record.milestoneId) : Promise.resolve(null),
            getEscrowByEscrowId(ctx, record.escrowId),
          ]);

          return {
            escrowId: record.escrowId,
            jobId: record.jobId,
            ...(record.milestoneId !== undefined ? { milestoneId: record.milestoneId } : {}),
            jobTitle: job?.title ?? "Untitled Job",
            ...(milestone?.title ? { milestoneTitle: milestone.title } : {}),
            workType: record.milestoneId ? ("milestone" as const) : ("micro_gig" as const),
            clientWallet: record.clientWallet,
            freelancerWallet: record.freelancerWallet,
            amount: record.amount,
            asset: escrow?.asset ?? "Unknown asset",
            rating: record.rating,
            ...(record.reviewText !== undefined ? { reviewText: record.reviewText } : {}),
            ...(record.reviewHash !== undefined ? { reviewHash: record.reviewHash } : {}),
            ...((record.txHash ?? escrow?.releaseTxHash)
              ? { txHash: record.txHash ?? escrow?.releaseTxHash }
              : {}),
            createdAt: record.createdAt,
          };
        }),
    );

    const recentContracts = await Promise.all(
      escrows
        .filter(
          (escrow) =>
            escrow.status === "released" ||
            ACTIVE_ESCROW_STATUSES.has(escrow.status as "funded" | "submitted"),
        )
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(async (escrow) => {
          const [job, milestone] = await Promise.all([
            ctx.db.get(escrow.jobId),
            escrow.milestoneId ? ctx.db.get(escrow.milestoneId) : Promise.resolve(null),
          ]);

          return {
            escrowId: escrow.escrowId,
            jobId: escrow.jobId,
            ...(escrow.milestoneId !== undefined ? { milestoneId: escrow.milestoneId } : {}),
            jobTitle: job?.title ?? "Untitled Job",
            ...(milestone?.title ? { milestoneTitle: milestone.title } : {}),
            workType: escrow.milestoneId ? ("milestone" as const) : ("micro_gig" as const),
            clientWallet: escrow.clientWallet,
            amount: escrow.amount,
            asset: escrow.asset,
            status: escrow.status,
            ...(escrow.releaseTxHash !== undefined ? { releaseTxHash: escrow.releaseTxHash } : {}),
            updatedAt: escrow.updatedAt,
          };
        }),
    );

    return {
      profile: {
        walletAddress,
        name: user?.name,
        bio: user?.bio,
        skills: user?.skills ?? [],
        avatarUrl: user?.avatarUrl,
        portfolioUrl: user?.portfolioUrl,
        websiteUrl: user?.websiteUrl,
        location: user?.location,
        walletType: user?.walletType,
        createdAt:
          user?.createdAt ?? Math.min(...escrows.map((escrow) => escrow.createdAt), Date.now()),
        updatedAt: user?.updatedAt,
      },
      stats: {
        completedContracts: releasedEscrows.length,
        completedMicroGigs: microGigEscrows.length,
        completedMilestones: milestoneEscrows.length,
        activeContracts: activeEscrows.length,
        activeMilestones: activeMilestoneEscrows.length,
        pendingEscrowByAsset: sumByAsset(activeEscrows),
        totalEarnedByAsset: sumByAsset(releasedEscrows),
        averageRating,
        totalReviews: reputationRecords.length,
        disputedContracts,
      },
      verifiedReviews: reviews,
      recentContracts,
    };
  },
});

export const getClientTrustProfile = query({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = normalizeWalletAddress(args.walletAddress);
    const [user, jobs, escrows] = await Promise.all([
      findUserByWallet(ctx, walletAddress),
      ctx.db
        .query("jobs")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", walletAddress))
        .take(500),
      ctx.db
        .query("escrows")
        .withIndex("by_clientWallet", (q) => q.eq("clientWallet", walletAddress))
        .take(500),
    ]);

    const hasClientData = user?.role === "client" || jobs.length > 0 || escrows.length > 0;

    if (!hasClientData) {
      return null;
    }

    const jobById = new Map(jobs.map((job) => [job._id, job]));
    const milestonesByJob = await Promise.all(
      jobs.map(async (job) => {
        const milestones = await ctx.db
          .query("milestones")
          .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
          .take(200);

        return { jobId: job._id, milestones };
      }),
    );
    const milestones = milestonesByJob.flatMap((row) => row.milestones);
    const milestoneById = new Map(milestones.map((milestone) => [milestone._id, milestone]));
    const selectedFreelancerWallets = new Set<string>();

    for (const job of jobs) {
      if (job.selectedFreelancerWallet) {
        selectedFreelancerWallets.add(job.selectedFreelancerWallet);
      }
    }

    for (const milestone of milestones) {
      if (milestone.assignedFreelancerWallet) {
        selectedFreelancerWallets.add(milestone.assignedFreelancerWallet);
      }
    }

    const fundedEscrows = escrows.filter((escrow) =>
      CLIENT_FUNDED_ESCROW_STATUSES.has(escrow.status as "funded" | "submitted" | "released"),
    );
    const completedEscrows = escrows.filter((escrow) => escrow.status === "released");
    const activeEscrows = escrows.filter((escrow) =>
      ACTIVE_ESCROW_STATUSES.has(escrow.status as "funded" | "submitted"),
    );
    const disputedEscrows = escrows.filter((escrow) => escrow.status === "disputed");
    const cancelledEscrows = escrows.filter((escrow) => escrow.status === "cancelled");
    const microGigs = jobs.filter((job) => (job.jobType ?? "micro_gig") === "micro_gig");
    const milestoneProjects = jobs.filter((job) => job.jobType === "milestone_project");
    const jobReports = await Promise.all(
      jobs.map(async (job) => {
        const reports = await ctx.db
          .query("jobReports")
          .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
          .take(100);

        return { jobId: job._id, reports };
      }),
    );
    const reportedJobs = jobReports.filter((row) => row.reports.length > 0);
    const totalReports = jobReports.reduce((total, row) => total + row.reports.length, 0);

    const mapEscrowRow = async (escrow: Doc<"escrows">) => {
      const job = jobById.get(escrow.jobId) ?? (await ctx.db.get(escrow.jobId));
      const milestone = escrow.milestoneId
        ? (milestoneById.get(escrow.milestoneId) ?? (await ctx.db.get(escrow.milestoneId)))
        : null;

      return {
        escrowId: escrow.escrowId,
        jobId: escrow.jobId,
        ...(escrow.milestoneId !== undefined ? { milestoneId: escrow.milestoneId } : {}),
        jobTitle: job?.title ?? "Untitled Job",
        ...(milestone?.title ? { milestoneTitle: milestone.title } : {}),
        freelancerWallet: escrow.freelancerWallet,
        amount: escrow.amount,
        asset: escrow.asset,
        status: escrow.status,
        ...(escrow.fundTxHash !== undefined ? { fundTxHash: escrow.fundTxHash } : {}),
        ...(escrow.releaseTxHash !== undefined ? { releaseTxHash: escrow.releaseTxHash } : {}),
        updatedAt: escrow.updatedAt,
      };
    };

    const recentFundedEscrows = await Promise.all(
      fundedEscrows
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, CLIENT_RECENT_LIMIT)
        .map(mapEscrowRow),
    );
    const recentCompletedPayments = await Promise.all(
      completedEscrows
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, CLIENT_RECENT_LIMIT)
        .map(mapEscrowRow),
    );

    return {
      profile: {
        walletAddress,
        name: user?.name,
        companyName: user?.companyName,
        bio: user?.bio,
        websiteUrl: user?.websiteUrl,
        location: user?.location,
        walletType: user?.walletType,
        createdAt:
          user?.createdAt ??
          Math.min(...[...jobs.map((job) => job.createdAt), ...escrows.map((e) => e.createdAt)]),
        updatedAt: user?.updatedAt,
      },
      stats: {
        jobsPosted: jobs.length,
        microGigsPosted: microGigs.length,
        milestoneProjectsPosted: milestoneProjects.length,
        totalMilestonesCreated: milestones.length,
        selectedFreelancers: selectedFreelancerWallets.size,
        escrowsCreated: escrows.length,
        fundedEscrows: fundedEscrows.length,
        completedEscrows: completedEscrows.length,
        completedMicroGigs: completedEscrows.filter((escrow) => !hasMilestoneId(escrow)).length,
        completedMilestones: completedEscrows.filter(hasMilestoneId).length,
        activeEscrows: activeEscrows.length,
        disputedEscrows: disputedEscrows.length,
        cancelledEscrows: cancelledEscrows.length,
        totalEscrowFundedByAsset: sumByAsset(fundedEscrows),
        totalPaidByAsset: sumByAsset(completedEscrows),
        fundingReliabilityRate: getNullableRate(fundedEscrows.length, escrows.length),
        completionRate: getNullableRate(completedEscrows.length, fundedEscrows.length),
        disputeRate: getNullableRate(disputedEscrows.length, escrows.length),
        cancellationRate: getNullableRate(cancelledEscrows.length, escrows.length),
      },
      recentJobs: jobs
        .slice()
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, CLIENT_RECENT_LIMIT)
        .map((job) => ({
          jobId: job._id,
          jobType: job.jobType ?? "micro_gig",
          title: job.title,
          status: job.status,
          totalBudget: job.totalBudget ?? job.budget,
          asset: job.asset,
          createdAt: job.createdAt,
        })),
      recentFundedEscrows,
      recentCompletedPayments,
      ...(totalReports > 0
        ? {
            reportedJobsSummary: {
              totalReports,
              reportedJobsCount: reportedJobs.length,
            },
          }
        : {}),
    };
  },
});
