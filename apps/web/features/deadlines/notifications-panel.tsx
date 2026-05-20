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
    <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#0a0a0a]">
            <Bell className="h-4 w-4 text-[#FF7003]" />
            Deadline reminders
          </h2>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            {unreadCount ?? 0} unread reminder{(unreadCount ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          disabled={(unreadCount ?? 0) === 0}
          onClick={() => void markAllRead({ recipientWallet: walletAddress })}
        >
          Mark all read
        </AppButton>
      </div>

      {notifications === undefined ? (
        <p className="mt-4 text-sm text-gray-500">Loading reminders...</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[#e8e8e8] bg-[#fafafa] p-4 text-sm text-[#5f5f5f]">
          No deadline reminders yet.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.slice(0, 5).map((notification) => (
            <article
              key={notification._id}
              className={`rounded-lg border p-3 ${
                notification.readAt
                  ? "border-[#e8e8e8] bg-white"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[#0a0a0a]">{notification.title}</p>
                <time className="font-mono text-[11px] text-[#7f7f7f]">
                  {formatNotificationTime(notification.createdAt)}
                </time>
              </div>
              <p className="mt-1 text-sm text-[#5f5f5f]">{notification.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
