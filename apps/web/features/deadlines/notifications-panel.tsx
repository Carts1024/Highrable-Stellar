"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { Button as AppButton } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Bell } from "lucide-react";

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

  if (!walletAddress) {
    return null;
  }

  const rows = notifications ?? [];

  return (
    <section className="rounded-xl border border-border/80 bg-card shadow-sm sm:rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] tracking-[0.08em] text-highrable-orange-3 uppercase">
            Deadline Reminders
          </p>
          <p className="hr-text-secondary font-sans text-sm">
            {unreadCount ?? 0} unread reminder{(unreadCount ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <AppButton
          type="button"
          variant="outline"
          size="sm"
          disabled={(unreadCount ?? 0) === 0}
          onClick={() => void markAllRead({ recipientWallet: walletAddress })}
          className="h-9 gap-2 rounded-lg px-4 text-xs font-semibold"
        >
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          Mark all read
        </AppButton>
      </div>

      {notifications === undefined ? (
        <p className="border-t border-border/80 px-5 py-4 font-sans text-sm text-muted-foreground sm:px-6">
          Loading reminders...
        </p>
      ) : rows.length === 0 ? (
        <p className="border-t border-border/80 bg-muted/30 px-5 py-4 font-sans text-sm text-muted-foreground sm:px-6">
          No deadline reminders yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border/80 p-3 sm:p-4">
          {rows.slice(0, 5).map((notification) => (
            <article
              key={notification._id}
              className={`rounded-lg border px-4 py-3 ${
                notification.readAt ? "border-border/80 bg-card" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="hr-text-primary font-sans text-sm font-semibold">
                  {notification.title}
                </p>
                <time className="font-sans text-[11px] text-muted-foreground/70">
                  {formatNotificationTime(notification.createdAt)}
                </time>
              </div>
              <p className="hr-text-secondary mt-1 font-sans text-sm">{notification.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
