"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import React from "react";

function formatNotificationTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DeadlineNotificationsPanel() {
  const walletIdentity = useHighrableWalletIdentity();
  const walletAddress = walletIdentity.walletAddress;
  const notifications = useQuery(
    api.deadlines.getNotificationsForWallet,
    walletAddress ? { walletAddress } : "skip",
  );
  const unreadCount = useQuery(
    api.deadlines.getUnreadNotificationCount,
    walletAddress ? { walletAddress } : "skip",
  );
  const markAllRead = useMutation(api.deadlines.markAllNotificationsRead);

  const rows = notifications ?? [];

  // Reminders only take space when there is something to read.
  if (!walletAddress || rows.length === 0) {
    return null;
  }

  const unread = unreadCount ?? 0;

  return (
    <section aria-labelledby="deadline-reminders-title" className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2
          id="deadline-reminders-title"
          className="hr-text-primary font-sans text-sm font-semibold"
        >
          Deadline reminders
          {unread > 0 ? (
            <span className="hr-text-secondary ml-2 font-normal">{unread} unread</span>
          ) : null}
        </h2>
        <AppButton
          type="button"
          variant="ghost"
          size="sm"
          disabled={unread === 0}
          onClick={() => void markAllRead({ recipientWallet: walletAddress })}
          className="h-8 px-2 text-xs"
        >
          Mark all read
        </AppButton>
      </div>
      <ul className="divide-y">
        {rows.slice(0, 5).map((notification) => (
          <li key={notification._id} className="flex gap-3 px-4 py-3">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                notification.readAt ? "bg-transparent" : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p
                  className={`hr-text-primary font-sans text-sm ${notification.readAt ? "" : "font-medium"}`}
                >
                  {notification.readAt ? null : <span className="sr-only">Unread: </span>}
                  {notification.title}
                </p>
                <time className="hr-text-muted font-sans text-xs">
                  {formatNotificationTime(notification.createdAt)}
                </time>
              </div>
              <p className="hr-text-secondary mt-0.5 font-sans text-sm">{notification.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
