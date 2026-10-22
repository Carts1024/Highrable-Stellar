import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminApiError,
  fetchAdminDispute,
  fetchAdminDisputes,
  fetchAdminSession,
  isAdminConsistencyError,
  isAdminNetworkError,
  postAdminResolution,
  shouldRetryAdminRead,
} from "./admin-api";

const validAdminWallet = `G${"A".repeat(55)}`;

const consistentDetail = {
  dispute: {
    _id: "requested-dispute",
    parentType: "micro_gig",
    parentId: "job-1",
    jobId: "job-1",
    microGigId: "job-1",
    escrowId: "escrow-1",
    onChainEscrowId: "chain-1",
  },
  job: { _id: "job-1", jobType: "micro_gig" },
  milestone: null,
  escrow: { _id: "escrow-1", jobId: "job-1", escrowId: "chain-1" },
  timeline: [],
  assignmentEvents: [],
  settlementAttempts: [],
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("admin API client errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([401, 403, 404, 500])("preserves HTTP status %s", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "request failed" }, status)),
    );

    await expect(fetchAdminSession()).rejects.toEqual(
      expect.objectContaining<Partial<AdminApiError>>({
        name: "AdminApiError",
        status,
        message: "request failed",
      }),
    );
  });

  it("keeps a structured response body on the typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: "Dispute not found.", details: { code: "NOT_FOUND" } }, 404),
        ),
    );

    await expect(fetchAdminSession()).rejects.toMatchObject({
      status: 404,
      details: { code: "NOT_FOUND" },
    });
  });

  it("normalizes network failures into the admin error boundary type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await fetchAdminSession().catch((nextError: unknown) => nextError);

    expect(isAdminNetworkError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 0,
      message: "Could not reach the admin API. Check your connection and retry.",
    });
  });

  it.each([
    { isOwner: true, isDisputeAdmin: false },
    { isOwner: false, isDisputeAdmin: true },
  ])("accepts a valid owner/dispute-admin session response", async (capabilities) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            adminWallet: validAdminWallet,
            ...capabilities,
            futureField: "preserved for compatibility",
          },
          200,
        ),
      ),
    );

    await expect(fetchAdminSession()).resolves.toMatchObject({
      adminWallet: validAdminWallet,
      ...capabilities,
      futureField: "preserved for compatibility",
    });
  });

  it.each([
    {},
    { adminWallet: validAdminWallet, isOwner: true },
    { adminWallet: "not-a-stellar-wallet", isOwner: true, isDisputeAdmin: false },
    null,
    [],
    { adminWallet: validAdminWallet, isOwner: "true", isDisputeAdmin: false },
    { adminWallet: validAdminWallet, isOwner: 1, isDisputeAdmin: false },
    { adminWallet: validAdminWallet, isOwner: false, isDisputeAdmin: "false" },
    { adminWallet: validAdminWallet, isOwner: false, isDisputeAdmin: 0 },
  ])("rejects malformed successful session payloads", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload, 200)));

    const error = await fetchAdminSession().catch((nextError: unknown) => nextError);

    expect(error).toMatchObject({
      name: "AdminApiError",
      status: 200,
      message: "Admin API returned an invalid session response.",
      details: undefined,
    });
    expect(JSON.stringify(error)).not.toContain(JSON.stringify(payload));
  });

  it.each([
    [0, new AdminApiError(0, "network"), true],
    [1, new AdminApiError(0, "network"), true],
    [2, new AdminApiError(0, "network"), false],
    [0, new AdminApiError(500, "server"), true],
    [1, new AdminApiError(500, "server"), true],
    [2, new AdminApiError(500, "server"), false],
    [0, new AdminApiError(400, "invalid"), false],
    [0, new AdminApiError(401, "unauthorized"), false],
    [0, new AdminApiError(403, "forbidden"), false],
    [0, new AdminApiError(404, "missing"), false],
    [0, new AdminApiError(200, "invalid session"), false],
  ] as const)("retries only network/5xx reads at most twice", (failureCount, error, expected) => {
    expect(shouldRetryAdminRead(failureCount, error)).toBe(expected);
  });

  it("serializes only typed dispute filters and the bounded queue limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ disputes: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAdminDisputes({
      status: "under_review",
      onChainStatus: "mark_failed",
      limit: 120,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/disputes?status=under_review&onChainStatus=mark_failed&limit=120",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it.each([
    [
      "wrong case identity",
      {
        ...consistentDetail,
        dispute: { ...consistentDetail.dispute, _id: "other-dispute" },
      },
    ],
    [
      "declared parent reference",
      {
        ...consistentDetail,
        dispute: { ...consistentDetail.dispute, jobId: "other-job" },
      },
    ],
    [
      "returned escrow relationship",
      {
        ...consistentDetail,
        escrow: { ...consistentDetail.escrow, jobId: "other-job" },
      },
    ],
    [
      "returned on-chain escrow reference",
      {
        ...consistentDetail,
        escrow: { ...consistentDetail.escrow, escrowId: "other-chain-escrow" },
      },
    ],
    [
      "linked milestone/escrow relationship",
      {
        ...consistentDetail,
        dispute: {
          ...consistentDetail.dispute,
          parentType: "milestone",
          parentId: "milestone-1",
          microGigId: undefined,
          milestoneId: "milestone-1",
        },
        job: { ...consistentDetail.job, jobType: "milestone_project" },
        milestone: { _id: "milestone-1", jobId: "job-1", escrowId: "chain-1" },
        escrow: { ...consistentDetail.escrow, milestoneId: "other-milestone" },
      },
    ],
  ] as const)("rejects %s without exposing protected payload details", async (_reason, payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload, 200)));

    const error = await fetchAdminDispute("requested-dispute").catch(
      (nextError: unknown) => nextError,
    );

    expect(isAdminConsistencyError(error)).toBe(true);
    expect(error).toMatchObject({
      name: "AdminApiError",
      status: 409,
      message: "Admin API returned an inconsistent dispute detail.",
      details: undefined,
    });
    expect(shouldRetryAdminRead(0, error)).toBe(false);
    expect(JSON.stringify(error)).not.toContain("other");
  });

  it("preserves nullable parent records and absent optional references", async () => {
    const nullableDetail = {
      ...consistentDetail,
      dispute: {
        _id: consistentDetail.dispute._id,
        parentType: consistentDetail.dispute.parentType,
        parentId: consistentDetail.dispute.parentId,
      },
      job: null,
      milestone: null,
      escrow: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(nullableDetail, 200)));

    await expect(fetchAdminDispute("requested-dispute")).resolves.toEqual(nullableDetail);
  });

  it.each([
    [202, { status: "pending", result: { status: "submission_unknown" } }, "pending"],
    [
      200,
      {
        status: "succeeded",
        result: {
          status: "resolved_client",
          freelancerShareBps: 0,
          freelancerPayoutAmount: 0.25,
          clientRefundAmount: 99.75,
          resolutionTxHash: "a".repeat(64),
          resolutionStellarExpertUrl:
            "https://stellar.expert/explorer/testnet/tx/" + "a".repeat(64),
        },
      },
      "succeeded",
    ],
    [200, { status: "failed", result: true }, "failed"],
  ] as const)("returns the recognized settlement outcome %s", async (status, body, outcome) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, status)));

    await expect(
      postAdminResolution("dispute-1", { phase: "reconcile", operationId: "operation-123" }),
    ).resolves.toMatchObject({ status: outcome });
  });

  it("preserves a recovered attempt that was closed before Stellar submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ status: "failed", result: true, failureKind: "not_submitted" }, 200),
        ),
    );

    await expect(
      postAdminResolution("dispute-1", {
        phase: "reconcile",
        operationId: "operation-123",
      }),
    ).resolves.toMatchObject({ status: "failed", failureKind: "not_submitted" });
  });

  it("rejects an unknown settlement failure kind", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ status: "failed", result: true, failureKind: "unknown" }, 200),
        ),
    );

    await expect(
      postAdminResolution("dispute-1", {
        phase: "reconcile",
        operationId: "operation-123",
      }),
    ).rejects.toThrow("unrecognized settlement outcome");
  });

  it.each([
    ["fixed client terms", { status: "resolved_client", freelancerShareBps: 1 }],
    ["fixed freelancer terms", { status: "resolved_freelancer", freelancerShareBps: 9_999 }],
    ["split lower bound", { status: "split_resolution", freelancerShareBps: 0 }],
    ["split upper bound", { status: "split_resolution", freelancerShareBps: 10_000 }],
    ["split fractional terms", { status: "split_resolution", freelancerShareBps: 1.5 }],
    ["negative payout", { freelancerPayoutAmount: -1 }],
    ["infinite refund", { clientRefundAmount: Number.POSITIVE_INFINITY }],
    ["short transaction hash", { resolutionTxHash: "a".repeat(63) }],
    ["unsafe explorer URL", { resolutionStellarExpertUrl: "javascript:alert(1)" }],
  ] as const)("rejects malformed successful result: %s", async (_label, override) => {
    const result = {
      status: "resolved_client" as const,
      freelancerShareBps: 0,
      freelancerPayoutAmount: 0,
      clientRefundAmount: 100,
      resolutionTxHash: "b".repeat(64),
      resolutionStellarExpertUrl: "https://stellar.expert/explorer/testnet/tx/" + "b".repeat(64),
      ...override,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "succeeded", result }, 200)),
    );

    await expect(
      postAdminResolution("dispute-1", { phase: "succeeded", operationId: "operation-123" }),
    ).rejects.toMatchObject({
      name: "AdminApiError",
      status: 200,
      message: "Admin API returned an unrecognized settlement outcome.",
    });
  });

  it("preserves validated returned settlement amounts and links", async () => {
    const result = {
      status: "split_resolution" as const,
      freelancerShareBps: 4_321,
      freelancerPayoutAmount: 123.45,
      clientRefundAmount: 876.55,
      resolutionTxHash: "c".repeat(64),
      resolutionStellarExpertUrl: "https://stellar.expert/explorer/testnet/tx/" + "c".repeat(64),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ status: "succeeded", result }, 200)),
    );

    await expect(
      postAdminResolution("dispute-1", { phase: "reconcile", operationId: "operation-123" }),
    ).resolves.toEqual({ status: "succeeded", result });
  });

  it("rejects a successful HTTP response that does not identify a settlement outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true }, 200)));

    await expect(
      postAdminResolution("dispute-1", { phase: "succeeded", operationId: "operation-123" }),
    ).rejects.toMatchObject({
      name: "AdminApiError",
      message: "Admin API returned an unrecognized settlement outcome.",
    });
  });

  it("accepts started and signed acknowledgments only when they match the request", async () => {
    const operationId = "resolve_dispute:case-1:operation-1";
    const transactionHash = "a".repeat(64);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              success: true,
              phase: "started",
              result: { operationId, freelancerShareBps: 4321 },
            },
            200,
          ),
        )
        .mockResolvedValueOnce(
          jsonResponse(
            {
              success: true,
              phase: "signed",
              result: { operationId, transactionHash: transactionHash.toUpperCase() },
            },
            200,
          ),
        ),
    );

    await expect(
      postAdminResolution("case-1", {
        phase: "started",
        status: "split_resolution",
        freelancerShareBps: 4321,
        operationId,
      }),
    ).resolves.toMatchObject({ phase: "started" });
    await expect(
      postAdminResolution("case-1", {
        phase: "signed",
        operationId,
        transactionHash,
        transactionValidUntil: 123,
      }),
    ).resolves.toMatchObject({ phase: "signed" });
  });

  it.each([
    [
      "started operation ID",
      { phase: "started", result: { operationId: "other", freelancerShareBps: 4321 } },
      {
        phase: "started",
        status: "split_resolution",
        freelancerShareBps: 4321,
        operationId: "resolve_dispute:case-1:operation-1",
      },
    ],
    [
      "started basis points",
      {
        phase: "started",
        result: { operationId: "resolve_dispute:case-1:operation-1", freelancerShareBps: 4322 },
      },
      {
        phase: "started",
        status: "split_resolution",
        freelancerShareBps: 4321,
        operationId: "resolve_dispute:case-1:operation-1",
      },
    ],
    [
      "signed operation ID",
      { phase: "signed", result: { operationId: "other", transactionHash: "a".repeat(64) } },
      {
        phase: "signed",
        operationId: "resolve_dispute:case-1:operation-1",
        transactionHash: "a".repeat(64),
        transactionValidUntil: 123,
      },
    ],
    [
      "signed transaction hash",
      {
        phase: "signed",
        result: {
          operationId: "resolve_dispute:case-1:operation-1",
          transactionHash: "b".repeat(64),
        },
      },
      {
        phase: "signed",
        operationId: "resolve_dispute:case-1:operation-1",
        transactionHash: "a".repeat(64),
        transactionValidUntil: 123,
      },
    ],
  ] as const)("rejects mismatched %s acknowledgments", async (_caseName, body, request) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, ...body }, 200)),
    );

    await expect(postAdminResolution("case-1", request)).rejects.toMatchObject({
      name: "AdminApiError",
      message: expect.stringContaining("acknowledgment"),
    });
  });

  it.each([
    ["started", { success: true, phase: "started", result: {} }],
    ["started", { success: true, phase: "started", result: { operationId: "op" } }],
    ["signed", { success: true, phase: "signed", result: {} }],
    ["signed", { success: true, phase: "signed", result: { operationId: "op" } }],
  ] as const)("rejects malformed %s acknowledgments", async (phase, body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, 200)));

    const request =
      phase === "started"
        ? {
            phase,
            status: "resolved_client" as const,
            freelancerShareBps: 0,
            operationId: "op",
          }
        : {
            phase,
            operationId: "op",
            transactionHash: "a".repeat(64),
            transactionValidUntil: 123,
          };

    await expect(postAdminResolution("case-1", request)).rejects.toMatchObject({
      name: "AdminApiError",
      message: expect.stringContaining("acknowledgment"),
    });
  });
});
