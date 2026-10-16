import { convexTest } from "convex-test";
import { getFunctionName, type FunctionArgs, type FunctionReturnType } from "convex/server";
import { v, type Infer } from "convex/values";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { Doc, Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
import {
  assignDisputeFixture,
  type BackendTest,
  countRecords,
  seedDisputeFixture,
  TEST_ADMIN_SECRET,
  TEST_WALLETS,
} from "../fixtures/disputes";

const PUBLIC_DISPUTE_API_REFERENCES = [
  { name: "createDispute", reference: api.disputes.createDispute },
  { name: "markDisputeOnChainStarted", reference: api.disputes.markDisputeOnChainStarted },
  { name: "markDisputeOnChainSucceeded", reference: api.disputes.markDisputeOnChainSucceeded },
  { name: "markDisputeOnChainFailed", reference: api.disputes.markDisputeOnChainFailed },
  { name: "addDisputeEvidence", reference: api.disputes.addDisputeEvidence },
  { name: "addDisputeResponse", reference: api.disputes.addDisputeResponse },
  { name: "changeDisputeStatus", reference: api.disputes.changeDisputeStatus },
  { name: "cancelDispute", reference: api.disputes.cancelDispute },
  { name: "addModeratorNote", reference: api.disputes.addModeratorNote },
  { name: "recordDisputeResolution", reference: api.disputes.recordDisputeResolution },
  { name: "getDispute", reference: api.disputes.getDispute },
  { name: "getDisputeByParent", reference: api.disputes.getDisputeByParent },
  { name: "getActiveDisputeForEscrow", reference: api.disputes.getActiveDisputeForEscrow },
  { name: "getDisputesForWallet", reference: api.disputes.getDisputesForWallet },
  { name: "getDisputeTimeline", reference: api.disputes.getDisputeTimeline },
  { name: "getDisputeEvidence", reference: api.disputes.getDisputeEvidence },
  { name: "canOpenDispute", reference: api.disputes.canOpenDispute },
  { name: "canViewDispute", reference: api.disputes.canViewDispute },
  { name: "canRespondToDispute", reference: api.disputes.canRespondToDispute },
  { name: "getDisputeContextByParent", reference: api.disputes.getDisputeContextByParent },
] as const;

type ExpectedPublicDisputeApiName = (typeof PUBLIC_DISPUTE_API_REFERENCES)[number]["name"];
type GeneratedPublicDisputeApiName = keyof typeof api.disputes;
type ExpectedGeneratedPublicDisputeApiName = ExpectedPublicDisputeApiName | "mutations" | "queries";

type ExpectedWalletType = "external_wallet" | "passkey_smart_account";
type ExpectedParentType = "micro_gig" | "milestone" | "escrow" | "job";
type ExpectedParticipantRole = "client" | "freelancer";
type ExpectedReasonCategory =
  | "work_not_delivered"
  | "work_quality_issue"
  | "client_unresponsive"
  | "freelancer_unresponsive"
  | "missed_deadline"
  | "revision_disagreement"
  | "payment_release_disagreement"
  | "scope_disagreement"
  | "other";
type ExpectedDisputeStatus =
  | "open"
  | "under_review"
  | "awaiting_client_response"
  | "awaiting_freelancer_response"
  | "resolved_client"
  | "resolved_freelancer"
  | "split_resolution"
  | "cancelled";
type ExpectedMarkingPhase = "not_marked" | "marking" | "marked" | "mark_failed";
type ExpectedEventType =
  | "dispute_opened"
  | "evidence_added"
  | "on_chain_mark_started"
  | "on_chain_mark_succeeded"
  | "on_chain_mark_failed"
  | "status_changed"
  | "client_response_added"
  | "freelancer_response_added"
  | "moderator_note_added"
  | "resolution_proposed"
  | "resolved_client"
  | "resolved_freelancer"
  | "split_resolution"
  | "cancelled";
type ExpectedAttachmentViewerRole =
  | "client"
  | "assigned_freelancer"
  | "dispute_participant"
  | "dispute_reviewer"
  | "admin"
  | "owner"
  | "public";
type ExpectedProtectionMode = "standard" | "protected_preview" | "download_restricted";
type ConvexAny = Infer<ReturnType<typeof v.any>>;

type ExpectedSerializedAttachment = Doc<"attachments"> & {
  url: string | null;
  protection: {
    mode: ExpectedProtectionMode;
    isProtected: boolean;
    previewAllowed: boolean;
    downloadAllowed: boolean;
    watermarkEnabled: boolean;
    accessLoggingEnabled: boolean;
    viewerRole: ExpectedAttachmentViewerRole | null;
    previewSupported: boolean;
    downloadRestricted: boolean;
    protectedReason: string | null;
    notice: string | null;
  };
};
type ExpectedDisputeWithAttachments = Doc<"disputes"> & {
  attachments: ExpectedSerializedAttachment[];
};
type ExpectedTimelineEventWithAttachments = Doc<"disputeEvents"> & {
  attachments: ExpectedSerializedAttachment[];
};

type ExpectedCanOpenResult =
  | {
      allowed: boolean;
      reason: null;
      openedByRole: ExpectedParticipantRole;
      escrowId: Id<"escrows">;
      onChainEscrowId: string;
    }
  | {
      allowed: boolean;
      reason: string;
      openedByRole: null;
      escrowId: null;
      onChainEscrowId: null;
    };
type ExpectedCanViewResult =
  | { allowed: boolean; reason: string; role?: undefined }
  | { allowed: boolean; reason: null; role: ExpectedParticipantRole }
  | { allowed: boolean; reason: string; role: null };
type ExpectedCanRespondResult =
  | { allowed: boolean; reason: null; role: ExpectedParticipantRole }
  | { allowed: boolean; reason: string; role: null };

type ExpectedCreateDisputeArgs = {
  parentType: ExpectedParentType;
  parentId: string;
  openedByWallet: string;
  openedByWalletType: ExpectedWalletType;
  reasonCategory: ExpectedReasonCategory;
  title: string;
  description: string;
  evidenceAttachmentIds?: Id<"attachments">[];
  relatedWorkSubmissionIds?: Id<"workSubmissions">[];
  relatedRevisionRequestIds?: Id<"revisionRequests">[];
  relatedMessageIds?: Id<"messages">[];
  relatedDeadlineEventIds?: Id<"deadlineAuditEvents">[];
  proofHash?: string;
  escrowContractId?: string;
  metadata?: ConvexAny;
};
type ExpectedMarkStartedArgs = {
  disputeId: Id<"disputes">;
  actorWallet: string;
  actorWalletType: ExpectedWalletType;
};
type ExpectedMarkSucceededArgs = {
  disputeId: Id<"disputes">;
  actorWallet: string;
  actorWalletType: ExpectedWalletType;
  transactionHash: string;
  stellarExpertUrl?: string;
};
type ExpectedMarkFailedArgs = {
  disputeId: Id<"disputes">;
  actorWallet: string;
  actorWalletType: ExpectedWalletType;
  errorMessage: string;
  transactionHash?: string;
};
type ExpectedEvidenceArgs = {
  disputeId: Id<"disputes">;
  actorWallet: string;
  actorWalletType: ExpectedWalletType;
  attachmentIds: Id<"attachments">[];
  message?: string;
};
type ExpectedResponseArgs = {
  disputeId: Id<"disputes">;
  responderWallet: string;
  responderWalletType: ExpectedWalletType;
  message: string;
  attachmentIds?: Id<"attachments">[];
  requestId?: string;
};

type ExpectedGetDisputeArgs = {
  disputeId: Id<"disputes">;
  viewerWallet?: string;
};
type ExpectedGetDisputeByParentArgs = {
  parentType: ExpectedParentType;
  parentId: string;
  viewerWallet?: string;
};
type ExpectedGetActiveDisputeForEscrowArgs = {
  escrowId: Id<"escrows">;
  viewerWallet?: string;
};
type ExpectedGetDisputesForWalletArgs = { walletAddress: string };
type ExpectedGetDisputeTimelineArgs = ExpectedGetDisputeArgs;
type ExpectedGetDisputeEvidenceArgs = ExpectedGetDisputeArgs;
type ExpectedCanOpenArgs = {
  parentType: ExpectedParentType;
  parentId: string;
  openedByWallet: string;
};
type ExpectedCanViewArgs = { disputeId: Id<"disputes">; viewerWallet: string };
type ExpectedCanRespondArgs = { disputeId: Id<"disputes">; walletAddress: string };
type ExpectedGetDisputeContextByParentArgs = ExpectedGetDisputeByParentArgs;

type ExpectedDisputeParent = {
  parentType: ExpectedParentType;
  parentId: string;
  jobId?: Id<"jobs">;
  microGigId?: Id<"jobs">;
  milestoneId?: Id<"milestones">;
  escrowId: Id<"escrows">;
  onChainEscrowId: string;
  clientWallet: string;
  freelancerWallet: string;
  status: string;
  escrowStatus: string;
};
type ExpectedDisputeContext = {
  parent: ExpectedDisputeParent;
  submissions: Doc<"workSubmissions">[];
  revisions: Doc<"revisionRequests">[];
  deadlineEvents: Doc<"deadlineAuditEvents">[];
};

function createDisputeArgs(fixture: Awaited<ReturnType<typeof seedDisputeFixture>>) {
  return {
    parentType: fixture.parentType,
    parentId: fixture.parentId,
    openedByWallet: fixture.clientWallet,
    openedByWalletType: "external_wallet",
    reasonCategory: "work_not_delivered",
    title: "API contract dispute",
    description: "API contract fixture dispute.",
  } as const;
}

async function createDispute(
  t: BackendTest,
  fixture: Awaited<ReturnType<typeof seedDisputeFixture>>,
) {
  return await t.mutation(api.disputes.createDispute, createDisputeArgs(fixture));
}

async function readDisputeState(t: BackendTest, disputeId: Id<"disputes">) {
  return await t.run(async (ctx) => ({
    dispute: await ctx.db.get(disputeId),
    events: await ctx.db
      .query("disputeEvents")
      .withIndex("by_dispute", (q) => q.eq("disputeId", disputeId))
      .collect(),
  }));
}

async function snapshotAllDocuments(t: BackendTest) {
  return await t.run(async (ctx) => ({
    attachments: await ctx.db.query("attachments").collect(),
    attachmentAccessLogs: await ctx.db.query("attachmentAccessLogs").collect(),
    cancellationRequests: await ctx.db.query("cancellationRequests").collect(),
    cancellationEvents: await ctx.db.query("cancellationEvents").collect(),
    conversations: await ctx.db.query("conversations").collect(),
    messages: await ctx.db.query("messages").collect(),
    conversationReads: await ctx.db.query("conversationReads").collect(),
    users: await ctx.db.query("users").collect(),
    jobs: await ctx.db.query("jobs").collect(),
    milestones: await ctx.db.query("milestones").collect(),
    applications: await ctx.db.query("applications").collect(),
    escrows: await ctx.db.query("escrows").collect(),
    jobReports: await ctx.db.query("jobReports").collect(),
    reputationRecords: await ctx.db.query("reputationRecords").collect(),
    revisionRequests: await ctx.db.query("revisionRequests").collect(),
    transactions: await ctx.db.query("transactions").collect(),
    waitlistEntries: await ctx.db.query("waitlistEntries").collect(),
    workAgreements: await ctx.db.query("workAgreements").collect(),
    workAgreementEvents: await ctx.db.query("workAgreementEvents").collect(),
    workAgreementVersions: await ctx.db.query("workAgreementVersions").collect(),
    workSubmissions: await ctx.db.query("workSubmissions").collect(),
    deadlineReminders: await ctx.db.query("deadlineReminders").collect(),
    notifications: await ctx.db.query("notifications").collect(),
    deadlineAuditEvents: await ctx.db.query("deadlineAuditEvents").collect(),
    disputes: await ctx.db.query("disputes").collect(),
    disputeEvents: await ctx.db.query("disputeEvents").collect(),
    disputeAdmins: await ctx.db.query("disputeAdmins").collect(),
    disputeAdminOperations: await ctx.db.query("disputeAdminOperations").collect(),
    disputeAssignmentEvents: await ctx.db.query("disputeAssignmentEvents").collect(),
    settlementAttempts: await ctx.db.query("settlementAttempts").collect(),
  }));
}

describe("dispute API contracts", () => {
  it("keeps the exact generated public dispute API key set and function names", () => {
    expectTypeOf<GeneratedPublicDisputeApiName>().toEqualTypeOf<ExpectedGeneratedPublicDisputeApiName>();
    expect(
      PUBLIC_DISPUTE_API_REFERENCES.map(({ reference }) => getFunctionName(reference)),
    ).toEqual(PUBLIC_DISPUTE_API_REFERENCES.map(({ name }) => `disputes:${name}`));
  });

  it("locks participant API arguments, returns, unions, nullability, and enrichment", () => {
    expectTypeOf<
      FunctionArgs<typeof api.disputes.createDispute>
    >().toEqualTypeOf<ExpectedCreateDisputeArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.markDisputeOnChainStarted>
    >().toEqualTypeOf<ExpectedMarkStartedArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.markDisputeOnChainSucceeded>
    >().toEqualTypeOf<ExpectedMarkSucceededArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.markDisputeOnChainFailed>
    >().toEqualTypeOf<ExpectedMarkFailedArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.addDisputeEvidence>
    >().toEqualTypeOf<ExpectedEvidenceArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.addDisputeResponse>
    >().toEqualTypeOf<ExpectedResponseArgs>();

    expectTypeOf<
      FunctionArgs<typeof api.disputes.getDispute>
    >().toEqualTypeOf<ExpectedGetDisputeArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.getDisputeByParent>
    >().toEqualTypeOf<ExpectedGetDisputeByParentArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.getActiveDisputeForEscrow>
    >().toEqualTypeOf<ExpectedGetActiveDisputeForEscrowArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.getDisputesForWallet>
    >().toEqualTypeOf<ExpectedGetDisputesForWalletArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.getDisputeTimeline>
    >().toEqualTypeOf<ExpectedGetDisputeTimelineArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.getDisputeEvidence>
    >().toEqualTypeOf<ExpectedGetDisputeEvidenceArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.canOpenDispute>
    >().toEqualTypeOf<ExpectedCanOpenArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.canViewDispute>
    >().toEqualTypeOf<ExpectedCanViewArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.canRespondToDispute>
    >().toEqualTypeOf<ExpectedCanRespondArgs>();
    expectTypeOf<
      FunctionArgs<typeof api.disputes.getDisputeContextByParent>
    >().toEqualTypeOf<ExpectedGetDisputeContextByParentArgs>();

    expectTypeOf<FunctionReturnType<typeof api.disputes.createDispute>>().toEqualTypeOf<
      Id<"disputes">
    >();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.markDisputeOnChainStarted>
    >().toEqualTypeOf<boolean>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.markDisputeOnChainSucceeded>
    >().toEqualTypeOf<boolean>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.markDisputeOnChainFailed>
    >().toEqualTypeOf<boolean>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.addDisputeEvidence>
    >().toEqualTypeOf<boolean>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.addDisputeResponse>
    >().toEqualTypeOf<boolean>();

    expectTypeOf<
      FunctionReturnType<typeof api.disputes.getDispute>
    >().branded.toEqualTypeOf<ExpectedDisputeWithAttachments | null>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.getDisputeByParent>
    >().branded.toEqualTypeOf<ExpectedDisputeWithAttachments | null>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.getActiveDisputeForEscrow>
    >().branded.toEqualTypeOf<ExpectedDisputeWithAttachments | null>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.getDisputesForWallet>
    >().branded.toEqualTypeOf<Doc<"disputes">[]>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.getDisputeTimeline>
    >().branded.toEqualTypeOf<ExpectedTimelineEventWithAttachments[]>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.getDisputeEvidence>
    >().branded.toEqualTypeOf<ExpectedSerializedAttachment[]>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.canOpenDispute>
    >().branded.toEqualTypeOf<ExpectedCanOpenResult>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.canViewDispute>
    >().branded.toEqualTypeOf<ExpectedCanViewResult>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.canRespondToDispute>
    >().branded.toEqualTypeOf<ExpectedCanRespondResult>();
    expectTypeOf<
      FunctionReturnType<typeof api.disputes.getDisputeContextByParent>
    >().branded.toEqualTypeOf<ExpectedDisputeContext | null>();

    type GeneratedDispute = NonNullable<FunctionReturnType<typeof api.disputes.getDispute>>;
    type GeneratedTimelineEvent = FunctionReturnType<
      typeof api.disputes.getDisputeTimeline
    >[number];
    expectTypeOf<GeneratedDispute["status"]>().toEqualTypeOf<ExpectedDisputeStatus>();
    expectTypeOf<GeneratedDispute["onChainStatus"]>().toEqualTypeOf<ExpectedMarkingPhase>();
    expectTypeOf<GeneratedDispute["reasonCategory"]>().toEqualTypeOf<ExpectedReasonCategory>();
    expectTypeOf<GeneratedTimelineEvent["type"]>().toEqualTypeOf<ExpectedEventType>();
  });

  it("rejects malformed mutation arguments without changing stored records", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-validation" });
    const beforeCreation = {
      disputes: await countRecords(t, "disputes"),
      events: await countRecords(t, "disputeEvents"),
    };
    const { title: _title, ...missingTitle } = createDisputeArgs(fixture);

    await expect(t.mutation(api.disputes.createDispute, missingTitle as never)).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.createDispute, {
        ...createDisputeArgs(fixture),
        reasonCategory: "invalid_reason",
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.createDispute, {
        ...createDisputeArgs(fixture),
        openedByWalletType: 42,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.createDispute, {
        ...createDisputeArgs(fixture),
        evidenceAttachmentIds: [fixture.jobId as unknown as Id<"attachments">],
      } as never),
    ).rejects.toThrow();

    expect(await countRecords(t, "disputes")).toBe(beforeCreation.disputes);
    expect(await countRecords(t, "disputeEvents")).toBe(beforeCreation.events);

    const disputeId = await createDispute(t, fixture);
    const before = await readDisputeState(t, disputeId);

    const { message: _message, ...missingResponseMessage } = {
      disputeId,
      responderWallet: fixture.clientWallet,
      responderWalletType: "external_wallet",
      message: "A response that will not be submitted.",
    };
    await expect(
      t.mutation(api.disputes.addDisputeResponse, missingResponseMessage as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.changeDisputeStatus, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        status: "invalid_status",
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.markDisputeOnChainStarted, {
        disputeId,
        actorWallet: fixture.clientWallet,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: "not-an-array",
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        disputeId,
        actorWallet: fixture.clientWallet,
        actorWalletType: "external_wallet",
        attachmentIds: [fixture.jobId as unknown as Id<"attachments">],
      } as never),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "Another response that will not be submitted.",
        attachmentIds: [fixture.jobId as unknown as Id<"attachments">],
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDispute, {
        disputeId: fixture.jobId as unknown as Id<"disputes">,
        viewerWallet: fixture.clientWallet,
      } as never),
    ).rejects.toThrow();

    expect(await readDisputeState(t, disputeId)).toEqual(before);
  });

  it("rejects unexpected top-level arguments on participant queries", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-query-extra-args" });
    const disputeId = await createDispute(t, fixture);
    const unexpected = { unexpected: true };

    await expect(
      t.query(api.disputes.getDispute, {
        disputeId,
        viewerWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDisputeByParent, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        viewerWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getActiveDisputeForEscrow, {
        escrowId: fixture.escrowId,
        viewerWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDisputesForWallet, {
        walletAddress: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDisputeTimeline, {
        disputeId,
        viewerWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDisputeEvidence, {
        disputeId,
        viewerWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.canOpenDispute, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        openedByWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.canViewDispute, {
        disputeId,
        viewerWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.canRespondToDispute, {
        disputeId,
        walletAddress: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    await expect(
      t.query(api.disputes.getDisputeContextByParent, {
        parentType: fixture.parentType,
        parentId: fixture.parentId,
        viewerWallet: fixture.clientWallet,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
  });

  it("rejects unexpected top-level arguments on participant mutations without writes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-mutation-extra-args" });
    const unexpected = { unexpected: true };

    const beforeCreation = await snapshotAllDocuments(t);
    await expect(
      t.mutation(api.disputes.createDispute, {
        ...createDisputeArgs(fixture),
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    expect(await snapshotAllDocuments(t)).toEqual(beforeCreation);

    const disputeId = await createDispute(t, fixture);
    const markingArgs = {
      disputeId,
      actorWallet: fixture.clientWallet,
      actorWalletType: "external_wallet" as const,
    };

    const beforeStart = await snapshotAllDocuments(t);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainStarted, {
        ...markingArgs,
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    expect(await snapshotAllDocuments(t)).toEqual(beforeStart);

    await t.mutation(api.disputes.markDisputeOnChainStarted, markingArgs);

    const beforeFailure = await snapshotAllDocuments(t);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainFailed, {
        ...markingArgs,
        errorMessage: "A deterministic marking failure.",
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    expect(await snapshotAllDocuments(t)).toEqual(beforeFailure);

    await t.mutation(api.disputes.markDisputeOnChainFailed, {
      ...markingArgs,
      errorMessage: "A deterministic marking failure.",
    });

    const beforeSuccess = await snapshotAllDocuments(t);
    await expect(
      t.mutation(api.disputes.markDisputeOnChainSucceeded, {
        ...markingArgs,
        transactionHash: "a".repeat(64),
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    expect(await snapshotAllDocuments(t)).toEqual(beforeSuccess);

    const beforeEvidence = await snapshotAllDocuments(t);
    await expect(
      t.mutation(api.disputes.addDisputeEvidence, {
        ...markingArgs,
        attachmentIds: [],
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    expect(await snapshotAllDocuments(t)).toEqual(beforeEvidence);

    const beforeResponse = await snapshotAllDocuments(t);
    await expect(
      t.mutation(api.disputes.addDisputeResponse, {
        disputeId,
        responderWallet: fixture.clientWallet,
        responderWalletType: "external_wallet",
        message: "A valid response that must not be written.",
        attachmentIds: [],
        ...unexpected,
      } as never),
    ).rejects.toThrow();
    expect(await snapshotAllDocuments(t)).toEqual(beforeResponse);
  });

  it("locks present, denied, and missing participant result shapes", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-shapes" });
    const disputeId = await createDispute(t, fixture);

    const present = await t.query(api.disputes.getDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentByParent = await t.query(api.disputes.getDisputeByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.clientWallet,
    });
    const presentByEscrow = await t.query(api.disputes.getActiveDisputeForEscrow, {
      escrowId: fixture.escrowId,
      viewerWallet: fixture.clientWallet,
    });
    const presentTimeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentEvidence = await t.query(api.disputes.getDisputeEvidence, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentContext = await t.query(api.disputes.getDisputeContextByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.clientWallet,
    });
    const presentViewPermission = await t.query(api.disputes.canViewDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const presentResponsePermission = await t.query(api.disputes.canRespondToDispute, {
      disputeId,
      walletAddress: fixture.clientWallet,
    });
    const deniedViewPermission = await t.query(api.disputes.canViewDispute, {
      disputeId,
      viewerWallet: fixture.unrelatedWallet,
    });
    const deniedResponsePermission = await t.query(api.disputes.canRespondToDispute, {
      disputeId,
      walletAddress: fixture.unrelatedWallet,
    });
    const deniedContext = await t.query(api.disputes.getDisputeContextByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.unrelatedWallet,
    });
    const deniedWalletDisputes = await t.query(api.disputes.getDisputesForWallet, {
      walletAddress: fixture.unrelatedWallet,
    });

    expect(present).toMatchObject({ _id: disputeId, attachments: [] });
    expect(presentByParent).toMatchObject({ _id: disputeId, attachments: [] });
    expect(presentByEscrow).toMatchObject({ _id: disputeId, attachments: [] });
    expect(presentTimeline).toHaveLength(1);
    expect(presentTimeline[0]).toMatchObject({ disputeId, attachments: [] });
    expect(presentEvidence).toEqual([]);
    expect(presentContext).toMatchObject({
      parent: expect.objectContaining({ parentId: fixture.parentId }),
      submissions: [],
      revisions: [],
      deadlineEvents: [],
    });
    expect(presentViewPermission).toEqual({ allowed: true, reason: null, role: "client" });
    expect(presentResponsePermission).toEqual({ allowed: true, reason: null, role: "client" });
    expect(deniedViewPermission).toEqual({
      allowed: false,
      reason: expect.any(String),
      role: null,
    });
    expect(deniedResponsePermission).toEqual({
      allowed: false,
      reason: expect.any(String),
      role: null,
    });
    expect(deniedContext).toBeNull();
    expect(deniedWalletDisputes).toEqual([]);
    await expect(
      t.query(api.disputes.getDispute, {
        disputeId,
        viewerWallet: fixture.unrelatedWallet,
      }),
    ).rejects.toThrow();

    await t.run(async (ctx) => ctx.db.delete(disputeId));

    const missing = await t.query(api.disputes.getDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingTimeline = await t.query(api.disputes.getDisputeTimeline, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingEvidence = await t.query(api.disputes.getDisputeEvidence, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingByParent = await t.query(api.disputes.getDisputeByParent, {
      parentType: fixture.parentType,
      parentId: fixture.parentId,
      viewerWallet: fixture.clientWallet,
    });
    const missingByEscrow = await t.query(api.disputes.getActiveDisputeForEscrow, {
      escrowId: fixture.escrowId,
      viewerWallet: fixture.clientWallet,
    });
    const missingViewPermission = await t.query(api.disputes.canViewDispute, {
      disputeId,
      viewerWallet: fixture.clientWallet,
    });
    const missingResponsePermission = await t.query(api.disputes.canRespondToDispute, {
      disputeId,
      walletAddress: fixture.clientWallet,
    });

    expect(missing).toBeNull();
    expect(missingTimeline).toEqual([]);
    expect(missingEvidence).toEqual([]);
    expect(missingByParent).toBeNull();
    expect(missingByEscrow).toBeNull();
    expect(missingViewPermission).toEqual({ allowed: false, reason: "Dispute not found." });
    expect(missingViewPermission).not.toHaveProperty("role");
    expect(missingResponsePermission).toEqual({
      allowed: false,
      reason: "Dispute not found.",
      role: null,
    });
  });

  it("keeps legacy dispute moderator and resolution exports rejecting", async () => {
    vi.stubEnv("HIGHRABLE_ADMIN_WALLET_ADDRESS", TEST_WALLETS.admin);
    vi.stubEnv("HIGHRABLE_ADMIN_CONVEX_SECRET", TEST_ADMIN_SECRET);

    const t = convexTest(schema, modules);
    const fixture = await seedDisputeFixture(t, { label: "api-legacy-exports" });
    const disputeId = await createDispute(t, fixture);
    await assignDisputeFixture(t, disputeId, TEST_WALLETS.admin);

    await expect(
      t.mutation(api.disputes.addModeratorNote, {
        disputeId,
        moderatorWallet: TEST_WALLETS.admin,
        moderatorWalletType: "external_wallet",
        message: "Legacy note export should reject.",
      }),
    ).rejects.toThrow("Manual review tools will be added in a future phase.");
    await expect(
      t.mutation(api.disputes.recordDisputeResolution, {
        disputeId,
        moderatorWallet: TEST_WALLETS.admin,
        moderatorWalletType: "external_wallet",
        status: "resolved_client",
        message: "Legacy resolution export should reject.",
      }),
    ).rejects.toThrow("Resolution recorded in Highrable review workflow is not automated");

    await expect(
      t.mutation(api.admin.addModeratorNote, {
        adminWallet: TEST_WALLETS.admin,
        adminApiSecret: TEST_ADMIN_SECRET,
        disputeId,
        message: "Working administrator note export.",
      }),
    ).resolves.toBe(true);
  });
});
