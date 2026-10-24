"use client";

import { getTxExplorerUrl } from "@/core/stellar/explorer";
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
    <li className="relative border-l pb-5 pl-5 last:pb-0">
      <span
        className="absolute top-1.5 -left-[4.5px] h-2 w-2 rounded-full border-2 border-background bg-zinc-400"
        aria-hidden="true"
      />
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="hr-text-primary text-sm font-medium">{EVENT_LABELS[event.type]}</p>
          <p className="hr-text-muted text-xs">{formatDisputeDate(event.createdAt)}</p>
        </div>
        <p className="hr-text-muted mt-0.5 text-xs break-all">
          {ACTOR_LABELS[event.actorRole]}
          {event.actorRole !== "system" ? ` · ${event.actorWallet}` : null}
        </p>
        <p className="hr-text-primary mt-1.5 text-sm whitespace-pre-wrap">{event.message}</p>
        {event.newStatus ? (
          <p className="hr-text-secondary mt-1.5 text-sm">
            {event.oldStatus
              ? `Status: ${getDisputeStatusLabel(event.oldStatus)} → ${getDisputeStatusLabel(event.newStatus)}`
              : `Status: ${getDisputeStatusLabel(event.newStatus)}`}
          </p>
        ) : null}
        {event.transactionHash ? (
          <p className="hr-text-secondary mt-1.5 font-mono text-xs break-all">
            tx:{" "}
            <a
              href={getTxExplorerUrl(event.transactionHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {event.transactionHash}
            </a>
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
      <p className="hr-text-secondary text-sm" role="status">
        Loading timeline...
      </p>
    );
  }

  if (events.length === 0) {
    return <p className="hr-text-secondary text-sm">No dispute timeline events yet.</p>;
  }

  return (
    <ol aria-label="Dispute evidence timeline">
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
          className="border-l-2 border-red-500 bg-red-50/60 py-2.5 pl-3 text-sm text-red-800"
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
