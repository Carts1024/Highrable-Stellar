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

function renderActions(disputeId = "dispute-1", viewerWallet = wallet.walletAddress ?? "") {
  return render(
    createElement(DisputeParticipantActions, {
      disputeId: disputeId as never,
      viewerWallet,
    }),
  );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function rerenderActions(
  view: ReturnType<typeof render>,
  disputeId = "dispute-1",
  viewerWallet = wallet.walletAddress ?? "",
) {
  view.rerender(
    createElement(DisputeParticipantActions, {
      disputeId: disputeId as never,
      viewerWallet,
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

  it("preserves both drafts through permission loading and thrown-query recovery without writing", async () => {
    const previousError = console.error;
    console.error = () => {};
    try {
      const view = renderActions();
      const evidence = screen.getByRole("heading", { name: "Add evidence" }).parentElement!;
      const response = screen.getByRole("heading", { name: "Add response" }).parentElement!;
      fireEvent.click(evidence.querySelector("button")!);
      fireEvent.change(screen.getByLabelText("Note (optional)"), {
        target: { value: "Evidence draft" },
      });
      fireEvent.click(response.querySelector("button")!);
      fireEvent.change(screen.getByLabelText("Response"), {
        target: { value: "Response draft" },
      });

      permission.result = undefined;
      rerenderActions(view);
      expect(screen.getByRole("status").textContent).toContain("Checking participant actions");
      expect(addEvidence).not.toHaveBeenCalled();
      expect(addResponse).not.toHaveBeenCalled();

      permission.result = new Error("permission read failed");
      rerenderActions(view);
      expect(screen.getByRole("alert").textContent).toContain("Unable to check");
      expect(addEvidence).not.toHaveBeenCalled();
      expect(addResponse).not.toHaveBeenCalled();

      permission.result = { allowed: true, role: "client", reason: null };
      fireEvent.click(screen.getByRole("button", { name: "Retry participant actions" }));
      expect((screen.getByLabelText("Note (optional)") as HTMLTextAreaElement).value).toBe(
        "Evidence draft",
      );
      expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe(
        "Response draft",
      );

      fireEvent.click(screen.getByRole("button", { name: "Add Evidence" }));
      fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
      await waitFor(() => {
        expect(addEvidence).toHaveBeenCalledWith({
          disputeId: "dispute-1",
          actorWallet: "GCLIENT",
          actorWalletType: "external_wallet",
          attachmentIds: ["file-0"],
          message: "Evidence draft",
        });
        expect(addResponse).toHaveBeenCalledWith({
          disputeId: "dispute-1",
          responderWallet: "GCLIENT",
          responderWalletType: "external_wallet",
          message: "Response draft",
          attachmentIds: ["file-0"],
        });
      });
    } finally {
      console.error = previousError;
    }
  });

  it("hides forms while denied and restores the same session's drafts when permission returns", () => {
    const view = renderActions();
    fireEvent.change(screen.getByLabelText("Response"), {
      target: { value: "Keep this response" },
    });
    permission.result = {
      allowed: false,
      role: null,
      reason: "This dispute is closed.",
    };
    rerenderActions(view);
    expect(screen.getByText("This dispute is closed.")).toBeTruthy();
    expect(screen.queryByLabelText("Response")).toBeNull();

    permission.result = { allowed: true, role: "freelancer", reason: null };
    rerenderActions(view);
    expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe(
      "Keep this response",
    );
    expect(screen.getAllByText("Uploader role: freelancer; context: dispute")).toHaveLength(2);
  });

  it("keeps a pending write locked through permission recovery and prevents duplicate submits", async () => {
    const pendingEvidence = createDeferred<true>();
    addEvidence.mockReturnValueOnce(pendingEvidence.promise);
    const view = renderActions();
    const evidence = screen.getByRole("heading", { name: "Add evidence" }).parentElement!;
    fireEvent.click(evidence.querySelector("button")!);
    fireEvent.submit(evidence);
    fireEvent.submit(evidence);
    expect(addEvidence).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole("button", { name: "Adding evidence..." }) as HTMLButtonElement).disabled,
    ).toBe(true);

    permission.result = undefined;
    rerenderActions(view);
    expect(screen.getByRole("status")).toBeTruthy();
    permission.result = { allowed: true, role: "client", reason: null };
    rerenderActions(view);
    const recoveredEvidence = screen.getByRole("heading", { name: "Add evidence" }).parentElement!;
    expect(
      (screen.getByRole("button", { name: "Adding evidence..." }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.submit(recoveredEvidence);
    expect(addEvidence).toHaveBeenCalledTimes(1);

    pendingEvidence.resolve(true);
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "Add Evidence" }) as HTMLButtonElement).disabled,
      ).toBe(false);
      expect((screen.getByLabelText("Note (optional)") as HTMLTextAreaElement).value).toBe("");
    });
  });

  it("clears only the form whose write succeeds and retains rejected drafts for retry", async () => {
    addEvidence.mockRejectedValueOnce(new Error("Evidence was rejected."));
    renderActions();
    const evidence = screen.getByRole("heading", { name: "Add evidence" }).parentElement!;
    fireEvent.click(evidence.querySelector("button")!);
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "Rejected evidence" },
    });
    fireEvent.change(screen.getByLabelText("Response"), {
      target: { value: "Successful response" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Evidence" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("rejected"));
    expect((screen.getByLabelText("Note (optional)") as HTMLTextAreaElement).value).toBe(
      "Rejected evidence",
    );
    expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe(
      "Successful response",
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
    await waitFor(() => {
      expect((screen.getByLabelText("Note (optional)") as HTMLTextAreaElement).value).toBe(
        "Rejected evidence",
      );
      expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe("");
    });
    expect(addEvidence).toHaveBeenCalledTimes(1);
  });

  it("uses the permitted role and passkey wallet identity in both mutation arguments", async () => {
    wallet.walletAddress = "GSMART";
    wallet.walletType = "passkey_smart_account";
    permission.result = { allowed: true, role: "freelancer", reason: null };
    renderActions();
    const evidence = screen.getByRole("heading", { name: "Add evidence" }).parentElement!;
    const response = screen.getByRole("heading", { name: "Add response" }).parentElement!;
    fireEvent.click(evidence.querySelector("button")!);
    fireEvent.click(response.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Add Evidence" }));
    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "Passkey response" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
    await waitFor(() => {
      expect(addEvidence).toHaveBeenCalledWith({
        disputeId: "dispute-1",
        actorWallet: "GSMART",
        actorWalletType: "passkey_smart_account",
        attachmentIds: ["file-0"],
      });
      expect(addResponse).toHaveBeenCalledWith({
        disputeId: "dispute-1",
        responderWallet: "GSMART",
        responderWalletType: "passkey_smart_account",
        message: "Passkey response",
        attachmentIds: ["file-0"],
      });
    });
  });

  it("discards case, wallet-type, and disconnect sessions and ignores late completions", async () => {
    const pendingResponse = createDeferred<true>();
    addResponse.mockReturnValueOnce(pendingResponse.promise);
    const view = renderActions();
    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "Old response" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Response" }));
    expect(addResponse).toHaveBeenCalledTimes(1);

    wallet.walletAddress = "GNEW";
    permission.result = { allowed: true, role: "client", reason: null };
    rerenderActions(view, "dispute-1", "GNEW");
    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "New wallet draft" } });
    pendingResponse.resolve(true);
    await waitFor(() =>
      expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe(
        "New wallet draft",
      ),
    );

    wallet.walletType = "passkey_smart_account";
    rerenderActions(view, "dispute-1", "GNEW");
    expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Response"), { target: { value: "Case draft" } });
    rerenderActions(view, "dispute-2", "GNEW");
    expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe("");

    wallet.walletAddress = null;
    wallet.walletType = null;
    rerenderActions(view, "dispute-2", "");
    expect(screen.queryByLabelText("Response")).toBeNull();

    wallet.walletAddress = "GNEW";
    wallet.walletType = "external_wallet";
    permission.result = { allowed: true, role: "client", reason: null };
    rerenderActions(view, "dispute-2", "GNEW");
    expect((screen.getByLabelText("Response") as HTMLTextAreaElement).value).toBe("");
  });
});
