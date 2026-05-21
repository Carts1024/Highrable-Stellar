"use client";

import { useHighrableWalletIdentity } from "@/core/wallet/hooks/use-highrable-wallet-identity";
import { api } from "@repo/convex-client";
import { SectionLabel } from "@repo/ui/components/highrable/v2-marketing";
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
    <section className="border border-[#e8e8e8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="p-5 sm:p-6">
          <SectionLabel>Deadline Reminders</SectionLabel>
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
          className="mr-5 rounded-none sm:mr-6"
        >
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          Mark all read
        </AppButton>
      </div>

      {notifications === undefined ? (
        <p className="border-t border-[#e8e8e8] px-5 py-4 text-sm text-gray-500 sm:px-6">
          Loading reminders...
        </p>
      ) : rows.length === 0 ? (
        <p className="border-t border-dashed border-[#e8e8e8] bg-[#fafafa] px-5 py-4 text-sm text-[#5f5f5f] sm:px-6">
          No deadline reminders yet.
        </p>
      ) : (
        <div className="border-t border-[#e8e8e8]">
          {rows.slice(0, 5).map((notification) => (
            <article
              key={notification._id}
              className={`border-b p-4 last:border-b-0 sm:px-6 ${
                notification.readAt ? "border-[#e8e8e8] bg-white" : "border-amber-200 bg-amber-50"
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
