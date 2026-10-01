"use client";

import { AttachmentList } from "@/features/attachments/components";
import { api } from "@repo/convex-client";
import { useQuery } from "convex/react";
import React, { Component } from "react";

import type { TParticipantDisputeTimelineQueryResult } from "../types";
import type { TConvexId } from "@repo/convex-client";
import type { ReactNode } from "react";

import { formatDisputeDate, getDisputeStatusLabel } from "../lib";

type TTimelineEvent = TParticipantDisputeTimelineQueryResult[number];

const EVENT_LABELS = {
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
} as const satisfies Record<TTimelineEvent["type"], string>;

const ACTOR_LABELS = {
  client: "Client",
  freelancer: "Freelancer",
  moderator: "Dispute admin",
  system: "System",
} as const satisfies Record<TTimelineEvent["actorRole"], string>;

export function DisputeTimelineItem({ event }: { readonly event: TTimelineEvent }) {
  return (
    <li className="border-l border-[#d8d8d8] pl-4">
      <div className="rounded-lg border border-[#e8e8e8] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs text-[#5f5f5f] uppercase">{EVENT_LABELS[event.type]}</p>
          <p className="font-mono text-xs text-[#7f7f7f]">{formatDisputeDate(event.createdAt)}</p>
        </div>
        <p className="mt-2 text-sm text-[#0a0a0a]">{event.message}</p>
        <p className="mt-2 font-mono text-xs text-[#5f5f5f]">
          {ACTOR_LABELS[event.actorRole]}
          {event.actorRole !== "system" ? ` · ${event.actorWallet}` : null}
        </p>
        {event.newStatus ? (
          <p className="mt-2 text-sm text-[#3f3f3f]">
            {event.oldStatus
              ? `Status: ${getDisputeStatusLabel(event.oldStatus)} → ${getDisputeStatusLabel(event.newStatus)}`
              : `Status: ${getDisputeStatusLabel(event.newStatus)}`}
          </p>
        ) : null}
        {event.transactionHash ? (
          <p className="mt-2 font-mono text-xs break-all text-[#5f5f5f]">
            tx: {event.transactionHash}
          </p>
        ) : null}
        {event.attachments && event.attachments.length > 0 ? (
          <div className="mt-3">
            <AttachmentList attachments={event.attachments} readOnly />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function DisputeTimeline({
  events,
  isLoading,
}: {
  readonly events: TParticipantDisputeTimelineQueryResult | undefined;
  readonly isLoading?: boolean;
}) {
  if (isLoading || events === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm" role="status">
        Loading timeline...
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
        No dispute timeline events yet.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <DisputeTimelineItem key={event._id} event={event} />
      ))}
    </ol>
  );
}

interface ITimelineErrorBoundaryProps {
  readonly children: (retryKey: number) => ReactNode;
}

interface ITimelineErrorBoundaryState {
  readonly hasError: boolean;
  readonly retryKey: number;
}

class TimelineErrorBoundary extends Component<
  ITimelineErrorBoundaryProps,
  ITimelineErrorBoundaryState
> {
  state: ITimelineErrorBoundaryState = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<ITimelineErrorBoundaryState> {
    return { hasError: true };
  }

  private retry = () => {
    this.setState(({ retryKey }) => ({ hasError: false, retryKey: retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <p>Unable to load the dispute timeline.</p>
          <button type="button" className="mt-2 underline" onClick={this.retry}>
            Retry timeline
          </button>
        </div>
      );
    }

    return this.props.children(this.state.retryKey);
  }
}

function TimelineQuery({
  disputeId,
  viewerWallet,
}: {
  readonly disputeId: TConvexId<"disputes">;
  readonly viewerWallet: string;
}) {
  const events = useQuery(api.disputes.getDisputeTimeline, { disputeId, viewerWallet });
  return <DisputeTimeline events={events} />;
}

export function ParticipantDisputeTimeline({
  disputeId,
  viewerWallet,
}: {
  readonly disputeId: TConvexId<"disputes">;
  readonly viewerWallet: string;
}) {
  return (
    <TimelineErrorBoundary key={`${disputeId}:${viewerWallet}`}>
      {(retryKey) => (
        <TimelineQuery key={retryKey} disputeId={disputeId} viewerWallet={viewerWallet} />
      )}
    </TimelineErrorBoundary>
  );
}
