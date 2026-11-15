// @vitest-environment node
import { describe, expect, it } from "vitest";

import { validateVideo, VIDEO_ERROR_CODES } from "../../convex/newsfeed/decodeVideo";

describe("newsfeed video validation", () => {
  it("rejects empty, oversized, MOV, WebM, and truncated containers with specific errors", () => {
    expect(() => validateVideo(new Uint8Array())).toThrowError(
      expect.objectContaining({ code: VIDEO_ERROR_CODES.EMPTY }),
    );
    expect(() => validateVideo(new Uint8Array(26_214_401))).toThrowError(
      expect.objectContaining({ code: VIDEO_ERROR_CODES.SIZE }),
    );
    const mov = new Uint8Array(16);
    mov.set(new TextEncoder().encode("\0\0\0\x18ftypqt  "), 0);
    expect(() => validateVideo(mov)).toThrowError(
      expect.objectContaining({ code: VIDEO_ERROR_CODES.CONTAINER }),
    );
    const webm = new TextEncoder().encode("\x1A\x45\xDF\xA3\0\0\0\0");
    expect(() => validateVideo(webm)).toThrowError(
      expect.objectContaining({ code: VIDEO_ERROR_CODES.CONTAINER }),
    );
    const truncated = new Uint8Array(16);
    truncated.set(new TextEncoder().encode("\0\0\0\x18ftypisom"), 0);
    expect(() => validateVideo(truncated)).toThrowError(
      expect.objectContaining({ code: VIDEO_ERROR_CODES.CONTAINER }),
    );
  });
});
