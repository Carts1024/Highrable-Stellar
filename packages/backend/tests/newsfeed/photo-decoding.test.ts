// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { validateImage } from "../../convex/newsfeed/decode";
describe("photo server decoding", () => {
  it("decodes supported signatures regardless of user metadata", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const bytes = await sharp({ create: { width: 8, height: 4, channels: 3, background: "red" } })
        .toFormat(format)
        .toBuffer();
      expect(await validateImage(bytes)).toMatchObject({
        format,
        width: 8,
        height: 4,
        size: bytes.length,
      });
    }
  });
  it("enforces exact 10 MB, empty, unsupported, truncated and megapixel boundaries", async () => {
    const jpeg = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } })
      .jpeg()
      .toBuffer();
    const boundary = new Uint8Array(10 * 1024 * 1024);
    boundary.set(jpeg);
    expect((await validateImage(boundary)).size).toBe(boundary.length);
    await expect(validateImage(new Uint8Array(boundary.length + 1))).rejects.toThrow(/10 MB/);
    await expect(validateImage(new Uint8Array())).rejects.toThrow();
    await expect(validateImage(new TextEncoder().encode("not an image"))).rejects.toThrow();
    await expect(validateImage(jpeg.subarray(0, jpeg.length / 2))).rejects.toThrow();
    const gif = await sharp(jpeg).gif().toBuffer();
    await expect(validateImage(gif)).rejects.toThrow(/JPEG/);
    const huge = await sharp({
      create: { width: 6400, height: 6400, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(validateImage(huge)).rejects.toThrow(/pixel limit/);
  });
});
