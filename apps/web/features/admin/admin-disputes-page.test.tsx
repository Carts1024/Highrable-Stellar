// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cloneElement, createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

const runtime = vi.hoisted(() => ({
  verifiedWallet: `G${"A".repeat(55)}`,
  isOwner: false,
}));

vi.mock("@/features/admin/admin-session-gate", () => ({
  ADMIN_QUERY_KEY: ["admin"],
  AdminSessionGate: ({ children }: { readonly children: ReactNode }) => children,
  useAdminSessionAccess: () => ({
    verifiedWallet: runtime.verifiedWallet,
    isOwner: runtime.isOwner,
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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

const ownerWallet = `G${"A".repeat(55)}`;
const secondAdminWallet = `G${"C".repeat(55)}`;
const historicalAdminWallet = `G${"D".repeat(55)}`;

function ownerMembership() {
  return {
    admins: [
      { wallet: ownerWallet.toLowerCase(), accessState: "active" },
      { wallet: ownerWallet, accessState: "active" },
      { wallet: secondAdminWallet, accessState: "active" },
      { wallet: historicalAdminWallet, accessState: "revoked" },
      { wallet: "GCLIENT", accessState: "active" },
      { wallet: "GFREELANCER", accessState: "active" },
    ],
    operations: [],
  };
}

describe("AdminDisputesPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    runtime.verifiedWallet = `G${"A".repeat(55)}`;
    runtime.isOwner = false;
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
    expect(screen.getByText("under_review")).toBeTruthy();
    expect(screen.getByText("Chain: marked")).toBeTruthy();
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

  it.each([
    ["GCLIENT", "participant"],
    [ownerWallet, "terminal"],
  ])("does not render a claim control for an unclaimable %s case", async (wallet, reason) => {
    runtime.verifiedWallet = wallet;
    const dispute = {
      ...populatedQueue.disputes[0],
      status: reason === "terminal" ? "resolved_client" : "open",
      assignedAdminWallet: undefined,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ disputes: [dispute] })));

    renderQueue();

    await screen.findByText("Missing deliverable");
    expect(screen.queryByRole("button", { name: "Claim" })).toBeNull();
  });

  it("waits for membership before enabling deduplicated owner assignment options", async () => {
    runtime.isOwner = true;
    const dispute = {
      ...populatedQueue.disputes[0],
      assignedAdminWallet: historicalAdminWallet,
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/admin/admins"
        ? Promise.resolve(response(ownerMembership()))
        : Promise.resolve(response({ disputes: [dispute] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderQueue();

    const assignment = await screen.findByLabelText("Assign DSP-001");
    if (!(assignment instanceof HTMLSelectElement)) {
      throw new Error("Expected owner assignment select.");
    }

    expect(assignment.disabled).toBe(false);
    expect(Array.from(assignment.options).map((option) => option.value)).toEqual([
      "",
      historicalAdminWallet,
      ownerWallet,
      secondAdminWallet,
    ]);
    expect(assignment.options[1]?.disabled).toBe(true);
    expect(
      Array.from(assignment.options).filter((option) => option.value === ownerWallet),
    ).toHaveLength(1);
    expect(Array.from(assignment.options).some((option) => option.value === "GCLIENT")).toBe(false);
    expect(Array.from(assignment.options).some((option) => option.value === "GFREELANCER")).toBe(
      false,
    );
  });

  it("keeps owner assignment disabled while membership is loading or unavailable", async () => {
    runtime.isOwner = true;
    let resolveMembership!: (value: Response) => void;
    const membership = new Promise<Response>((resolve) => {
      resolveMembership = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/admin/admins"
        ? membership
        : Promise.resolve(response({ disputes: populatedQueue.disputes })),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderQueue();

    const assignment = await screen.findByLabelText("Assign DSP-001");
    expect(assignment).toHaveProperty("disabled", true);
    expect(screen.getByText(/Loading eligible dispute admins/)).toBeTruthy();

    resolveMembership(response({ error: "Membership read failed." }, 500));
    await waitFor(() => {
      expect(screen.getByText(/Could not load eligible dispute admins/)).toBeTruthy();
    });
    expect(assignment).toHaveProperty("disabled", true);
  });

  it("posts exact assignment payloads, invalidates every queue filter and detail cache, and refreshes", async () => {
    runtime.isOwner = true;
    const updatedDispute = {
      ...populatedQueue.disputes[0],
      assignedAdminWallet: secondAdminWallet,
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/admins") {
        return Promise.resolve(response(ownerMembership()));
      }
      if (url.endsWith("/assignment")) {
        expect(init?.body).toBe(JSON.stringify({ assignedAdminWallet: secondAdminWallet }));
        return Promise.resolve(response({ assignedAdminWallet: secondAdminWallet }));
      }

      return Promise.resolve(
        response({
          disputes: [fetchMock.mock.calls.length > 2 ? updatedDispute : populatedQueue.disputes[0]],
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient } = renderQueue();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const assignment = await screen.findByLabelText("Assign DSP-001");
    fireEvent.change(assignment, { target: { value: secondAdminWallet } });

    expect(await screen.findByText("Case assignment updated.")).toBeTruthy();
    expect(screen.getByText(`Assigned: ${secondAdminWallet}`)).toBeTruthy();
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, {
      queryKey: ["admin", "disputes", ownerWallet],
      refetchType: "none",
    });
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
      queryKey: ["admin", "dispute", ownerWallet, "dispute-1"],
      refetchType: "none",
    });
  });

  it("shows backend assignment conflicts and prevents duplicate queue submissions", async () => {
    const pendingAssignment = createDeferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/claim")) {
        return pendingAssignment.promise;
      }
      return Promise.resolve(response({ disputes: [populatedQueue.disputes[0]] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderQueue();
    const claim = await screen.findByRole("button", { name: "Claim" });
    fireEvent.click(claim);
    expect(await screen.findByRole("button", { name: "Claiming..." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Claiming..." }));
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/claim"))).toHaveLength(
      1,
    );

    pendingAssignment.resolve(response({ error: "A settlement attempt is active." }, 409));
    expect(await screen.findByText("A settlement attempt is active.")).toBeTruthy();
  });

  it("offers read-only recovery after a successful assignment cannot refresh the queue", async () => {
    runtime.isOwner = true;
    let queueRead = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/admins") {
        return Promise.resolve(response(ownerMembership()));
      }
      if (url.endsWith("/assignment")) {
        return Promise.resolve(response({ assignedAdminWallet: secondAdminWallet }));
      }
      queueRead += 1;
      return queueRead === 1
        ? Promise.resolve(response({ disputes: populatedQueue.disputes }))
        : queueRead <= 4
          ? Promise.resolve(response({ error: "Queue refresh failed." }, 500))
          : Promise.resolve(
              response({
                disputes: [
                  { ...populatedQueue.disputes[0], assignedAdminWallet: secondAdminWallet },
                ],
              }),
            );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderQueue();
    const assignment = await screen.findByLabelText("Assign DSP-001");
    fireEvent.change(assignment, { target: { value: secondAdminWallet } });

    expect(await screen.findByText(/assignment was saved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry read" }));
    expect(await screen.findByText(`Assigned: ${secondAdminWallet}`)).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/assignment")),
    ).toHaveLength(1);
  });
});
