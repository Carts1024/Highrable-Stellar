// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import React, { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, detailPanel } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  detailPanel: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/features/disputes", () => ({
  DisputeDetailPanel: (props: { disputeId: string }) => {
    detailPanel(props);
    return createElement("div", null, `Permission flow for ${props.disputeId}`);
  },
}));

import DisputeDetailPage from "./page";

describe("participant dispute detail route entry", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(globalThis, "React");
  });

  beforeEach(() => {
    Object.assign(globalThis, { React });
    notFound.mockClear();
    detailPanel.mockClear();
  });

  it("calls notFound before mounting the detail panel for malformed IDs", async () => {
    await expect(
      DisputeDetailPage({ params: Promise.resolve({ disputeId: "bad/id" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledOnce();
    expect(detailPanel).not.toHaveBeenCalled();
  });

  it("passes valid-looking IDs to the existing participant permission flow", async () => {
    const page = await DisputeDetailPage({
      params: Promise.resolve({ disputeId: "dispute_123" }),
    });
    render(page);

    expect(notFound).not.toHaveBeenCalled();
    expect(detailPanel).toHaveBeenCalledWith({ disputeId: "dispute_123" });
    expect(page).toBeTruthy();
  });
});
