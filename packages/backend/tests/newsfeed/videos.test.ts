import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";

import { api } from "../../convex/_generated/api";
import { internal } from "../../convex/_generated/api";
import { hash } from "../../convex/newsfeed/photos";
import schema from "../../convex/schema";
import { modules } from "../convexModules";

const serviceSecret = "video-test-secret";
const auth = { serviceSecret, sessionId: "video-session", walletAddress: "GVIDEO" };

beforeEach(() => {
  process.env.HIGHRABLE_AUTH_SERVICE_SECRET = serviceSecret;
  process.env.NEWSFEED_ENABLED = "true";
  process.env.NEWSFEED_TEXT_ENABLED = "true";
  process.env.NEWSFEED_PHOTOS_ENABLED = "true";
  process.env.NEWSFEED_VIDEO_ENABLED = "true";
  process.env.NEWSFEED_APP_ORIGINS = "https://app.example.test";
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      walletAddress: auth.walletAddress,
      name: "Video Member",
      onboardingCompletedAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("authSessions", {
      sessionId: auth.sessionId,
      walletAddress: auth.walletAddress,
      walletType: "external_wallet",
      authMethod: "external_wallet",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
    });
  });
  return t;
}

async function readyVideo(t: Awaited<ReturnType<typeof setup>>, bytes = "video-bytes") {
  const token = crypto.randomUUID();
  const credentialHash = await hash(token);
  const { uploadId } = await t.mutation(api.newsfeed.photos.reserve, {
    ...auth,
    credentialHash,
    kind: "video",
  });
  await t.mutation(internal.newsfeed.photos.claim, { uploadId, credentialHash, kind: "video" });
  const raw = new TextEncoder().encode(bytes);
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob([raw], { type: "application/x-highrable-newsfeed" })),
  );
  await t.mutation(internal.newsfeed.photos.finalize, {
    uploadId,
    storageId,
    format: "mp4",
    size: raw.length,
    width: 1920,
    height: 1080,
    duration: 2.5,
    videoCodec: "avc1.64001f",
  });
  return { uploadId, storageId };
}

describe("newsfeed video lifecycle", () => {
  it("publishes one immutable video with opaque metadata and permits empty text", async () => {
    const t = await setup();
    const video = await readyVideo(t);
    const result = await t.mutation(api.newsfeed.createPost, {
      ...auth,
      requestId: "video-publication",
      publicationMode: "freelancer",
      text: "",
      video: { uploadId: video.uploadId, description: "A short demo" },
    });
    const dto = await t.query(api.newsfeed.getPost, { ...auth, postId: result.postId });
    expect(dto?.photos).toEqual([]);
    expect(dto?.video).toMatchObject({
      mediaId: video.uploadId,
      description: "A short demo",
      width: 1920,
      height: 1080,
      duration: 2.5,
    });
    expect(JSON.stringify(dto)).not.toContain(video.storageId);
    await t.mutation(api.newsfeed.updatePost, { ...auth, postId: result.postId, text: "" });
  });

  it("rejects mixed media, photo uploads in the video slot, and disabled video publication", async () => {
    const t = await setup();
    const video = await readyVideo(t);
    const photo = await readyVideo(t, "photo-shaped-fixture");
    await t.run(async (ctx) => {
      await ctx.db.patch(photo.uploadId, { kind: "photo", format: "png" });
    });
    await expect(
      t.mutation(api.newsfeed.createPost, {
        ...auth,
        requestId: "mixed",
        publicationMode: "client",
        text: "mixed",
        photos: [{ uploadId: photo.uploadId, description: "photo" }],
        video: { uploadId: video.uploadId, description: "video" },
      }),
    ).rejects.toThrow(/photos or one video/);
    await expect(
      t.mutation(api.newsfeed.createPost, {
        ...auth,
        requestId: "wrong-kind",
        publicationMode: "client",
        text: "wrong kind",
        video: { uploadId: photo.uploadId, description: "video" },
      }),
    ).rejects.toThrow(/unavailable/);
    process.env.NEWSFEED_VIDEO_ENABLED = "false";
    await expect(
      t.mutation(api.newsfeed.createPost, {
        ...auth,
        requestId: "disabled",
        publicationMode: "client",
        text: "disabled",
        video: { uploadId: video.uploadId, description: "video" },
      }),
    ).rejects.toThrow(/Videos are unavailable/);
  });

  it("serves full, open-ended, suffix, malformed and unsatisfiable ranges", async () => {
    const t = await setup();
    const video = await readyVideo(t, "0123456789");
    await t.mutation(api.newsfeed.createPost, {
      ...auth,
      requestId: "range-post",
      publicationMode: "client",
      text: "range",
      video: { uploadId: video.uploadId, description: "Range fixture" },
    });
    const readToken = "video-read-token";
    await t.mutation(api.newsfeed.photos.authorizeRead, {
      ...auth,
      mediaId: video.uploadId,
      moderation: false,
      credentialHash: await hash(readToken),
    });
    const fetchMedia = (range?: string) =>
      t.fetch("/newsfeed/videos", {
        headers: {
          Origin: "https://app.example.test",
          Authorization: `Bearer ${readToken}`,
          ...(range ? { Range: range } : {}),
        },
      });
    const full = await fetchMedia();
    expect(full.status).toBe(200);
    expect(full.headers.get("Content-Length")).toBe("10");
    expect(full.headers.get("Accept-Ranges")).toBe("bytes");
    expect(new TextDecoder().decode(await full.arrayBuffer())).toBe("0123456789");
    const bounded = await fetchMedia("bytes=2-5");
    expect(bounded.status).toBe(206);
    expect(bounded.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(new TextDecoder().decode(await bounded.arrayBuffer())).toBe("2345");
    const open = await fetchMedia("bytes=7-");
    expect(new TextDecoder().decode(await open.arrayBuffer())).toBe("789");
    const suffix = await fetchMedia("bytes=-3");
    expect(new TextDecoder().decode(await suffix.arrayBuffer())).toBe("789");
    const malformed = await fetchMedia("bytes=2-5,7-8");
    expect(malformed.status).toBe(200);
    const unsatisfiable = await fetchMedia("bytes=99-");
    expect(unsatisfiable.status).toBe(416);
    expect(unsatisfiable.headers.get("Content-Range")).toBe("bytes */10");
  });
});
