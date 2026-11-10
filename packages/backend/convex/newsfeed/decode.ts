"use node";
import { Buffer } from "node:buffer";

import { v } from "convex/values";
import sharp from "sharp";

import { internalAction } from "../_generated/server";
export async function validateImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    throw new Error("Photo must be between 1 byte and 10 MB.");
  const decoder = sharp(Buffer.from(bytes), {
    limitInputPixels: 40_000_000,
    failOn: "warning",
    animated: false,
  });
  const metadata = await decoder.metadata();
  if (
    !metadata.format ||
    !["jpeg", "png", "webp"].includes(metadata.format) ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("Use a still JPEG, PNG, or WebP photo. Export HEIC/HEIF as JPEG first.");
  await decoder.raw().toBuffer(); // Force full decoding, not just header inspection.
  return {
    format: metadata.format,
    size: bytes.length,
    width: (metadata.orientation ?? 0) >= 5 ? metadata.height : metadata.width,
    height: (metadata.orientation ?? 0) >= 5 ? metadata.width : metadata.height,
  };
}
export const decode = internalAction({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("Upload missing.");
    return validateImage(new Uint8Array(await blob.arrayBuffer()));
  },
});
