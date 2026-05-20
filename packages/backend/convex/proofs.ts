import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";

import { query } from "./_generated/server";
import { requireNonEmptyString } from "./_shared/input";
import { findUserByWallet } from "./users/helpers";

type TProofStatus =
  | "escrow_created"
  | "verified_funded"
  | "work_submitted"
  | "paid"
  | "cancelled"
  | "disputed";

type TTransactionProof = {
  label: string;
  txHash: string;
  type: string;
  createdAt?: number;
};

const PROOF_STATUS_BY_ESCROW_STATUS: Record<Doc<"escrows">["status"], TProofStatus> = {
  created: "escrow_created",
  funded: "verified_funded",
  submitted: "work_submitted",
  released: "paid",
  cancelled: "cancelled",
  disputed: "disputed",
};

function buildTransactionProofs(escrow: Doc<"escrows">): TTransactionProof[] {
  const entries: Array<{
    label: string;
    txHash?: string;
    type: string;
    createdAt?: number;
  }> = [
    {
      label: "Escrow Created",
      txHash: escrow.createTxHash,
      type: "create_escrow",
      createdAt: escrow.createdAt,
    },
    {
      label: "Escrow Funded",
      txHash: escrow.fundTxHash,
      type: "fund_escrow",
      createdAt: escrow.updatedAt,
    },
    {
      label: "Work Submitted",
      txHash: escrow.submitTxHash,
      type: "submit_work",
      createdAt: escrow.updatedAt,
    },
    {
      label: "Payment Released",
      txHash: escrow.releaseTxHash,
      type: "release_payment",
      createdAt: escrow.updatedAt,
    },
    {
      label: "Escrow Cancelled",
      txHash: escrow.cancelTxHash,
      type: "cancel_escrow",
      createdAt: escrow.updatedAt,
    },
    {
      label: "Escrow Disputed",
      txHash: escrow.disputeTxHash,
      type: "mark_disputed",
      createdAt: escrow.updatedAt,
    },
  ];

  return entries.flatMap((entry) =>
    entry.txHash
      ? [
          {
            label: entry.label,
            txHash: entry.txHash,
            type: entry.type,
            ...(entry.createdAt !== undefined ? { createdAt: entry.createdAt } : {}),
          },
        ]
      : [],
  );
}

export const getEscrowProof = query({
  args: {
    escrowId: v.string(),
  },
  handler: async (ctx, args) => {
    const escrowId = requireNonEmptyString(args.escrowId, "escrowId");

    const escrow = await ctx.db
      .query("escrows")
      .withIndex("by_escrowId", (q) => q.eq("escrowId", escrowId))
      .unique();

    if (!escrow) {
      return null;
    }

    const [job, milestone, reputationRecord, clientProfile, freelancerProfile] = await Promise.all([
      ctx.db.get(escrow.jobId),
      escrow.milestoneId ? ctx.db.get(escrow.milestoneId) : Promise.resolve(null),
      ctx.db
        .query("reputationRecords")
        .withIndex("by_escrowId", (q) => q.eq("escrowId", escrow.escrowId))
        .unique(),
      findUserByWallet(ctx, escrow.clientWallet),
      escrow.freelancerWallet
        ? findUserByWallet(ctx, escrow.freelancerWallet)
        : Promise.resolve(null),
    ]);

    if (!job) {
      return null;
    }

    return {
      escrow: {
        escrowId: escrow.escrowId,
        jobId: escrow.jobId,
        ...(escrow.milestoneId !== undefined ? { milestoneId: escrow.milestoneId } : {}),
        clientWallet: escrow.clientWallet,
        ...(escrow.freelancerWallet !== undefined
          ? { freelancerWallet: escrow.freelancerWallet }
          : {}),
        amount: escrow.amount,
        asset: escrow.asset,
        status: escrow.status,
        ...(escrow.createTxHash !== undefined ? { createTxHash: escrow.createTxHash } : {}),
        ...(escrow.fundTxHash !== undefined ? { fundTxHash: escrow.fundTxHash } : {}),
        ...(escrow.submitTxHash !== undefined ? { submitTxHash: escrow.submitTxHash } : {}),
        ...(escrow.releaseTxHash !== undefined ? { releaseTxHash: escrow.releaseTxHash } : {}),
        ...(escrow.cancelTxHash !== undefined ? { cancelTxHash: escrow.cancelTxHash } : {}),
        ...(escrow.disputeTxHash !== undefined ? { disputeTxHash: escrow.disputeTxHash } : {}),
        createdAt: escrow.createdAt,
        updatedAt: escrow.updatedAt,
      },
      job: {
        _id: job._id,
        title: job.title,
        description: job.description,
        jobType: job.jobType ?? "micro_gig",
        status: job.status,
        clientWallet: job.clientWallet,
        ...(job.deadlineAt !== undefined ? { deadlineAt: job.deadlineAt } : {}),
        ...(job.submittedAt !== undefined ? { submittedAt: job.submittedAt } : {}),
        ...(job.completedAt !== undefined ? { completedAt: job.completedAt } : {}),
        ...(job.approvedAt !== undefined ? { approvedAt: job.approvedAt } : {}),
        createdAt: job.createdAt,
      },
      ...(milestone
        ? {
            milestone: {
              _id: milestone._id,
              order: milestone.order,
              title: milestone.title,
              ...(milestone.description !== undefined
                ? { description: milestone.description }
                : {}),
              amount: milestone.amount,
              asset: milestone.asset,
              status: milestone.status,
              ...(milestone.deadlineAt !== undefined ? { deadlineAt: milestone.deadlineAt } : {}),
              ...(milestone.submittedAt !== undefined ? { submittedAt: milestone.submittedAt } : {}),
              ...(milestone.completedAt !== undefined
                ? { completedAt: milestone.completedAt }
                : {}),
              ...(milestone.approvedAt !== undefined ? { approvedAt: milestone.approvedAt } : {}),
              ...(milestone.assignedFreelancerWallet !== undefined
                ? { assignedFreelancerWallet: milestone.assignedFreelancerWallet }
                : {}),
            },
          }
        : {}),
      ...(reputationRecord
        ? {
            reputationRecord: {
              escrowId: reputationRecord.escrowId,
              jobId: reputationRecord.jobId,
              ...(reputationRecord.milestoneId !== undefined
                ? { milestoneId: reputationRecord.milestoneId }
                : {}),
              clientWallet: reputationRecord.clientWallet,
              freelancerWallet: reputationRecord.freelancerWallet,
              amount: reputationRecord.amount,
              asset: escrow.asset,
              rating: reputationRecord.rating,
              ...(reputationRecord.reviewText !== undefined
                ? { reviewText: reputationRecord.reviewText }
                : {}),
              ...(reputationRecord.reviewHash !== undefined
                ? { reviewHash: reputationRecord.reviewHash }
                : {}),
              ...(reputationRecord.txHash !== undefined ? { txHash: reputationRecord.txHash } : {}),
              createdAt: reputationRecord.createdAt,
            },
          }
        : {}),
      ...(clientProfile
        ? {
            clientProfile: {
              walletAddress: clientProfile.walletAddress,
              ...(clientProfile.name !== undefined ? { name: clientProfile.name } : {}),
              ...(clientProfile.companyName !== undefined
                ? { companyName: clientProfile.companyName }
                : {}),
              ...(clientProfile.walletType !== undefined
                ? { walletType: clientProfile.walletType }
                : {}),
            },
          }
        : {}),
      ...(freelancerProfile
        ? {
            freelancerProfile: {
              walletAddress: freelancerProfile.walletAddress,
              ...(freelancerProfile.name !== undefined ? { name: freelancerProfile.name } : {}),
              ...(freelancerProfile.skills !== undefined
                ? { skills: freelancerProfile.skills }
                : {}),
              ...(freelancerProfile.walletType !== undefined
                ? { walletType: freelancerProfile.walletType }
                : {}),
            },
          }
        : {}),
      proofType: escrow.milestoneId ? "milestone" : "micro_gig",
      proofStatus: PROOF_STATUS_BY_ESCROW_STATUS[escrow.status],
      transactions: buildTransactionProofs(escrow),
    };
  },
});
