// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { wallet, permission, queries, addEvidence, addResponse } = vi.hoisted(() => ({
  wallet: {
    walletAddress: "GCLIENT" as string | null,
    walletType: "external_wallet" as string | null,
  },
  permission: { result: { allowed: true, role: "client", reason: null } as unknown },
  queries: [] as Array<{ name: string; args: unknown }>,
  addEvidence: vi.fn(),
  addResponse: vi.fn(),
}));

vi.mock("@repo/convex-client", () => ({
  api: {
    disputes: {
      canRespondToDispute: "canRespond",
      addDisputeEvidence: "evidence",
      addDisputeResponse: "response",
    },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    queries.push({ name, args });
    if (permission.result instanceof Error) throw permission.result;
    return args === "skip" ? undefined : permission.result;
  },
  useMutation: (name: string) => (name === "evidence" ? addEvidence : addResponse),
}));
vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => wallet,
}));
vi.mock("@/features/attachments/components", () => ({
  AttachmentUploader: ({
    onChange,
    ownerRole,
    context,
  }: {
    onChange: (update: (value: unknown[]) => unknown[]) => void;
    ownerRole: string;
    context: string;
  }) =>
    createElement(
      "div",
      null,
      createElement("span", null, `Uploader role: ${ownerRole}; context: ${context}`),
      createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onChange((current) => [
              ...current,
              { id: `file-${current.length}`, name: "proof.pdf", type: "pdf", status: "ready" },
            ]),
        },
        "Add ready file",
      ),
      createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onChange((current) => [
              ...current,
              { id: "failed", name: "bad.pdf", type: "pdf", status: "failed" },
            ]),
        },
        "Add failed file",
      ),
      createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onChange((current) =>
              current.filter((item) => (item as { status: string }).status !== "failed"),
            ),
        },
        "Remove failed file",
      ),
    ),
}));
vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: "button";
  }) => createElement("button", props, children),
}));
vi.mock("@repo/ui/components/ui/textarea", () => ({
  Textarea: (props: Record<string, unknown>) => createElement("textarea", props),
}));

import { DisputeParticipantActions } from "./dispute-participant-actions";

function renderActions() {
  return render(
    createElement(DisputeParticipantActions, {
      disputeId: "dispute-1" as never,
      viewerWallet: wallet.walletAddress ?? "",
    }),
  );
}

describe("C19 participant evidence and response actions", () => {
  beforeEach(() => {
    wallet.walletAddress = "GCLIENT";
    wallet.walletType = "external_wallet";
    permission.result = { allowed: true, role: "client", reason: null };
    addEvidence.mockReset().mockResolvedValue(true);
    addResponse.mockReset().mockResolvedValue(true);
    queries.length = 0;
  });
  afterEach(cleanup);

  it("gates actions on backend permission and suppresses them for closed cases", () => {
    permission.result = undefined;
    const view = renderActions();
    expect(screen.getByRole("status").textContent).toContain("Checking participant actions");
    permission.result = {
      allowed: false,
      role: null,
      reason: "This dispute is not accepting new responses.",
    };
    view.rerender(
      createElement(DisputeParticipantActions, {
        disputeId: "dispute-1" as never,
        viewerWallet: "GCLIENT",
      }),
    );
    expect(screen.getByText("This dispute is not accepting new responses.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Evidence" })).toBeNull();
    expect(queries.find((call) => call.name === "canRespond")?.args).toEqual({
      disputeId: "dispute-1",
      walletAddress: "GCLIENT",
    });
  });

  it("submits owned evidence and response with the active identity", async () => {
    renderActions();
    const evidence = screen.getByRole("heading", { name: "Add evidence" }).parentElement!;
    fireEvent.click(evidence.querySelector("button")!);
    fireEvent.change(screen.getByLabelText("Response"), {
      target: { value: "  The submitted work differs.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Evidence" }));
    await waitFor(() =>
      expect(addEvidence).toHaveBeenCalledWith({
        disputeId: "dispute-1",
        actorWallet: "GCLIENT",
        actorWalletType: "external_wallet",
        attachmentIds: ["file-0"],
      }),
    );
    await waitFor(() =>
      expect(addResponse).toHaveBeenCalledWith({
        disputeId: "dispute-1",
        responderWallet: "GCLIENT",
        responderWalletType: "external_wallet",
        message: "The submitted work differs.",
        attachmentIds: [],
      }),
    );
    expect(screen.getAllByText("Uploader role: client; context: dispute")).toHaveLength(2);
  });

  it("keeps drafts after invalid attachments and rejected mutations so submission can be retried", async () => {
    addResponse.mockRejectedValueOnce(new Error("Attachment is already linked to another record."));
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Add Evidence" }));
    expect(screen.getByRole("alert").textContent).toContain("Add at least one evidence");
    const response = screen.getByRole("heading", { name: "Add response" }).parentElement!;
    fireEvent.click(response.querySelector("button")!);
    fireEvent.click(response.querySelectorAll("button")[1]!);
    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "Please review." } });
    fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
    expect(
      screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Finish uploads")),
    ).toBe(true);
    expect(addResponse).not.toHaveBeenCalled();
    fireEvent.click(response.querySelectorAll("button")[2]!);
    fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("already linked")),
      ).toBe(true),
    );
    expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe("Please review.");
    fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
    await waitFor(() => expect(addResponse).toHaveBeenCalledTimes(2));
  });

  it("recovers from a failed permission read", () => {
    const previousError = console.error;
    console.error = () => {};
    try {
      permission.result = new Error("read failed");
      const view = renderActions();
      expect(screen.getByRole("alert").textContent).toContain("Unable to check");
      permission.result = { allowed: true, role: "freelancer", reason: null };
      fireEvent.click(screen.getByRole("button", { name: "Retry participant actions" }));
      view.rerender(
        createElement(DisputeParticipantActions, {
          disputeId: "dispute-1" as never,
          viewerWallet: "GCLIENT",
        }),
      );
      expect(screen.getAllByText("Uploader role: freelancer; context: dispute")).toHaveLength(2);
    } finally {
      console.error = previousError;
    }
  });
});
