import type { Id, Doc } from "../../convex/_generated/dataModel";
import type { TestConvex } from "convex-test";

import schema from "../../convex/schema";

export const TEST_ADMIN_SECRET = "c02-test-admin-secret";

export const TEST_WALLETS = {
  admin: "GADMINC02",
  client: "GCLIENTC02",
  freelancer: "GFREELANCERC02",
  unrelated: "GUNRELATEDC02",
} as const;

export type DisputeParentKind = "micro_gig" | "milestone";
export type EscrowFixtureStatus = "funded" | "submitted";

export type BackendTest = TestConvex<typeof schema>;

export type DisputeFixture = {
  adminWallet: string;
  clientWallet: string;
  escrowId: Id<"escrows">;
  escrowStatus: EscrowFixtureStatus;
  freelancerWallet: string;
  jobId: Id<"jobs">;
  milestoneId?: Id<"milestones">;
  parentId: string;
  parentType: DisputeParentKind;
  unrelatedWallet: string;
};

export type DisputeFields = Omit<Doc<"disputes">, "_id" | "_creationTime">;
export type DisputeEventFields = Omit<Doc<"disputeEvents">, "_id" | "_creationTime">;

type FixtureOptions = {
  escrowStatus?: EscrowFixtureStatus;
  label?: string;
  parentType?: DisputeParentKind;
};

export async function seedDisputeFixture(
  t: BackendTest,
  options: FixtureOptions = {},
): Promise<DisputeFixture> {
  const parentType = options.parentType ?? "micro_gig";
  const escrowStatus = options.escrowStatus ?? "funded";
  const label = options.label ?? `${parentType}-${escrowStatus}`;
  const createdAt = 1_768_480_800_000;

  return await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      walletAddress: TEST_WALLETS.client,
      role: "client",
      walletType: "external_wallet",
      createdAt,
      updatedAt: createdAt,
    });
    await ctx.db.insert("users", {
      walletAddress: TEST_WALLETS.freelancer,
      role: "freelancer",
      walletType: "external_wallet",
      createdAt,
      updatedAt: createdAt,
    });
    await ctx.db.insert("users", {
      walletAddress: TEST_WALLETS.admin,
      role: "admin",
      walletType: "external_wallet",
      createdAt,
      updatedAt: createdAt,
    });
    await ctx.db.insert("users", {
      walletAddress: TEST_WALLETS.unrelated,
      role: "freelancer",
      walletType: "external_wallet",
      createdAt,
      updatedAt: createdAt,
    });

    const jobId = await ctx.db.insert("jobs", {
      title: `C02 ${label} job`,
      description: "Deterministic dispute contract fixture.",
      budget: 500,
      asset: "USDC",
      jobType: parentType === "micro_gig" ? "micro_gig" : "milestone_project",
      totalBudget: 500,
      milestoneCount: parentType === "milestone" ? 1 : undefined,
      clientWallet: TEST_WALLETS.client,
      selectedFreelancerWallet: TEST_WALLETS.freelancer,
      status: escrowStatus === "submitted" ? "submitted" : "funded",
      jobHash: `job-hash-${label}`,
      createdAt,
      updatedAt: createdAt,
      ...(escrowStatus === "submitted" ? { submittedAt: createdAt + 100 } : {}),
    });

    const milestoneId =
      parentType === "milestone"
        ? await ctx.db.insert("milestones", {
            jobId,
            order: 1,
            title: `C02 ${label} milestone`,
            description: "Deterministic milestone dispute fixture.",
            requiredOutput: "A submitted deliverable",
            amount: 500,
            asset: "USDC",
            status: escrowStatus === "submitted" ? "submitted" : "funded",
            assignedFreelancerWallet: TEST_WALLETS.freelancer,
            escrowId: `escrow-${label}`,
            createdAt,
            updatedAt: createdAt,
            ...(escrowStatus === "submitted" ? { submittedAt: createdAt + 100 } : {}),
          })
        : undefined;

    const escrowId = await ctx.db.insert("escrows", {
      jobId,
      ...(milestoneId !== undefined ? { milestoneId } : {}),
      escrowId: `escrow-${label}`,
      clientWallet: TEST_WALLETS.client,
      freelancerWallet: TEST_WALLETS.freelancer,
      amount: 500,
      asset: "USDC",
      status: escrowStatus,
      createTxHash: `create-tx-${label}`,
      fundTxHash: `fund-tx-${label}`,
      assignTxHash: `assign-tx-${label}`,
      ...(escrowStatus === "submitted" ? { submitTxHash: `submit-tx-${label}` } : {}),
      createdAt,
      updatedAt: createdAt,
    });

    return {
      adminWallet: TEST_WALLETS.admin,
      clientWallet: TEST_WALLETS.client,
      escrowId,
      escrowStatus,
      freelancerWallet: TEST_WALLETS.freelancer,
      jobId,
      ...(milestoneId !== undefined ? { milestoneId } : {}),
      parentId: milestoneId ?? jobId,
      parentType,
      unrelatedWallet: TEST_WALLETS.unrelated,
    };
  });
}

export function makeDisputeFields(
  fixture: DisputeFixture,
  overrides: Partial<DisputeFields> = {},
): DisputeFields {
  return {
    disputeNumber: `DSP-C02-${fixture.parentType}-${fixture.escrowStatus}`,
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    jobId: fixture.jobId,
    ...(fixture.parentType === "micro_gig"
      ? { microGigId: fixture.jobId }
      : { milestoneId: fixture.milestoneId }),
    escrowId: fixture.escrowId,
    onChainEscrowId: `on-chain-${fixture.parentType}-${fixture.escrowStatus}`,
    clientWallet: fixture.clientWallet,
    freelancerWallet: fixture.freelancerWallet,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    openedByRole: "client",
    reasonCategory: "work_not_delivered",
    title: "C02 schema fixture",
    description: "Schema contract fixture.",
    evidenceAttachmentIds: [],
    relatedWorkSubmissionIds: [],
    relatedRevisionRequestIds: [],
    status: "open",
    onChainStatus: "not_marked",
    openedAt: 1_768_480_800_000,
    createdAt: 1_768_480_800_000,
    updatedAt: 1_768_480_800_000,
    ...overrides,
  };
}

export function makeDisputeEventFields(
  disputeId: Id<"disputes">,
  overrides: Partial<DisputeEventFields> = {},
): DisputeEventFields {
  return {
    disputeId,
    type: "dispute_opened",
    actorWallet: TEST_WALLETS.client,
    actorWalletType: "external_wallet",
    actorRole: "client",
    message: "C02 event fixture",
    attachmentIds: [],
    createdAt: 1_768_480_800_000,
    ...overrides,
  };
}

export async function countRecords(
  t: BackendTest,
  table: "disputes" | "disputeEvents",
): Promise<number> {
  return await t.run(async (ctx) => (await ctx.db.query(table).collect()).length);
}
