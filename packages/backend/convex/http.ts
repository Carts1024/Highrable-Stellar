import { httpRouter } from "convex/server";

import type { Id } from "./_generated/dataModel";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { hash, MAX_BYTES, MAX_VIDEO_BYTES, STORAGE_MARKER } from "./newsfeed/photos";

type MediaKind = "photo" | "video";

function responseHeaders(): Headers {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  headers.set("Access-Control-Allow-Methods", "POST, GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Range");
  headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  return headers;
}

function parseRange(value: string | null, size: number): { start: number; end: number } | null {
  if (!value || !/^bytes=/u.test(value) || value.includes(",")) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    if (!size) return { start: 0, end: -1 };
    return { start: Math.max(size - suffixLength, 0), end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size)
    return { start, end: -1 };
  if (requestedEnd < start) return { start, end: -1 };
  return { start, end: Math.min(requestedEnd, size - 1) };
}

function contentType(kind: MediaKind, format?: string): string {
  return kind === "video" ? "video/mp4" : `image/${format ?? "jpeg"}`;
}

function expectedKindMatches(media: { kind?: MediaKind }, expectedKind?: MediaKind): boolean {
  return !expectedKind || (media.kind ?? "photo") === expectedKind;
}

function makeUploadHandler(expectedKind: MediaKind) {
  return httpAction(async (ctx, request) => {
    const startedAt = Date.now();
    const origin = request.headers.get("Origin") ?? "";
    const allowedOrigins = (process.env.NEWSFEED_APP_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const headers = responseHeaders();
    if (!allowedOrigins.includes(origin))
      return new Response("Origin unavailable", { status: 403, headers });
    headers.set("Access-Control-Allow-Origin", origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const credential = request.headers.get("Authorization")?.replace(/^Bearer\s+/u, "") ?? "";
    let storageId: Id<"_storage"> | undefined;
    try {
      if (!credential) throw new Error("Credential required");
      const credentialHash = await hash(credential);
      if (request.method === "GET") {
        const media = await ctx.runQuery(internal.newsfeed.photos.read, { credentialHash });
        if (!expectedKindMatches(media, expectedKind)) throw new Error("Media kind mismatch");
        const blob = await ctx.storage.get(media.storageId!);
        if (!blob) throw new Error("Unavailable");
        const range = parseRange(request.headers.get("Range"), blob.size);
        if (range?.end === -1) {
          headers.set("Accept-Ranges", "bytes");
          headers.set("Content-Range", `bytes */${blob.size}`);
          headers.set("Content-Length", "0");
          headers.set("Content-Type", contentType(expectedKind, media.format));
          return new Response(null, { status: 416, headers });
        }
        const status = range ? 206 : 200;
        const body = range ? blob.slice(range.start, range.end + 1) : blob;
        headers.set("Content-Type", contentType(expectedKind, media.format));
        headers.set("Content-Length", String(body.size));
        headers.set("Accept-Ranges", "bytes");
        if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${blob.size}`);
        console.info("newsfeed_media_read", {
          durationMs: Date.now() - startedAt,
          bytes: body.size,
          success: true,
          kind: expectedKind,
          status,
        });
        return new Response(body, { status, headers });
      }

      if (request.method !== "POST")
        return new Response("Method unavailable", { status: 405, headers });
      const uploadId = new URL(request.url).searchParams.get("uploadId") as Id<"newsfeedUploads">;
      await ctx.runMutation(internal.newsfeed.photos.claim, {
        uploadId,
        credentialHash,
        kind: expectedKind,
      });
      const reader = request.body?.getReader();
      if (!reader) throw new Error(`Empty ${expectedKind}`);
      const maxBytes = expectedKind === "video" ? MAX_VIDEO_BYTES : MAX_BYTES;
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error(`${expectedKind} exceeds its size limit`);
        }
        chunks.push(new Uint8Array(value));
      }
      if (!size) throw new Error(`Empty ${expectedKind}`);
      storageId = await ctx.storage.store(new Blob(chunks, { type: STORAGE_MARKER }));
      const metadata =
        expectedKind === "video"
          ? await ctx.runAction(internal.newsfeed.decodeVideo.decode, { storageId })
          : await ctx.runAction(internal.newsfeed.decode.decode, { storageId });
      await ctx.runMutation(internal.newsfeed.photos.finalize, {
        uploadId,
        storageId,
        ...metadata,
      });
      storageId = undefined;
      console.info("newsfeed_media_upload", {
        durationMs: Date.now() - startedAt,
        bytes: size,
        success: true,
        kind: expectedKind,
      });
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ ready: true }), { headers });
    } catch (error) {
      console.info("newsfeed_media_upload", {
        durationMs: Date.now() - startedAt,
        success: false,
        kind: expectedKind,
      });
      if (storageId)
        await ctx.runMutation(internal.newsfeed.photos.discardUnassociated, { storageId });
      const message = error instanceof Error ? error.message : "Video upload is invalid.";
      const code =
        expectedKind === "video"
          ? typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "string"
            ? error.code
            : (message.match(/VIDEO_[A-Z_]+/u)?.[0] ?? "VIDEO_INVALID")
          : undefined;
      if (expectedKind === "video") {
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: message, code }), { status: 400, headers });
      }
      return new Response(
        "Photo unavailable or invalid. Use a JPEG, PNG, or WebP up to 10 MB and 40 megapixels.",
        { status: 400, headers },
      );
    }
  });
}

const photoHandler = makeUploadHandler("photo");
const videoHandler = makeUploadHandler("video");

const http = httpRouter();
for (const method of ["POST", "GET", "OPTIONS"] as const) {
  http.route({ path: "/newsfeed/photos", method, handler: photoHandler });
  http.route({ path: "/newsfeed/videos", method, handler: videoHandler });
}
export default http;
