// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TParticipantDisputeTimelineQueryResult } from "../types";
import type { TConvexId } from "@repo/convex-client";

const { timelineState, queryCalls } = vi.hoisted(() => ({
  timelineState: { events: undefined as unknown, error: false },
  queryCalls: [] as unknown[][],
}));

vi.mock("@repo/convex-client", () => ({
  api: { disputes: { getDisputeTimeline: "timeline" } },
}));
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    queryCalls.push(args);
    if (timelineState.error) throw new Error("Convex timeline read failed");
    return timelineState.events;
  },
}));
vi.mock("@/features/attachments/components", () => ({
  AttachmentList: ({ attachments }: { attachments: unknown[] }) =>
    createElement("span", null, `${attachments.length} attachment`),
}));

import { DisputeTimeline, ParticipantDisputeTimeline } from "./dispute-timeline";

const disputeId = "dispute-1" as TConvexId<"disputes">;
const events = [
  {
    _id: "event-1",
    type: "dispute_opened",
    actorRole: "client",
    actorWallet: "GCLIENT",
    actorWalletType: "external_wallet",
    message: "The client opened a dispute.",
    createdAt: 1,
    attachmentIds: [],
    attachments: [{ _id: "attachment-1", url: null }],
  },
  {
    _id: "event-2",
    type: "status_changed",
    actorRole: "moderator",
    actorWallet: "GADMIN",
    actorWalletType: "external_wallet",
    message: "Review started.",
    oldStatus: "open",
    newStatus: "under_review",
    createdAt: 2,
    attachmentIds: [],
    attachments: [],
  },
  {
    _id: "event-3",
    type: "on_chain_mark_succeeded",
    actorRole: "system",
    actorWallet: "system",
    actorWalletType: "system",
    message: "Escrow marked disputed.",
    createdAt: 3,
    transactionHash: "tx-123",
    attachmentIds: [],
    attachments: [],
  },
] as unknown as TParticipantDisputeTimelineQueryResult;

describe("participant dispute timeline", () => {
  afterEach(() => {
    cleanup();
    timelineState.events = undefined;
    timelineState.error = false;
    queryCalls.length = 0;
  });

  it("shows loading and empty states separately", () => {
    const view = render(createElement(DisputeTimeline, { events: undefined }));
    expect(screen.getByRole("status").textContent).toContain("Loading timeline");
    view.rerender(createElement(DisputeTimeline, { events: [] }));
    expect(screen.getByText("No dispute timeline events yet.")).toBeTruthy();
  });

  it("renders Convex events with readable actors, transitions, and evidence", () => {
    timelineState.events = events;
    render(createElement(ParticipantDisputeTimeline, { disputeId, viewerWallet: "GCLIENT" }));
    expect(queryCalls[0]).toEqual([
      "timeline",
      { disputeId: "dispute-1", viewerWallet: "GCLIENT" },
    ]);
    expect(screen.getByText("Dispute opened")).toBeTruthy();
    expect(screen.getByText("Client · GCLIENT")).toBeTruthy();
    expect(screen.getByText("Dispute admin · GADMIN")).toBeTruthy();
    expect(screen.getByText("Status: Open → Under Review")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByText("1 attachment")).toBeTruthy();
  });

  it("keeps a failed timeline read visible and retries the same wallet-scoped query", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    timelineState.error = true;
    const view = render(
      createElement(ParticipantDisputeTimeline, { disputeId, viewerWallet: "GCLIENT" }),
    );
    expect(screen.getByRole("alert").textContent).toContain("Unable to load the dispute timeline");
    timelineState.error = false;
    timelineState.events = [];
    fireEvent.click(screen.getByRole("button", { name: "Retry timeline" }));
    expect(screen.getByText("No dispute timeline events yet.")).toBeTruthy();
    expect(queryCalls.at(-1)).toEqual([
      "timeline",
      { disputeId: "dispute-1", viewerWallet: "GCLIENT" },
    ]);
    view.unmount();
    consoleSpy.mockRestore();
  });
});
