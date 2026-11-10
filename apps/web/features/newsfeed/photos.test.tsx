import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoControls, PhotoGrid, usePhotoDraft } from "./photos";
vi.mock("@/core/wallet/hooks/use-wallet", () => ({
  useWallet: () => ({ authSession: { address: "member" } }),
}));
class Transfer {
  static all: Transfer[] = [];
  upload = { onprogress: (_event: unknown) => {} };
  onload = () => {};
  onerror = () => {};
  onabort = () => {};
  status = 200;
  responseText = "";
  open() {}
  setRequestHeader() {}
  send() {
    Transfer.all.push(this);
  }
  abort() {
    this.onabort();
  }
}
const file = () => new File(["bytes"], "image.png", { type: "image/png" });
const files = (...items: File[]) => items as unknown as FileList;
beforeEach(() => {
  Transfer.all = [];
  vi.stubGlobal("XMLHttpRequest", Transfer);
  vi.stubGlobal("React", React);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  let reservations = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => ({
      ok: true,
      json: async () =>
        url.endsWith("config")
          ? { photosEnabled: true }
          : url === "/api/newsfeed/uploads"
            ? {
                uploadId: `upload-${++reservations}`,
                token: "secret",
                url: "https://example.test/upload",
              }
            : { state: options?.method === "DELETE" ? "cancelled" : "ready" },
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("photo composer", () => {
  it("uploads sequentially, recovers a lost response and preserves descriptions", async () => {
    const { result, unmount } = renderHook(usePhotoDraft);
    await waitFor(() => expect(result.current.enabled).toBe(true));
    act(() => result.current.select(files(file(), file())));
    await waitFor(() => expect(Transfer.all).toHaveLength(1));
    act(() => result.current.patch(result.current.photos[0]!.key, { description: "My work" }));
    act(() => Transfer.all[0]!.onerror());
    await waitFor(() => expect(Transfer.all).toHaveLength(2));
    expect(result.current.photos[0]!.state).toBe("ready");
    expect(result.current.photos[0]!.description).toBe("My work");
    act(() => Transfer.all[1]!.onload());
    await waitFor(() => expect(result.current.photos[1]!.state).toBe("ready"));
    expect(result.current.valid).toBe(false);
    act(() => result.current.patch(result.current.photos[1]!.key, { description: "Another view" }));
    expect(result.current.valid).toBe(true);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
  it("keeps camera cancellation unchanged and rejects HEIC and five selections", async () => {
    const { result } = renderHook(usePhotoDraft);
    act(() => result.current.select(null));
    expect(result.current.photos).toEqual([]);
    act(() =>
      result.current.select(files(new File(["bytes"], "capture.heic", { type: "image/heic" }))),
    );
    expect(result.current.error).toContain("Export HEIC/HEIF");
    act(() => result.current.select(files(...Array.from({ length: 5 }, file))));
    expect(result.current.error).toContain("four");
  });
  it("aborts a removed transfer and cancels the reservation", async () => {
    const { result } = renderHook(usePhotoDraft);
    act(() => result.current.select(files(file())));
    await waitFor(() => expect(Transfer.all).toHaveLength(1));
    const abort = vi.spyOn(Transfer.all[0]!, "abort");
    act(() => result.current.remove(result.current.photos[0]!.key));
    expect(abort).toHaveBeenCalled();
    expect(result.current.photos).toHaveLength(0);
    expect(fetch).toHaveBeenCalledWith(
      "/api/newsfeed/uploads/upload-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it("offers separate native camera and selection controls with required descriptions", async () => {
    function Composer() {
      const draft = usePhotoDraft();
      return <PhotoControls draft={draft} disabled={false} />;
    }
    render(<Composer />);
    const camera = await screen.findByLabelText("Take photo");
    expect(camera.getAttribute("capture")).toBe("environment");
    fireEvent.change(screen.getByLabelText("Choose photos"), { target: { files: files(file()) } });
    expect(screen.getByLabelText("Description for photo 1").hasAttribute("required")).toBe(true);
    expect(screen.getByRole("button", { name: "Remove photo 1" })).toBeTruthy();
  });
});

it("loads moderator media through the explicit path into a revocable local URL", async () => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === "/api/newsfeed/moderation/media")
      return new Response(
        JSON.stringify({ url: "https://media.example.test/newsfeed/photos", token: "read-grant" }),
      );
    return new Response(new Blob(["image bytes"], { type: "image/png" }));
  });
  const post = {
    photos: [{ mediaId: "opaque", description: "A red square", width: 2, height: 2 }],
  } as import("@repo/convex-client").TNewsfeedPostDto;
  const view = render(<PhotoGrid post={post} moderation />);
  const image = await screen.findByAltText("A red square");
  expect(image.getAttribute("src")).toBe("blob:preview");
  expect(fetch).toHaveBeenCalledWith(
    "/api/newsfeed/moderation/media",
    expect.objectContaining({ method: "POST" }),
  );
  expect(fetch).toHaveBeenCalledWith(
    "https://media.example.test/newsfeed/photos",
    expect.objectContaining({ headers: { Authorization: "Bearer read-grant" }, cache: "no-store" }),
  );
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
});

it("revokes a hidden image and reloads it after access is restored", async () => {
  let observe = () => {};
  let denied = false;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        observe = () => callback([{ isIntersecting: true }]);
      }
      observe() {
        observe();
      }
      disconnect() {}
    },
  );
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (url === "/api/newsfeed/media")
      return denied
        ? new Response("Unavailable", { status: 403 })
        : new Response(JSON.stringify({ url: "https://media.example.test/bytes", token: "grant" }));
    return new Response(new Blob(["image"]));
  });
  const post = {
    photos: [{ mediaId: "opaque", description: "Restorable work", width: 1, height: 1 }],
  } as import("@repo/convex-client").TNewsfeedPostDto;
  render(<PhotoGrid post={post} />);
  await screen.findByAltText("Restorable work");
  denied = true;
  act(observe);
  await screen.findByText("Photo unavailable");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  denied = false;
  act(observe);
  expect(await screen.findByAltText("Restorable work")).toBeTruthy();
});
