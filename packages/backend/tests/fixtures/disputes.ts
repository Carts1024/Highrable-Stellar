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

export type DisputeReferenceFixture = {
  attachmentId: Id<"attachments">;
  conversationId: Id<"conversations">;
  deadlineEventId: Id<"deadlineAuditEvents">;
  messageId: Id<"messages">;
  revisionRequestId: Id<"revisionRequests">;
  submissionId: Id<"workSubmissions">;
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

export async function seedDisputeReferences(
  t: BackendTest,
  fixture: DisputeFixture,
): Promise<DisputeReferenceFixture> {
  const createdAt = 1_768_480_800_500;

  return await t.run(async (ctx) => {
    const escrow = await ctx.db.get(fixture.escrowId);
    if (!escrow) {
      throw new Error("Dispute fixture escrow is missing.");
    }

    const attachmentId = await ctx.db.insert("attachments", {
      type: "file",
      name: "dispute-evidence.txt",
      size: 10,
      mimeType: "text/plain",
      uploadedByWallet: fixture.clientWallet,
      uploadedByWalletType: "external_wallet",
      ownerRole: "client",
      parentType: "unknown",
      visibility: "private",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    });

    const submissionId = await ctx.db.insert("workSubmissions", {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      jobId: fixture.jobId,
      ...(fixture.milestoneId !== undefined ? { milestoneId: fixture.milestoneId } : {}),
      escrowId: fixture.escrowId,
      onChainEscrowId: escrow.escrowId,
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
      freelancerWalletType: "external_wallet",
      submittedByWallet: fixture.freelancerWallet,
      submittedByWalletType: "external_wallet",
      notes: "Submitted dispute fixture proof.",
      attachmentIds: [],
      proofHash: "a".repeat(64),
      hashAlgorithm: "sha256",
      hashEncoding: "hex",
      proofVersion: "v1",
      status: "submitted",
      onChainStatus: "not_submitted",
      submittedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });

    const revisionRequestId = await ctx.db.insert("revisionRequests", {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      jobId: fixture.jobId,
      ...(fixture.milestoneId !== undefined ? { milestoneId: fixture.milestoneId } : {}),
      escrowId: fixture.escrowId,
      workSubmissionId: submissionId,
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
      requestedByWallet: fixture.clientWallet,
      requestedByWalletType: "external_wallet",
      revisionNumber: 1,
      reason: "Fixture revision reason.",
      requestedChanges: "Fixture revision changes.",
      attachmentIds: [],
      status: "requested",
      requestedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });

    const conversationParentType = fixture.parentType === "milestone" ? "milestone" : "escrow";
    const conversationParentId =
      fixture.parentType === "milestone" ? fixture.milestoneId! : fixture.escrowId;
    const conversationId = await ctx.db.insert("conversations", {
      parentType: conversationParentType,
      parentId: conversationParentId,
      jobId: fixture.jobId,
      ...(fixture.milestoneId !== undefined ? { milestoneId: fixture.milestoneId } : {}),
      escrowId: fixture.escrowId,
      participantWallets: [fixture.clientWallet, fixture.freelancerWallet],
      participantWalletTypes: [
        { walletAddress: fixture.clientWallet, walletType: "external_wallet" },
        { walletAddress: fixture.freelancerWallet, walletType: "external_wallet" },
      ],
      clientWallet: fixture.clientWallet,
      freelancerWallet: fixture.freelancerWallet,
      title: "Dispute reference fixture conversation",
      status: "active",
      createdByWallet: fixture.clientWallet,
      createdByWalletType: "external_wallet",
      createdAt,
      updatedAt: createdAt,
    });

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      parentType: conversationParentType,
      parentId: conversationParentId,
      senderWallet: fixture.clientWallet,
      senderWalletType: "external_wallet",
      senderRole: "client",
      kind: "user",
      body: "Fixture message for dispute evidence.",
      attachmentIds: [],
      status: "sent",
      createdAt,
      updatedAt: createdAt,
    });

    const deadlineEventId = await ctx.db.insert("deadlineAuditEvents", {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      newDeadlineAt: createdAt + 86_400_000,
      changedByWallet: fixture.clientWallet,
      changedByWalletType: "external_wallet",
      createdAt,
    });

    return {
      attachmentId,
      conversationId,
      deadlineEventId,
      messageId,
      revisionRequestId,
      submissionId,
    };
  });
}

export async function seedAcceptedDisputeAgreement(
  t: BackendTest,
  fixture: DisputeFixture,
): Promise<Id<"workAgreements">> {
  const createdAt = 1_768_480_800_750;

  return await t.run(async (ctx) => {
    const escrow = await ctx.db.get(fixture.escrowId);
    if (!escrow) {
      throw new Error("Dispute fixture escrow is missing.");
    }

    return await ctx.db.insert("workAgreements", {
      agreementNumber: `AGR-C09-${fixture.parentType}-${fixture.escrowStatus}`,
      jobId: fixture.jobId,
      ...(fixture.parentType === "micro_gig" ? { microGigId: fixture.jobId } : {}),
      ...(fixture.milestoneId !== undefined ? { milestoneId: fixture.milestoneId } : {}),
      escrowId: fixture.escrowId,
      onChainEscrowId: escrow.escrowId,
      clientWallet: fixture.clientWallet,
      clientWalletType: "external_wallet",
      freelancerWallet: fixture.freelancerWallet,
      freelancerWalletType: "external_wallet",
      agreementType: "highrable_generated",
      status: "accepted",
      title: "C09 accepted agreement",
      version: 1,
      contentMarkdown: "# C09 Agreement",
      acceptedByFreelancerAt: createdAt,
      acceptedByFreelancerWallet: fixture.freelancerWallet,
      acceptedByFreelancerWalletType: "external_wallet",
      clientConfirmedAt: createdAt,
      paymentAmount: 500,
      paymentAssetContractId: "USDC",
      paymentAssetSymbol: "USDC",
      paymentAssetDecimals: 6,
      contentProtectionEnabled: true,
      createdByWallet: fixture.clientWallet,
      createdByWalletType: "external_wallet",
      createdAt,
      updatedAt: createdAt,
    });
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

export async function assignDisputeFixture(
  t: BackendTest,
  disputeId: Id<"disputes">,
  adminWallet: string,
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.patch(disputeId, {
      assignedAdminWallet: adminWallet,
      assignedAt: Date.now(),
      assignedByWallet: adminWallet,
      updatedAt: Date.now(),
    });
  });
}
