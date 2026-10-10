// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TParticipantDisputeTimelineQueryResult } from "../types";
import type { TConvexId } from "@repo/convex-client";

type TTimelineEvent = TParticipantDisputeTimelineQueryResult[number];
type TTimelineAttachment = NonNullable<TTimelineEvent["attachments"]>[number];
type TQueryState =
  | { kind: "result"; value: TParticipantDisputeTimelineQueryResult }
  | { kind: "error"; error: Error };

const { queryFixtures, queryCalls } = vi.hoisted(() => ({
  queryFixtures: new Map<string, TQueryState>(),
  queryCalls: [] as unknown[][],
}));

function queryKey(name: string, args: unknown): string {
  return `${name}:${JSON.stringify(args)}`;
}

function setQueryResult(
  name: string,
  args: unknown,
  value: TParticipantDisputeTimelineQueryResult,
): void {
  queryFixtures.set(queryKey(name, args), { kind: "result", value });
}

function setQueryError(name: string, args: unknown, error: Error): void {
  queryFixtures.set(queryKey(name, args), { kind: "error", error });
}

function convexId<TTable extends "attachments" | "disputeEvents" | "disputes">(
  value: string,
): TConvexId<TTable> {
  return value as TConvexId<TTable>;
}

const disputeId = convexId<"disputes">("dispute-1");
const attachment = {
  _id: convexId<"attachments">("attachment-1"),
  _creationTime: 1,
  type: "pdf",
  name: "invoice.pdf",
  uploadedByWallet: "GCLIENT",
  uploadedByWalletType: "external_wallet",
  ownerRole: "client",
  parentType: "dispute",
  parentId: "dispute-1",
  visibility: "participants",
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  url: "https://example.test/attachments/attachment-1",
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
} satisfies TTimelineAttachment;

function createEvent(
  index: number,
  input: Pick<
    TTimelineEvent,
    "type" | "actorWallet" | "actorWalletType" | "actorRole" | "message"
  > &
    Partial<
      Pick<
        TTimelineEvent,
        "attachmentIds" | "attachments" | "oldStatus" | "newStatus" | "transactionHash"
      >
    >,
  eventDisputeId: TConvexId<"disputes"> = disputeId,
): TTimelineEvent {
  return {
    _id: convexId<"disputeEvents">(`event-${index}`),
    _creationTime: index,
    disputeId: eventDisputeId,
    type: input.type,
    actorWallet: input.actorWallet,
    actorWalletType: input.actorWalletType,
    actorRole: input.actorRole,
    message: input.message,
    attachmentIds: input.attachmentIds ?? [],
    attachments: input.attachments ?? [],
    createdAt: index,
    ...(input.oldStatus !== undefined ? { oldStatus: input.oldStatus } : {}),
    ...(input.newStatus !== undefined ? { newStatus: input.newStatus } : {}),
    ...(input.transactionHash !== undefined ? { transactionHash: input.transactionHash } : {}),
  };
}

const events: TParticipantDisputeTimelineQueryResult = [
  createEvent(1, {
    type: "dispute_opened",
    actorWallet: "GCLIENT",
    actorWalletType: "external_wallet",
    actorRole: "client",
    message: "The client opened a dispute.",
    attachmentIds: [convexId<"attachments">("attachment-1")],
    attachments: [attachment],
  }),
  createEvent(2, {
    type: "evidence_added",
    actorWallet: "GCLIENT",
    actorWalletType: "external_wallet",
    actorRole: "client",
    message: "Client evidence added.",
  }),
  createEvent(3, {
    type: "on_chain_mark_started",
    actorWallet: "system",
    actorWalletType: "system",
    actorRole: "system",
    message: "Escrow marking started.",
  }),
  createEvent(4, {
    type: "on_chain_mark_succeeded",
    actorWallet: "system",
    actorWalletType: "system",
    actorRole: "system",
    message: "Escrow marked disputed.",
    transactionHash: "tx-marked",
  }),
  createEvent(5, {
    type: "on_chain_mark_failed",
    actorWallet: "system",
    actorWalletType: "system",
    actorRole: "system",
    message: "Escrow marking failed.",
    transactionHash: "tx-failed",
  }),
  createEvent(6, {
    type: "status_changed",
    actorWallet: "GADMIN",
    actorWalletType: "external_wallet",
    actorRole: "moderator",
    message: "Review started.",
    oldStatus: "open",
    newStatus: "under_review",
  }),
  createEvent(7, {
    type: "client_response_added",
    actorWallet: "GCLIENT",
    actorWalletType: "external_wallet",
    actorRole: "client",
    message: "Client response added.",
  }),
  createEvent(8, {
    type: "freelancer_response_added",
    actorWallet: "GFREELANCER",
    actorWalletType: "external_wallet",
    actorRole: "freelancer",
    message: "Freelancer response added.",
  }),
  createEvent(9, {
    type: "moderator_note_added",
    actorWallet: "GADMIN",
    actorWalletType: "external_wallet",
    actorRole: "moderator",
    message: "Moderator note added.",
  }),
  createEvent(10, {
    type: "resolution_proposed",
    actorWallet: "GADMIN",
    actorWalletType: "external_wallet",
    actorRole: "moderator",
    message: "Resolution proposed.",
    newStatus: "awaiting_client_response",
  }),
  createEvent(11, {
    type: "resolved_client",
    actorWallet: "GADMIN",
    actorWalletType: "external_wallet",
    actorRole: "moderator",
    message: "Resolved for client.",
  }),
  createEvent(12, {
    type: "resolved_freelancer",
    actorWallet: "GADMIN",
    actorWalletType: "external_wallet",
    actorRole: "moderator",
    message: "Resolved for freelancer.",
  }),
  createEvent(13, {
    type: "split_resolution",
    actorWallet: "GADMIN",
    actorWalletType: "external_wallet",
    actorRole: "moderator",
    message: "Split resolution recorded.",
  }),
  createEvent(14, {
    type: "cancelled",
    actorWallet: "system",
    actorWalletType: "system",
    actorRole: "system",
    message: "Dispute cancelled.",
  }),
];

const eventLabels = {
  dispute_opened: "Dispute opened",
  evidence_added: "Evidence added",
  on_chain_mark_started: "On-chain marking started",
  on_chain_mark_succeeded: "Escrow marked disputed",
  on_chain_mark_failed: "On-chain marking failed",
  status_changed: "Status changed",
  client_response_added: "Client response added",
  freelancer_response_added: "Freelancer response added",
  moderator_note_added: "Dispute admin note added",
  resolution_proposed: "Resolution proposed",
  resolved_client: "Resolved for client",
  resolved_freelancer: "Resolved for freelancer",
  split_resolution: "Split resolution",
  cancelled: "Dispute cancelled",
} satisfies Record<TTimelineEvent["type"], string>;

vi.mock("@repo/convex-client", () => ({
  api: { disputes: { getDisputeTimeline: "timeline" } },
}));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    queryCalls.push(args);
    const state = queryFixtures.get(queryKey(args[0] as string, args[1]));
    if (!state) return undefined;
    if (state.kind === "error") throw state.error;
    return state.value;
  },
}));
vi.mock("@/core/stellar/explorer", () => ({
  getTxExplorerUrl: (transactionHash: string) => `https://explorer.test/tx/${transactionHash}`,
}));
vi.mock("@/features/attachments/components", () => ({
  AttachmentList: ({ attachments }: { attachments: unknown[] }) =>
    createElement("span", null, `${attachments.length} attachment`),
}));

import { DisputeTimeline, ParticipantDisputeTimeline } from "./dispute-timeline";

describe("participant dispute timeline", () => {
  afterEach(() => {
    cleanup();
    queryFixtures.clear();
    queryCalls.length = 0;
    vi.restoreAllMocks();
  });

  it("shows loading and empty states separately", () => {
    const view = render(createElement(DisputeTimeline, { events: undefined }));
    expect(screen.getByRole("status").textContent).toContain("Loading timeline");
    view.rerender(createElement(DisputeTimeline, { events: [] }));
    expect(screen.getByText("No dispute timeline events yet.")).toBeTruthy();
  });

  it("renders every Convex event type, actor role, transition, attachment, and transaction link", () => {
    setQueryResult("timeline", { disputeId, viewerWallet: "GCLIENT" }, events);
    render(createElement(ParticipantDisputeTimeline, { disputeId, viewerWallet: "GCLIENT" }));

    expect(queryCalls[0]).toEqual([
      "timeline",
      { disputeId: "dispute-1", viewerWallet: "GCLIENT" },
    ]);
    for (const event of events) {
      expect(screen.getByText(eventLabels[event.type])).toBeTruthy();
      expect(screen.getByText(event.message)).toBeTruthy();
    }
    expect(screen.getAllByText(/Client.*GCLIENT/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Freelancer.*GFREELANCER/)).toBeTruthy();
    expect(screen.getAllByText(/Dispute admin.*GADMIN/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("System")).toHaveLength(4);
    expect(screen.getByText(/Status: Open.*Under Review/)).toBeTruthy();
    expect(screen.getByText("Status: Awaiting Client")).toBeTruthy();
    expect(screen.getByText("1 attachment")).toBeTruthy();
    expect(screen.getByRole("link", { name: "tx-marked" }).getAttribute("href")).toBe(
      "https://explorer.test/tx/tx-marked",
    );
    expect(screen.getByRole("link", { name: "tx-failed" }).getAttribute("href")).toBe(
      "https://explorer.test/tx/tx-failed",
    );
  });

  it("keeps repeated timeline failures recoverable without exposing backend errors", () => {
    const rawError = new Error("sensitive Convex timeline details");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setQueryError("timeline", { disputeId, viewerWallet: "GCLIENT" }, rawError);
    const view = render(
      createElement(ParticipantDisputeTimeline, { disputeId, viewerWallet: "GCLIENT" }),
    );
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the dispute timeline");
    expect(screen.queryByText(rawError.message)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry timeline" }));
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the dispute timeline");
    expect(screen.queryByText(rawError.message)).toBeNull();

    setQueryResult("timeline", { disputeId, viewerWallet: "GCLIENT" }, events.slice(0, 1));
    fireEvent.click(screen.getByRole("button", { name: "Retry timeline" }));
    expect(screen.getByText("The client opened a dispute.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(queryCalls.at(-1)).toEqual([
      "timeline",
      { disputeId: "dispute-1", viewerWallet: "GCLIENT" },
    ]);
    view.unmount();
    consoleSpy.mockRestore();
  });

  it("resets timeline errors for wallet and dispute changes and replaces previous events", () => {
    const rawError = new Error("sensitive wallet-scoped timeline details");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setQueryError("timeline", { disputeId, viewerWallet: "GCLIENT" }, rawError);
    const view = render(
      createElement(ParticipantDisputeTimeline, { disputeId, viewerWallet: "GCLIENT" }),
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    const freelancerDisputeId = convexId<"disputes">("dispute-1");
    const freelancerEvents = [
      createEvent(
        20,
        {
          type: "freelancer_response_added",
          actorWallet: "GFREELANCER",
          actorWalletType: "external_wallet",
          actorRole: "freelancer",
          message: "Freelancer wallet timeline event.",
        },
        freelancerDisputeId,
      ),
    ];
    setQueryResult(
      "timeline",
      { disputeId: freelancerDisputeId, viewerWallet: "GFREELANCER" },
      freelancerEvents,
    );
    view.rerender(
      createElement(ParticipantDisputeTimeline, {
        disputeId: freelancerDisputeId,
        viewerWallet: "GFREELANCER",
      }),
    );
    expect(screen.getByText("Freelancer wallet timeline event.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(rawError.message)).toBeNull();

    const secondDisputeId = convexId<"disputes">("dispute-2");
    const secondDisputeEvents = [
      createEvent(
        21,
        {
          type: "status_changed",
          actorWallet: "GADMIN",
          actorWalletType: "external_wallet",
          actorRole: "moderator",
          message: "Second dispute timeline event.",
        },
        secondDisputeId,
      ),
    ];
    setQueryResult(
      "timeline",
      { disputeId: secondDisputeId, viewerWallet: "GFREELANCER" },
      secondDisputeEvents,
    );
    view.rerender(
      createElement(ParticipantDisputeTimeline, {
        disputeId: secondDisputeId,
        viewerWallet: "GFREELANCER",
      }),
    );
    expect(screen.getByText("Second dispute timeline event.")).toBeTruthy();
    expect(screen.queryByText("Freelancer wallet timeline event.")).toBeNull();
    expect(queryCalls.at(-1)).toEqual([
      "timeline",
      { disputeId: "dispute-2", viewerWallet: "GFREELANCER" },
    ]);
    view.unmount();
    consoleSpy.mockRestore();
  });
});
