// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/wallet/hooks/use-highrable-wallet-identity", () => ({
  useHighrableWalletIdentity: () => ({ walletAddress: "GCLIENT", walletType: "external_wallet" }),
}));
vi.mock("@/features/common", () => ({ showWarningToast: vi.fn() }));
vi.mock("@/features/attachments/protected-viewer", () => ({
  AttachmentProtectionBadge: () => null,
  ProtectedAttachmentDialog: () => null,
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("@repo/convex-client", () => ({
  api: {
    attachments: {
      generateUploadUrl: "upload",
      saveUploadedAttachment: "save",
      createExternalAttachment: "external",
      softDelete: "delete",
    },
  },
}));

import { AttachmentDropzone, AttachmentUploader } from "./components";

describe("participant attachment keyboard and label coverage", () => {
  afterEach(cleanup);

  it("gives each uploader its own label targets", () => {
    const onChange = vi.fn();
    render(
      createElement(
        "div",
        null,
        createElement(AttachmentUploader, {
          value: [],
          onChange,
          ownerRole: "client",
          context: "dispute",
        }),
        createElement(AttachmentUploader, {
          value: [],
          onChange,
          ownerRole: "client",
          context: "dispute",
        }),
      ),
    );
    const urls = screen.getAllByRole("textbox", { name: "Link URL" });
    expect(urls).toHaveLength(2);
    expect(urls[0]!.id).not.toBe(urls[1]!.id);
    const toggles = screen.getAllByRole("switch", { name: "Enable content protection controls" });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]!.id).not.toBe(toggles[1]!.id);
    for (const toggle of toggles) {
      expect(document.querySelector(`label[for="${toggle.id}"]`)?.textContent).toContain(
        "Protected preview",
      );
    }
  });

  it("opens the file picker by keyboard only while enabled", () => {
    const onFiles = vi.fn();
    const view = render(createElement(AttachmentDropzone, { disabled: false, onFiles }));
    const dropzone = screen.getByRole("button", { name: "Upload attachments" });
    const picker = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(picker, "click").mockImplementation(() => {});
    fireEvent.keyDown(dropzone, { key: "Enter" });
    fireEvent.keyDown(dropzone, { key: " " });
    expect(click).toHaveBeenCalledTimes(2);
    view.rerender(createElement(AttachmentDropzone, { disabled: true, onFiles }));
    expect(dropzone.getAttribute("tabindex")).toBe("-1");
    expect(dropzone.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(dropzone, { key: "Enter" });
    fireEvent.click(dropzone);
    expect(click).toHaveBeenCalledTimes(2);
  });
});
