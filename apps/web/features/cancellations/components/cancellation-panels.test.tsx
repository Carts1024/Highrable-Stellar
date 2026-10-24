// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TConvexDoc } from "@repo/convex-client";

const CLIENT_WALLET = `G${"C".repeat(55)}`;
const FREELANCER_WALLET = `G${"F".repeat(55)}`;

const runtime = vi.hoisted(() => ({
  walletAddress: null as string | null,
  respond: vi.fn(),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    cancellations: {
      getCancellationTimeline: "timeline",
      respondToCancellationRequest: "respond",
    },
    work_agreements: { getAgreementContextForCancellation: "agreement" },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => runtime.respond,
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({
    walletAddress: runtime.walletAddress,
    walletType: "passkey_smart_account",
  }),
}));
vi.mock("@/features/work-agreements/components", () => ({
  AgreementReferenceCard: () => null,
}));

import { FreelancerCancellationResponsePanel } from "./cancellation-panels";

vi.stubGlobal("React", React);

function cancellationRequest(): TConvexDoc<"cancellationRequests"> {
  return {
    _id: "cancellation-1",
    _creationTime: 1,
    clientWallet: CLIENT_WALLET,
    freelancerWallet: FREELANCER_WALLET,
    status: "pending_freelancer_response",
    freelancerResponseStatus: "pending",
  } as unknown as TConvexDoc<"cancellationRequests">;
}

describe("FreelancerCancellationResponsePanel participant screen", () => {
  afterEach(() => {
    cleanup();
    runtime.walletAddress = null;
    runtime.respond.mockReset();
  });

  it("is hidden from the client and lets the assigned freelancer accept with a default message", async () => {
    runtime.walletAddress = CLIENT_WALLET;
    const view = render(
      createElement(FreelancerCancellationResponsePanel, { request: cancellationRequest() }),
    );
    expect(view.container.innerHTML).toBe("");

    runtime.walletAddress = FREELANCER_WALLET;
    let resolveResponse: () => void = () => undefined;
    runtime.respond.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    view.rerender(
      createElement(FreelancerCancellationResponsePanel, { request: cancellationRequest() }),
    );
    expect(screen.getByText("Cancellation response required")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Add a short response for the client."), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Accept cancellation/ }));

    expect(await screen.findByRole("button", { name: /Accepting/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: /Reject/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(runtime.respond).toHaveBeenCalledTimes(1);
    expect(runtime.respond).toHaveBeenCalledWith({
      cancellationRequestId: "cancellation-1",
      freelancerWallet: FREELANCER_WALLET,
      freelancerWalletType: "passkey_smart_account",
      responseStatus: "accepted",
      responseMessage: "Accepted.",
    });

    resolveResponse();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Accept cancellation/ })).toBeTruthy(),
    );
  });
});
