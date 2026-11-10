import { httpRouter } from "convex/server";

import type { Id } from "./_generated/dataModel";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { hash, MAX_BYTES, STORAGE_MARKER } from "./newsfeed/photos";
const http = httpRouter();
const handler = httpAction(async (ctx, request) => {
  const startedAt = Date.now();
  const origin = request.headers.get("Origin") ?? "";
  const allowed = (process.env.NEWSFEED_APP_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (!allowed.includes(origin))
    return new Response("Origin unavailable", { status: 403, headers });
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const credential = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  let storageId: Id<"_storage"> | undefined;
  try {
    if (!credential) throw new Error("Credential required");
    const credentialHash = await hash(credential);
    if (request.method === "GET") {
      const media = await ctx.runQuery(internal.newsfeed.photos.read, { credentialHash });
      const blob = await ctx.storage.get(media.storageId!);
      if (!blob) throw new Error("Unavailable");
      headers.set("Content-Type", `image/${media.format}`);
      console.info("newsfeed_media_read", {
        durationMs: Date.now() - startedAt,
        bytes: blob.size,
        success: true,
      });
      return new Response(blob, { headers });
    }
    const uploadId = new URL(request.url).searchParams.get("uploadId") as Id<"newsfeedUploads">;
    await ctx.runMutation(internal.newsfeed.photos.claim, { uploadId, credentialHash });
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Empty photo");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Photo exceeds 10 MB");
      }
      chunks.push(new Uint8Array(value));
    }
    if (!size) throw new Error("Empty photo");
    storageId = await ctx.storage.store(new Blob(chunks, { type: STORAGE_MARKER }));
    const metadata = await ctx.runAction(internal.newsfeed.decode.decode, { storageId });
    await ctx.runMutation(internal.newsfeed.photos.finalize, { uploadId, storageId, ...metadata });
    storageId = undefined; // Finalization owns cleanup now.
    console.info("newsfeed_photo_upload", {
      durationMs: Date.now() - startedAt,
      bytes: size,
      success: true,
    });
    return new Response(JSON.stringify({ ready: true }), { headers });
  } catch {
    console.info(request.method === "GET" ? "newsfeed_media_read" : "newsfeed_photo_upload", {
      durationMs: Date.now() - startedAt,
      success: false,
    });
    if (storageId)
      await ctx.runMutation(internal.newsfeed.photos.discardUnassociated, { storageId });
    return new Response(
      "Photo unavailable or invalid. Use a JPEG, PNG, or WebP up to 10 MB and 40 megapixels.",
      { status: 400, headers },
    );
  }
});
for (const method of ["POST", "GET", "OPTIONS"] as const)
  http.route({ path: "/newsfeed/photos", method, handler });
export default http;
