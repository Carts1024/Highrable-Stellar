import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  IAdminDisputeDetail,
  IAdminDisputeListItem,
  IAdminDisputesResponse,
  TAdminDisputeDetailQueryResult,
  TAdminDisputeQueueQueryResult,
  TAdminReviewStatus,
} from "./types";
import type {
  TParticipantDisputeQueryResult,
  TParticipantDisputeTimelineQueryResult,
  TDisputeActorRole,
  TDisputeOnChainStatus,
  TDisputeStatus,
} from "@/features/disputes/types";
import type { TConvexDoc, TConvexId, TConvexTableName } from "@repo/convex-client";

import { fetchAdminDispute, fetchAdminDisputes, AdminApiError } from "./lib/admin-api";

type TAdminDispute = IAdminDisputeDetail["dispute"];
type TAdminAttachment = TAdminDispute["attachments"][number];
type TAdminTimelineEvent = IAdminDisputeDetail["timeline"][number];
type TParticipantTimelineAttachment =
  TParticipantDisputeTimelineQueryResult[number]["attachments"][number];
type TAdminAssignmentEvent = IAdminDisputeDetail["assignmentEvents"][number];
type TAdminSettlementAttempt = IAdminDisputeDetail["settlementAttempts"][number];
type TAdminJob = NonNullable<IAdminDisputeDetail["job"]>;
type TAdminMilestone = NonNullable<IAdminDisputeDetail["milestone"]>;
type TAdminEscrow = NonNullable<IAdminDisputeDetail["escrow"]>;

const clientWallet = "GCLIENT";
const freelancerWallet = "GFREELANCER";
const adminWallet = `G${"A".repeat(55)}`;
const openedAt = 1_700_000_000_000;

function syntheticId<TTable extends TConvexTableName>(value: string): TConvexId<TTable> {
  return value as TConvexId<TTable>;
}

const clientDisputeId = syntheticId<"disputes">("dispute-client-micro-gig");
const freelancerDisputeId = syntheticId<"disputes">("dispute-freelancer-milestone");
const microGigId = syntheticId<"jobs">("job-micro-gig");
const milestoneJobId = syntheticId<"jobs">("job-milestone-project");
const milestoneId = syntheticId<"milestones">("milestone-1");
const clientEscrowId = syntheticId<"escrows">("escrow-client-micro-gig");
const freelancerEscrowId = syntheticId<"escrows">("escrow-freelancer-milestone");
const caseAttachmentId = syntheticId<"attachments">("attachment-case-client");
const timelineAttachmentId = syntheticId<"attachments">("attachment-timeline-freelancer");
const missingAttachmentId = syntheticId<"attachments">("attachment-missing");
const submissionId = syntheticId<"workSubmissions">("submission-1");
const revisionId = syntheticId<"revisionRequests">("revision-1");
const messageId = syntheticId<"messages">("message-1");
const deadlineEventId = syntheticId<"deadlineAuditEvents">("deadline-1");

const clientDisputeDocument = {
  _id: clientDisputeId,
  _creationTime: openedAt,
  disputeNumber: "DSP-CLIENT-001",
  parentType: "micro_gig",
  parentId: microGigId,
  jobId: microGigId,
  microGigId,
  escrowId: clientEscrowId,
  onChainEscrowId: "on-chain-client-micro-gig",
  clientWallet,
  clientWalletType: "external_wallet",
  freelancerWallet,
  freelancerWalletType: "external_wallet",
  openedByWallet: clientWallet,
  openedByWalletType: "external_wallet",
  openedByRole: "client",
  reasonCategory: "work_not_delivered",
  title: "Client opened micro-gig dispute",
  description: "The agreed micro-gig deliverable was not delivered.",
  evidenceAttachmentIds: [caseAttachmentId, missingAttachmentId],
  relatedWorkSubmissionIds: [submissionId],
  relatedRevisionRequestIds: [revisionId],
  relatedMessageIds: [messageId],
  relatedDeadlineEventIds: [deadlineEventId],
  assignedAdminWallet: undefined,
  assignedAt: undefined,
  status: "open",
  onChainStatus: "not_marked",
  openedAt,
  createdAt: openedAt,
  updatedAt: openedAt,
} satisfies TConvexDoc<"disputes">;

const freelancerDisputeDocument = {
  _id: freelancerDisputeId,
  _creationTime: openedAt + 1,
  disputeNumber: "DSP-FREELANCER-001",
  parentType: "milestone",
  parentId: milestoneId,
  jobId: milestoneJobId,
  milestoneId,
  escrowId: freelancerEscrowId,
  onChainEscrowId: "on-chain-freelancer-milestone",
  clientWallet,
  clientWalletType: "external_wallet",
  freelancerWallet,
  freelancerWalletType: "external_wallet",
  openedByWallet: freelancerWallet,
  openedByWalletType: "external_wallet",
  openedByRole: "freelancer",
  reasonCategory: "payment_release_disagreement",
  title: "Freelancer opened milestone dispute",
  description: "The completed milestone was not released for payment.",
  evidenceAttachmentIds: [timelineAttachmentId],
  relatedWorkSubmissionIds: [],
  relatedRevisionRequestIds: [],
  assignedAdminWallet: undefined,
  assignedAt: undefined,
  status: "open",
  onChainStatus: "not_marked",
  openedAt: openedAt + 1,
  createdAt: openedAt + 1,
  updatedAt: openedAt + 1,
} satisfies TConvexDoc<"disputes">;

const microGigParent = {
  _id: microGigId,
  _creationTime: openedAt,
  title: "Micro-gig parent",
  description: "A micro-gig used by the consumer contract fixture.",
  budget: 100,
  asset: "USDC",
  jobType: "micro_gig",
  clientWallet,
  selectedFreelancerWallet: freelancerWallet,
  status: "disputed",
  jobHash: "job-hash-micro-gig",
  createdAt: openedAt,
  updatedAt: openedAt,
} satisfies TAdminJob;

const milestoneJobParent = {
  _id: milestoneJobId,
  _creationTime: openedAt,
  title: "Milestone project parent",
  description: "A milestone project used by the consumer contract fixture.",
  budget: 500,
  asset: "USDC",
  jobType: "milestone_project",
  totalBudget: 500,
  milestoneCount: 1,
  clientWallet,
  selectedFreelancerWallet: freelancerWallet,
  status: "disputed",
  jobHash: "job-hash-milestone-project",
  createdAt: openedAt,
  updatedAt: openedAt,
} satisfies TAdminJob;

const milestoneParent = {
  _id: milestoneId,
  _creationTime: openedAt,
  jobId: milestoneJobId,
  order: 1,
  title: "Milestone one",
  description: "The first milestone.",
  amount: 500,
  asset: "USDC",
  status: "disputed",
  assignedFreelancerWallet: freelancerWallet,
  escrowId: "on-chain-freelancer-milestone",
  createdAt: openedAt,
  updatedAt: openedAt,
} satisfies TAdminMilestone;

const clientEscrow = {
  _id: clientEscrowId,
  _creationTime: openedAt,
  jobId: microGigId,
  escrowId: "on-chain-client-micro-gig",
  clientWallet,
  freelancerWallet,
  amount: 100,
  asset: "USDC",
  status: "disputed",
  createdAt: openedAt,
  updatedAt: openedAt,
} satisfies TAdminEscrow;

const freelancerEscrow = {
  _id: freelancerEscrowId,
  _creationTime: openedAt,
  jobId: milestoneJobId,
  milestoneId,
  escrowId: "on-chain-freelancer-milestone",
  clientWallet,
  freelancerWallet,
  amount: 500,
  asset: "USDC",
  status: "disputed",
  createdAt: openedAt,
  updatedAt: openedAt,
} satisfies TAdminEscrow;

const clientCaseAttachment = {
  _id: caseAttachmentId,
  _creationTime: openedAt,
  type: "pdf",
  name: "client-proof.pdf",
  uploadedByWallet: clientWallet,
  uploadedByWalletType: "external_wallet",
  ownerRole: "client",
  parentType: "dispute",
  parentId: clientDisputeId,
  visibility: "participants",
  status: "active",
  createdAt: openedAt,
  updatedAt: openedAt,
  url: null,
} satisfies TAdminAttachment;

const freelancerTimelineAttachment = {
  _id: timelineAttachmentId,
  _creationTime: openedAt + 1,
  type: "document",
  name: "milestone-proof.docx",
  uploadedByWallet: freelancerWallet,
  uploadedByWalletType: "external_wallet",
  ownerRole: "freelancer",
  parentType: "dispute",
  parentId: freelancerDisputeId,
  visibility: "admin_only",
  status: "active",
  externalUrl: "https://evidence.example.test/milestone-proof",
  createdAt: openedAt + 1,
  updatedAt: openedAt + 1,
  url: "https://storage.example.test/milestone-proof.docx",
} satisfies TAdminAttachment;

const freelancerTimelineParticipantAttachment = {
  ...freelancerTimelineAttachment,
  protection: {
    mode: "standard",
    isProtected: false,
    previewAllowed: true,
    downloadAllowed: true,
    watermarkEnabled: false,
    accessLoggingEnabled: false,
    viewerRole: "dispute_participant",
    previewSupported: true,
    downloadRestricted: false,
    protectedReason: null,
    notice: null,
  },
} satisfies TParticipantTimelineAttachment;

const clientOpeningEvent = {
  _id: syntheticId<"disputeEvents">("event-client-opened"),
  _creationTime: openedAt,
  disputeId: clientDisputeId,
  type: "dispute_opened",
  actorWallet: clientWallet,
  actorWalletType: "external_wallet",
  actorRole: "client",
  message: "Client opened a platform-reviewed dispute.",
  attachmentIds: [caseAttachmentId, missingAttachmentId],
  newStatus: "open",
  createdAt: openedAt,
  attachments: [clientCaseAttachment],
} satisfies TAdminTimelineEvent;

const freelancerOpeningEvent = {
  _id: syntheticId<"disputeEvents">("event-freelancer-opened"),
  _creationTime: openedAt + 1,
  disputeId: freelancerDisputeId,
  type: "dispute_opened",
  actorWallet: freelancerWallet,
  actorWalletType: "external_wallet",
  actorRole: "freelancer",
  message: "Freelancer opened a platform-reviewed dispute.",
  attachmentIds: [timelineAttachmentId],
  newStatus: "open",
  createdAt: openedAt + 1,
  attachments: [freelancerTimelineParticipantAttachment],
} satisfies TAdminTimelineEvent;

const clientAssignmentEvent = {
  _id: syntheticId<"disputeAssignmentEvents">("assignment-client-1"),
  _creationTime: openedAt + 2,
  disputeId: clientDisputeId,
  type: "claimed",
  actorWallet: adminWallet,
  assignedAdminWallet: adminWallet,
  createdAt: openedAt + 2,
} satisfies TAdminAssignmentEvent;

const freelancerSettlementAttempt = {
  _id: syntheticId<"settlementAttempts">("settlement-freelancer-1"),
  _creationTime: openedAt + 3,
  disputeId: freelancerDisputeId,
  escrowDocumentId: freelancerEscrowId,
  onChainEscrowId: "on-chain-freelancer-milestone",
  network: "testnet",
  contractId: `C${"B".repeat(55)}`,
  actorWallet: adminWallet,
  status: "failed",
  resolutionStatus: "resolved_freelancer",
  freelancerShareBps: 10_000,
  operationId: "resolve_dispute:freelancer-milestone:1",
  errorMessage: "Simulation rejected the settlement.",
  createdAt: openedAt + 3,
  updatedAt: openedAt + 3,
} satisfies TAdminSettlementAttempt;

const clientCaseDetail = {
  dispute: {
    ...clientDisputeDocument,
    attachments: [clientCaseAttachment],
  },
  timeline: [clientOpeningEvent],
  assignmentEvents: [clientAssignmentEvent],
  settlementAttempts: [],
  job: microGigParent,
  milestone: null,
  escrow: clientEscrow,
} satisfies IAdminDisputeDetail;

const freelancerCaseDetail = {
  dispute: {
    ...freelancerDisputeDocument,
    attachments: [],
  },
  timeline: [freelancerOpeningEvent],
  assignmentEvents: [],
  settlementAttempts: [freelancerSettlementAttempt],
  job: milestoneJobParent,
  milestone: milestoneParent,
  escrow: freelancerEscrow,
} satisfies IAdminDisputeDetail;

const clientQueueItem = {
  disputeId: clientDisputeDocument._id,
  disputeNumber: clientDisputeDocument.disputeNumber,
  title: clientDisputeDocument.title,
  status: clientDisputeDocument.status,
  onChainStatus: clientDisputeDocument.onChainStatus,
  reasonCategory: clientDisputeDocument.reasonCategory,
  clientWallet: clientDisputeDocument.clientWallet,
  freelancerWallet: clientDisputeDocument.freelancerWallet,
  openedAt: clientDisputeDocument.openedAt,
  updatedAt: clientDisputeDocument.updatedAt,
  assignedAdminWallet: clientDisputeDocument.assignedAdminWallet,
  assignedAt: clientDisputeDocument.assignedAt,
} satisfies IAdminDisputeListItem;

const freelancerQueueItem = {
  disputeId: freelancerDisputeDocument._id,
  disputeNumber: freelancerDisputeDocument.disputeNumber,
  title: freelancerDisputeDocument.title,
  status: freelancerDisputeDocument.status,
  onChainStatus: freelancerDisputeDocument.onChainStatus,
  reasonCategory: freelancerDisputeDocument.reasonCategory,
  clientWallet: freelancerDisputeDocument.clientWallet,
  freelancerWallet: freelancerDisputeDocument.freelancerWallet,
  openedAt: freelancerDisputeDocument.openedAt,
  updatedAt: freelancerDisputeDocument.updatedAt,
  assignedAdminWallet: freelancerDisputeDocument.assignedAdminWallet,
  assignedAt: freelancerDisputeDocument.assignedAt,
} satisfies IAdminDisputeListItem;

const queueResponse = {
  disputes: [clientQueueItem, freelancerQueueItem],
} satisfies IAdminDisputesResponse;

const nullableParentDetail = {
  ...clientCaseDetail,
  job: null,
  milestone: null,
  escrow: null,
} satisfies IAdminDisputeDetail;

const exactDisputeStatuses = [
  "open",
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
  "resolved_client",
  "resolved_freelancer",
  "split_resolution",
  "cancelled",
] as const satisfies readonly TDisputeStatus[];

const exactMarkingStatuses = [
  "not_marked",
  "marking",
  "marked",
  "mark_failed",
] as const satisfies readonly TDisputeOnChainStatus[];

const exactActorRoles = [
  "client",
  "freelancer",
  "moderator",
  "system",
] as const satisfies readonly TDisputeActorRole[];

const adminWritableReviewStatuses = [
  "under_review",
  "awaiting_client_response",
  "awaiting_freelancer_response",
] as const satisfies readonly TAdminReviewStatus[];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("administrator consumer contract", () => {
  it("keeps participant and administrator fields on the generated contract", () => {
    const participantClientFields = {
      parentType: clientCaseDetail.dispute.parentType,
      parentId: clientCaseDetail.dispute.parentId,
      clientWallet: clientCaseDetail.dispute.clientWallet,
      freelancerWallet: clientCaseDetail.dispute.freelancerWallet,
      openedByWallet: clientCaseDetail.dispute.openedByWallet,
      openedByRole: clientCaseDetail.dispute.openedByRole,
      status: clientCaseDetail.dispute.status,
      onChainStatus: clientCaseDetail.dispute.onChainStatus,
    } satisfies Pick<
      NonNullable<TParticipantDisputeQueryResult>,
      | "parentType"
      | "parentId"
      | "clientWallet"
      | "freelancerWallet"
      | "openedByWallet"
      | "openedByRole"
      | "status"
      | "onChainStatus"
    >;

    const participantTimelineEvent =
      freelancerOpeningEvent satisfies TParticipantDisputeTimelineQueryResult[number];

    expect(participantClientFields).toMatchObject({
      parentType: "micro_gig",
      parentId: microGigId,
      clientWallet,
      freelancerWallet,
      openedByWallet: clientWallet,
      openedByRole: "client",
      status: "open",
      onChainStatus: "not_marked",
    });
    expect(participantTimelineEvent).toMatchObject({
      type: "dispute_opened",
      actorRole: "freelancer",
      newStatus: "open",
    });
    expect(exactDisputeStatuses).toHaveLength(8);
    expect(exactMarkingStatuses).toHaveLength(4);
    expect(exactActorRoles).toEqual(["client", "freelancer", "moderator", "system"]);
    expect(adminWritableReviewStatuses).toHaveLength(3);
  });

  it("locks queue, envelope, detail, parent, assignment, settlement, and evidence fields", () => {
    expect(queueResponse.disputes).toEqual([clientQueueItem, freelancerQueueItem]);
    expect(clientCaseDetail.dispute).toMatchObject({
      _id: clientDisputeId,
      parentType: "micro_gig",
      parentId: microGigId,
      jobId: microGigId,
      microGigId,
      escrowId: clientEscrowId,
      clientWallet,
      freelancerWallet,
      openedByWallet: clientWallet,
      openedByRole: "client",
      status: "open",
      onChainStatus: "not_marked",
      evidenceAttachmentIds: [caseAttachmentId, missingAttachmentId],
      relatedWorkSubmissionIds: [submissionId],
      relatedRevisionRequestIds: [revisionId],
      relatedMessageIds: [messageId],
      relatedDeadlineEventIds: [deadlineEventId],
    });
    expect(clientCaseDetail.dispute.attachments).toEqual([clientCaseAttachment]);
    expect(clientCaseDetail.timeline[0]).toMatchObject({
      type: "dispute_opened",
      actorWallet: clientWallet,
      actorRole: "client",
      attachmentIds: [caseAttachmentId, missingAttachmentId],
      attachments: [clientCaseAttachment],
    });
    expect(clientCaseDetail.assignmentEvents).toEqual([clientAssignmentEvent]);
    expect(freelancerCaseDetail.settlementAttempts).toEqual([freelancerSettlementAttempt]);
    expect(clientCaseDetail.job).toEqual(microGigParent);
    expect(clientCaseDetail.milestone).toBeNull();
    expect(freelancerCaseDetail.milestone).toEqual(milestoneParent);
    expect(nullableParentDetail.job).toBeNull();
    expect(nullableParentDetail.milestone).toBeNull();
    expect(nullableParentDetail.escrow).toBeNull();
    expect(clientCaseAttachment.url).toBeNull();
    expect(freelancerTimelineAttachment.url).toBeTypeOf("string");
    expect(freelancerTimelineParticipantAttachment.protection.viewerRole).toBe(
      "dispute_participant",
    );
    expect(clientCaseDetail.dispute.attachments).not.toContainEqual(
      expect.objectContaining({ _id: missingAttachmentId }),
    );
  });

  it("preserves typed queue/detail responses and performs credentialed uncached reads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(queueResponse))
      .mockResolvedValueOnce(jsonResponse(clientCaseDetail));
    vi.stubGlobal("fetch", fetchMock);

    const fetchedQueue = await fetchAdminDisputes({
      status: "open",
      onChainStatus: "not_marked",
      limit: 2,
    });
    const expectedDecodedQueue = {
      disputes: queueResponse.disputes.map(
        ({ assignedAdminWallet: _assignedAdminWallet, assignedAt: _assignedAt, ...item }) => item,
      ),
    };
    expect(fetchedQueue).toEqual(expectedDecodedQueue);
    await expect(fetchAdminDispute(clientDisputeId)).resolves.toEqual(clientCaseDetail);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/disputes?status=open&onChainStatus=not_marked&limit=2",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/disputes/${clientDisputeId}`,
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it("preserves a typed empty queue as an empty result", async () => {
    const emptyQueue = { disputes: [] } satisfies IAdminDisputesResponse;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(emptyQueue)));

    await expect(fetchAdminDisputes()).resolves.toEqual(emptyQueue);
  });

  it.each([401, 403, 404] as const)(
    "rejects admin detail HTTP %s without changing its contract",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ error: "request denied" }, status)),
      );

      await expect(fetchAdminDispute(clientDisputeId)).rejects.toEqual(
        expect.objectContaining<Partial<AdminApiError>>({
          name: "AdminApiError",
          status,
        }),
      );
    },
  );

  it("rejects an HTTP 401 queue read as an access error rather than an empty queue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401)));

    await expect(fetchAdminDisputes()).rejects.toEqual(
      expect.objectContaining<Partial<AdminApiError>>({
        name: "AdminApiError",
        status: 401,
      }),
    );
  });
});

// These assertions are intentionally compile-time-only. They are not runtime payload validation.
const missingRequiredDisputeCandidate = (() => {
  const { title: _requiredTitle, ...withoutRequiredTitle } = clientDisputeDocument;
  return withoutRequiredTitle;
})();
// @ts-expect-error C03 contract guard: generated disputes require a title.
const missingRequiredDispute: TConvexDoc<"disputes"> = missingRequiredDisputeCandidate;

const wrongTableIdDisputeCandidate = {
  ...clientDisputeDocument,
  jobId: caseAttachmentId,
};
// @ts-expect-error C03 contract guard: a jobId cannot carry an attachments ID.
const wrongTableIdDispute: TConvexDoc<"disputes"> = wrongTableIdDisputeCandidate;

const invalidStatusDisputeCandidate = {
  ...clientDisputeDocument,
  status: "awaiting_admin_review",
};
// @ts-expect-error C03 contract guard: status must use the generated eight-value vocabulary.
const invalidStatusDispute: TConvexDoc<"disputes"> = invalidStatusDisputeCandidate;

const incorrectEnvelopeCandidate = { data: queueResponse };
// @ts-expect-error C03 contract guard: the admin queue envelope is exactly { disputes }.
const incorrectEnvelope: IAdminDisputesResponse = incorrectEnvelopeCandidate;

// @ts-expect-error C03 contract guard: admin queue reads never return null.
const unsupportedNullQueue: TAdminDisputeQueueQueryResult = null;
// @ts-expect-error C03 contract guard: admin detail reads never return null.
const unsupportedNullDetail: TAdminDisputeDetailQueryResult = null;

void missingRequiredDispute;
void wrongTableIdDispute;
void invalidStatusDispute;
void incorrectEnvelope;
void unsupportedNullQueue;
void unsupportedNullDetail;
