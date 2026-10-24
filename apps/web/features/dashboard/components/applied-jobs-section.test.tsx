// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IFreelancerAppliedJobsState } from "../hooks/use-freelancer-applied-jobs";

const runtime = vi.hoisted(() => ({
  state: null as IFreelancerAppliedJobsState | null,
  loadMore: vi.fn(),
}));

vi.mock("@/features/dashboard/hooks/use-freelancer-applied-jobs", () => ({
  useFreelancerAppliedJobs: () => runtime.state,
}));
vi.mock("@/features/common", () => ({
  RouteEmptyState: ({
    title,
    description,
    action,
  }: {
    readonly title: ReactNode;
    readonly description: ReactNode;
    readonly action?: ReactNode;
  }) => createElement("section", null, createElement("h2", null, title), description, action),
  StatusText: ({ children }: { readonly children?: ReactNode }) =>
    createElement("span", null, children),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { readonly href: string; readonly children?: ReactNode }) =>
    createElement("a", { href }, children),
}));

import { AppliedJobsSection } from "./applied-jobs-section";

function appliedState(
  overrides: Partial<IFreelancerAppliedJobsState> = {},
): IFreelancerAppliedJobsState {
  return {
    items: [],
    status: "Exhausted",
    isInitialLoading: false,
    canLoadMore: false,
    isLoadingMore: false,
    loadMore: runtime.loadMore,
    nextPageSize: 8,
    ...overrides,
  } as IFreelancerAppliedJobsState;
}

describe("AppliedJobsSection participant screen", () => {
  afterEach(() => {
    cleanup();
    runtime.loadMore.mockReset();
  });

  it("shows the empty state, then application rows with statuses and paginates by the next page size", () => {
    runtime.state = appliedState();
    const view = render(createElement(AppliedJobsSection));
    expect(screen.getByText("No applications yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse open jobs" }).getAttribute("href")).toBe(
      "/marketplace",
    );

    runtime.state = appliedState({
      canLoadMore: true,
      status: "CanLoadMore",
      items: [
        {
          applicationId: "application-1",
          jobId: "job-1",
          title: "Design a wallet onboarding flow",
          milestoneTitle: "Wireframes",
          budget: 1250,
          asset: "USDC",
          derivedApplicationStatus: "selected",
          jobStatus: "funded",
          escrowStatus: "funded",
          applicationCreatedAt: Date.UTC(2026, 0, 15),
          proposalPreview: "I have built three passkey wallets.",
        },
      ] as unknown as IFreelancerAppliedJobsState["items"],
    });
    view.rerender(createElement(AppliedJobsSection));

    expect(screen.queryByText("No applications yet")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Design a wallet onboarding flow/ }).getAttribute("href"),
    ).toBe("/marketplace/jobs/job-1");
    expect(screen.getByText("Milestone: Wireframes")).toBeTruthy();
    expect(screen.getByText("Selected")).toBeTruthy();
    expect(screen.getAllByText("Funded")).toHaveLength(2);
    expect(screen.getByText("Payment hold")).toBeTruthy();
    expect(screen.getByText("I have built three passkey wallets.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(runtime.loadMore).toHaveBeenCalledWith(8);
  });
});
