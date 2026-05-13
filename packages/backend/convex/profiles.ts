import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

import { mutation, query } from "./_generated/server";
import { normalizeWalletAddress } from "./_shared/input";
import { findUserByWallet } from "./users/helpers";

const ACTIVE_ESCROW_STATUSES = new Set(["funded", "submitted"] as const);
const REVIEW_LIMIT = 10;
const CONTRACT_LIMIT = 10;

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
        .slice(0, CONTRACT_LIMIT)
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
