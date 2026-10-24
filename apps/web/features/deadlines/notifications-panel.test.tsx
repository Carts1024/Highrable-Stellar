// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const WALLET = `G${"W".repeat(55)}`;

const runtime = vi.hoisted(() => ({
  walletAddress: null as string | null,
  queryResults: new Map<string, unknown>(),
  queryArgs: [] as Array<{ name: string; args: unknown }>,
  markAllRead: vi.fn(),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    deadlines: {
      getNotificationsForWallet: "notifications",
      getUnreadNotificationCount: "unreadCount",
      markAllNotificationsRead: "markAllRead",
    },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    runtime.queryArgs.push({ name, args });
    return args === "skip" ? undefined : runtime.queryResults.get(name);
  },
  useMutation: () => runtime.markAllRead,
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({ walletAddress: runtime.walletAddress }),
}));

import { DeadlineNotificationsPanel } from "./notifications-panel";

function notification(index: number, readAt?: number) {
  return {
    _id: `notification-${index}`,
    title: `Deadline reminder ${index}`,
    body: `Milestone ${index} is due soon.`,
    createdAt: Date.UTC(2026, 0, index),
    ...(readAt ? { readAt } : {}),
  };
}

describe("DeadlineNotificationsPanel participant screen", () => {
  afterEach(() => {
    cleanup();
    runtime.walletAddress = null;
    runtime.queryResults.clear();
    runtime.queryArgs.length = 0;
    runtime.markAllRead.mockReset();
  });

  it("skips queries without a wallet, then lists at most five reminders and marks all read for the viewer", () => {
    const view = render(createElement(DeadlineNotificationsPanel));
    expect(view.container.innerHTML).toBe("");
    expect(runtime.queryArgs.every(({ args }) => args === "skip")).toBe(true);

    runtime.walletAddress = WALLET;
    runtime.queryResults.set("notifications", [
      notification(1),
      notification(2),
      notification(3, 10),
      notification(4),
      notification(5),
      notification(6),
    ]);
    runtime.queryResults.set("unreadCount", 5);
    view.rerender(createElement(DeadlineNotificationsPanel));

    expect(screen.getByRole("heading", { name: /Deadline reminders/ }).textContent).toContain(
      "5 unread",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText("Deadline reminder 6")).toBeNull();
    expect(screen.getAllByText("Unread:")).toHaveLength(4);
    expect(runtime.queryArgs.at(-1)).toEqual({
      name: "unreadCount",
      args: { walletAddress: WALLET },
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(runtime.markAllRead).toHaveBeenCalledWith({ recipientWallet: WALLET });

    runtime.queryResults.set("unreadCount", 0);
    view.rerender(createElement(DeadlineNotificationsPanel));
    expect(
      (screen.getByRole("button", { name: "Mark all read" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
