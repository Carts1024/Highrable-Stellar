"use client";

import { AttachmentList } from "@/features/attachments/components";

import type { TConvexDoc } from "@repo/convex-client";

import { formatDisputeDate } from "../lib";

type TTimelineEvent = TConvexDoc<"disputeEvents"> & {
  attachments?: Array<TConvexDoc<"attachments"> & { url?: string | null }>;
};

export function DisputeTimelineItem({ event }: { readonly event: TTimelineEvent }) {
  return (
    <li className="border-l border-[#d8d8d8] pl-4">
      <div className="rounded-lg border border-[#e8e8e8] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs text-[#5f5f5f] uppercase">{event.type}</p>
          <p className="font-mono text-xs text-[#7f7f7f]">{formatDisputeDate(event.createdAt)}</p>
        </div>
        <p className="mt-2 text-sm text-[#0a0a0a]">{event.message}</p>
        <p className="mt-2 font-mono text-xs text-[#5f5f5f]">
          {event.actorRole} · {event.actorWalletType} · {event.actorWallet}
        </p>
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
  readonly events: TTimelineEvent[] | undefined;
  readonly isLoading?: boolean;
}) {
  if (isLoading || events === undefined) {
    return (
      <p className="rounded-lg border border-[#e8e8e8] bg-white p-4 text-sm">Loading timeline...</p>
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
