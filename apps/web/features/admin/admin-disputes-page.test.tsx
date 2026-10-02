// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

vi.mock("@/features/admin/admin-session-gate", () => ({
  ADMIN_QUERY_KEY: ["admin"],
  AdminSessionGate: ({ children }: { readonly children: ReactNode }) => children,
  useAdminSessionAccess: () => ({
    verifiedWallet: `G${"A".repeat(55)}`,
    isOwner: false,
    isDisputeAdmin: true,
    handleProtectedApiError: vi.fn(),
  }),
}));

vi.mock("@/features/common", () => ({
  ProductPageHero: ({ title }: { readonly title: ReactNode }) => createElement("h1", null, title),
  RouteCallout: ({ children }: { readonly children?: ReactNode }) =>
    createElement("div", { role: "alert" }, children),
  RouteEmptyState: ({ description }: { readonly description: ReactNode }) =>
    createElement("p", null, description),
}));

vi.mock("@/features/disputes", () => ({
  DisputeOnChainStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, `Chain: ${status}`),
  DisputeStatusBadge: ({ status }: { readonly status: string }) =>
    createElement("span", null, status),
}));

vi.mock("@repo/ui/components/highrable/v2-marketing", () => ({
  HighrableV2Metric: ({ label, value }: { readonly label: string; readonly value: ReactNode }) =>
    createElement("div", null, `${label}: ${value}`),
  SectionLabel: ({ children }: { readonly children?: ReactNode }) =>
    createElement("span", null, children),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: {
    readonly asChild?: boolean;
    readonly children?: ReactNode;
  }) =>
    asChild && isValidElement(children)
      ? cloneElement(children, props)
      : createElement("button", props, children),
}));

vi.mock("@repo/ui/components/ui/native-select", () => ({
  NativeSelect: (props: Record<string, unknown>) => createElement("select", props),
  NativeSelectOption: ({ children, ...props }: { readonly children?: ReactNode }) =>
    createElement("option", props, children),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    readonly href: string;
    readonly children?: ReactNode;
  }) => createElement("a", { href, ...props }, children),
}));

import { AdminDisputesPage } from "./admin-disputes-page";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderQueue() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
  });
  const rendered = render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(AdminDisputesPage)),
  );

  return { ...rendered, queryClient };
}

const populatedQueue = {
  admins: [],
  disputes: [
    {
      disputeId: "dispute-1",
      disputeNumber: "DSP-001",
      title: "Missing deliverable",
      status: "under_review",
      onChainStatus: "marked",
      reasonCategory: "work_not_delivered",
      clientWallet: "GCLIENT",
      freelancerWallet: "GFREELANCER",
      openedAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    },
  ],
};

describe("AdminDisputesPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not show misleading zero workload metrics while the queue is loading", async () => {
    let resolveResponse!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    renderQueue();

    expect(screen.getByRole("alert").textContent).toContain("Loading disputes");
    expect(screen.queryByText(/Visible disputes:/)).toBeNull();

    resolveResponse(response({ disputes: [], admins: [] }));
    await screen.findByText("No disputes match the selected filters.");
  });

  it("renders an explicit empty queue and typed filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ disputes: [], admins: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderQueue();

    expect(await screen.findByText("No disputes match the selected filters.")).toBeTruthy();
    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects[0];
    const assignmentSelect = selects[1];
    const onChainSelect = selects[2];
    if (!statusSelect || !assignmentSelect || !onChainSelect) {
      throw new Error("Expected all admin dispute filters.");
    }
    fireEvent.change(statusSelect, { target: { value: "under_review" } });
    fireEvent.change(assignmentSelect, { target: { value: "all" } });
    fireEvent.change(onChainSelect, { target: { value: "mark_failed" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/disputes?status=under_review&onChainStatus=mark_failed&assignmentFilter=all&limit=120",
        expect.anything(),
      );
    });
  });

  it("keeps all eight dispute statuses and four on-chain marking phases selectable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ disputes: [], admins: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderQueue();

    await screen.findByText("No disputes match the selected filters.");
    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects[0];
    const assignmentSelect = selects[1];
    const onChainSelect = selects[2];
    if (
      !(statusSelect instanceof HTMLSelectElement) ||
      !(assignmentSelect instanceof HTMLSelectElement) ||
      !(onChainSelect instanceof HTMLSelectElement)
    ) {
      throw new Error("Expected all admin dispute filters.");
    }

    expect(Array.from(statusSelect.options).map((option) => option.value)).toEqual([
      "",
      "open",
      "under_review",
      "awaiting_client_response",
      "awaiting_freelancer_response",
      "resolved_client",
      "resolved_freelancer",
      "split_resolution",
      "cancelled",
    ]);
    expect(Array.from(onChainSelect.options).map((option) => option.value)).toEqual([
      "",
      "not_marked",
      "marking",
      "marked",
      "mark_failed",
    ]);

    fireEvent.change(statusSelect, { target: { value: "cancelled" } });
    fireEvent.change(onChainSelect, { target: { value: "marking" } });
    fireEvent.change(assignmentSelect, { target: { value: "mine" } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/disputes?status=cancelled&onChainStatus=marking&assignmentFilter=mine&limit=120",
        expect.anything(),
      );
    });
  });

  it("renders populated rows with detail links", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(populatedQueue)));

    renderQueue();

    expect(await screen.findByText("Missing deliverable")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe(
      "/admin/disputes/dispute-1",
    );
  });

  it("keeps failed reads visible and recovers after retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(response(populatedQueue));
    vi.stubGlobal("fetch", fetchMock);

    renderQueue();

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("could not be reached");
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Missing deliverable")).toBeTruthy();
  });
});
