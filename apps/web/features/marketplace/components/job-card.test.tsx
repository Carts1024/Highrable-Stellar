// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TConvexDoc } from "@repo/convex-client";

const CLIENT_WALLET = `G${"C".repeat(55)}`;
const FREELANCER_WALLET = `G${"F".repeat(55)}`;

const runtime = vi.hoisted(() => ({ mode: "freelancer" as "freelancer" | "client" }));

vi.mock("@/features/mode", () => ({ useAppMode: () => ({ mode: runtime.mode }) }));
vi.mock("@/features/deadlines", () => ({
  DeadlineBadge: () => createElement("span", null, "Deadline"),
}));
vi.mock("@/core/stellar/assets", () => ({ formatAssetLabel: () => "USDC" }));
vi.mock("@/core/stellar/payment-assets", () => ({ isNativeXlmEscrowAsset: () => false }));
vi.mock("@repo/ui/components/highrable/v2-marketing", () => ({
  HighrableV2IconNotice: ({ label }: { readonly label: string }) =>
    createElement("span", null, label),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { readonly href: string; readonly children?: ReactNode }) =>
    createElement("a", { href }, children),
}));

import { JobCard } from "./job-card";

function job(overrides: Partial<TConvexDoc<"jobs">> = {}): TConvexDoc<"jobs"> {
  return {
    _id: "job-1",
    _creationTime: 1,
    title: "Audit a Soroban escrow",
    description: "Review release and refund paths.",
    budget: 400,
    asset: `C${"A".repeat(55)}`,
    jobType: "micro_gig",
    clientWallet: CLIENT_WALLET,
    status: "open",
    jobHash: "hash-1",
    createdAt: 1,
    ...overrides,
  } as TConvexDoc<"jobs">;
}

function renderCard(props: Partial<React.ComponentProps<typeof JobCard>> = {}) {
  const onApply = vi.fn();
  const view = render(
    createElement(
      "ul",
      null,
      createElement(JobCard, {
        job: job(),
        connectedWallet: FREELANCER_WALLET,
        onApply,
        isApplying: false,
        hasApplied: false,
        isCheckingApplicationStatus: false,
        ...props,
      }),
    ),
  );
  return { onApply, view };
}

describe("JobCard participant screen", () => {
  afterEach(() => {
    cleanup();
    runtime.mode = "freelancer";
  });

  it("offers Apply only to an eligible freelancer and hides it for the client, applied, or milestone cases", () => {
    const { onApply } = renderCard();

    expect(screen.getByRole("link", { name: "Audit a Soroban escrow" }).getAttribute("href")).toBe(
      "/marketplace/jobs/job-1",
    );
    expect(screen.getByText(/400/).textContent).toContain("USDC");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith("job-1");
    cleanup();

    renderCard({ connectedWallet: CLIENT_WALLET.toLowerCase() });
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    cleanup();

    renderCard({ hasApplied: true });
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    cleanup();

    renderCard({ job: job({ jobType: "milestone_project", totalBudget: 900 }) });
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByText("Apply to individual milestones on the job page")).toBeTruthy();
    expect(screen.getByText("Total budget")).toBeTruthy();
    cleanup();

    runtime.mode = "client";
    renderCard();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });
});
