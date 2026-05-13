import type { TConvexId } from "@repo/convex-client";

export type TProofType = "micro_gig" | "milestone";

export type TProofStatus =
  | "escrow_created"
  | "verified_funded"
  | "work_submitted"
  | "paid"
  | "cancelled"
  | "disputed";

export type TProofEscrow = {
  readonly escrowId: string;
  readonly jobId: TConvexId<"jobs">;
  readonly milestoneId?: TConvexId<"milestones">;
  readonly clientWallet: string;
  readonly freelancerWallet?: string;
  readonly amount: number;
  readonly asset: string;
  readonly status: "created" | "funded" | "submitted" | "released" | "cancelled" | "disputed";
  readonly createTxHash?: string;
  readonly fundTxHash?: string;
  readonly submitTxHash?: string;
  readonly releaseTxHash?: string;
  readonly cancelTxHash?: string;
  readonly disputeTxHash?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type TProofJob = {
  readonly _id: TConvexId<"jobs">;
  readonly title: string;
  readonly description?: string;
  readonly jobType: "micro_gig" | "milestone_project";
  readonly status: string;
  readonly clientWallet: string;
  readonly createdAt: number;
};

export type TProofMilestone = {
  readonly _id: TConvexId<"milestones">;
  readonly order: number;
  readonly title: string;
  readonly description?: string;
  readonly amount: number;
  readonly asset: string;
  readonly status: string;
  readonly assignedFreelancerWallet?: string;
};

export type TProofReputationRecord = {
  readonly escrowId: string;
  readonly jobId: TConvexId<"jobs">;
  readonly milestoneId?: TConvexId<"milestones">;
  readonly clientWallet: string;
  readonly freelancerWallet: string;
  readonly amount: number;
  readonly asset: string;
  readonly rating: number;
  readonly reviewText?: string;
  readonly reviewHash?: string;
  readonly txHash?: string;
  readonly createdAt: number;
};

export type TProofProfile = {
  readonly walletAddress: string;
  readonly name?: string;
  readonly companyName?: string;
  readonly skills?: readonly string[];
};

export type TProofTransaction = {
  readonly label: string;
  readonly txHash: string;
  readonly type: string;
  readonly createdAt?: number;
};

export type TEscrowProof = {
  readonly escrow: TProofEscrow;
  readonly job: TProofJob;
  readonly milestone?: TProofMilestone;
  readonly reputationRecord?: TProofReputationRecord;
  readonly clientProfile?: TProofProfile;
  readonly freelancerProfile?: TProofProfile;
  readonly proofType: TProofType;
  readonly proofStatus: TProofStatus;
  readonly transactions: readonly TProofTransaction[];
};
