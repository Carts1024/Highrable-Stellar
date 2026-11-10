import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "../../convex/_generated/api";
import { assertSharedStorage, hash } from "../../convex/newsfeed/photos";
import schema from "../../convex/schema";
import { modules } from "../convexModules";
const serviceSecret = "photo-test-secret";
const auth = { serviceSecret, sessionId: "session", walletAddress: "GPHOTO" };
const photosApi = api.newsfeed.photos;
const photosInternal = internal.newsfeed.photos;
beforeEach(() => {
  process.env.HIGHRABLE_AUTH_SERVICE_SECRET = serviceSecret;
  process.env.NEWSFEED_ENABLED = "true";
  process.env.NEWSFEED_TEXT_ENABLED = "true";
  process.env.NEWSFEED_PHOTOS_ENABLED = "true";
});
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      walletAddress: auth.walletAddress,
      name: "Photo Member",
      onboardingCompletedAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("authSessions", {
      sessionId: auth.sessionId,
      walletAddress: auth.walletAddress,
      walletType: "external_wallet",
      authMethod: "external_wallet",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
    });
  });
  return t;
}
async function ready(t: Awaited<ReturnType<typeof setup>>) {
  const credentialHash = await hash(crypto.randomUUID());
  const { uploadId } = await t.mutation(photosApi.reserve, { ...auth, credentialHash });
  await t.mutation(photosInternal.claim, { uploadId, credentialHash });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["test"], { type: "application/x-highrable-newsfeed" })),
  );
  await t.mutation(photosInternal.finalize, {
    uploadId,
    storageId,
    format: "png",
    size: 4,
    width: 1,
    height: 1,
  });
  return { uploadId, storageId, credentialHash, description: "A tiny test photo" };
}
describe("newsfeed photo lifecycle", () => {
  it("publishes four ordered photos, deduplicates retries, permits empty text edits and protects attached files from cleanup", async () => {
    const t = await setup();
    const uploads = await Promise.all(Array.from({ length: 4 }, () => ready(t)));
    const args = {
      ...auth,
      text: "",
      publicationMode: "client" as const,
      requestId: "four",
      photos: uploads.map(({ uploadId, description }) => ({ uploadId, description })),
    };
    const first = await t.mutation(api.newsfeed.createPost, args);
    expect((await t.mutation(api.newsfeed.createPost, args)).postId).toBe(first.postId);
    await expect(
      t.mutation(api.newsfeed.createPost, { ...args, photos: [...args.photos].reverse() }),
    ).rejects.toThrow(/different payload/);
    await t.mutation(api.newsfeed.updatePost, { ...auth, postId: first.postId, text: "" });
    await t.mutation(photosInternal.cleanup, {});
    const dto = await t.query(api.newsfeed.getPost, { ...auth, postId: first.postId });
    expect(dto?.photos.map((p) => p.mediaId)).toEqual(uploads.map((p) => p.uploadId));
    expect(JSON.stringify(dto)).not.toContain(uploads[0]!.storageId);
    expect(dto?.author.publicationMode).toBe("client");
  });
  it("rejects five, duplicate photos, missing descriptions and unready uploads", async () => {
    const t = await setup();
    const photo = await ready(t);
    const args = {
      ...auth,
      requestId: "invalid",
      publicationMode: "freelancer" as const,
      text: "",
      photos: [{ uploadId: photo.uploadId, description: photo.description }],
    };
    await expect(
      t.mutation(api.newsfeed.createPost, { ...args, photos: Array(5).fill(args.photos[0]) }),
    ).rejects.toThrow(/four/);
    await expect(
      t.mutation(api.newsfeed.createPost, { ...args, photos: [...args.photos, ...args.photos] }),
    ).rejects.toThrow(/distinct/);
    await expect(
      t.mutation(api.newsfeed.createPost, {
        ...args,
        photos: [{ uploadId: photo.uploadId, description: " " }],
      }),
    ).rejects.toThrow(/description/);
    await t.mutation(photosApi.cancel, { ...auth, uploadId: photo.uploadId });
    await expect(t.mutation(api.newsfeed.createPost, args)).rejects.toThrow(/unavailable/);
    await t.mutation(photosInternal.cleanup, {});
    expect(await t.run((ctx) => ctx.storage.get(photo.storageId))).toBeNull();
  });
  it("checks ownership, credential replay, session revocation, and shared storage bypasses", async () => {
    const t = await setup();
    const photo = await ready(t);
    await expect(
      t.mutation(photosInternal.claim, {
        uploadId: photo.uploadId,
        credentialHash: photo.credentialHash,
      }),
    ).rejects.toThrow(/credential/);
    await expect(
      t.mutation(photosApi.reserve, {
        ...auth,
        serviceSecret: "wrong",
        credentialHash: "a".repeat(64),
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(photosApi.cancel, { ...auth, walletAddress: "GOTHER", uploadId: photo.uploadId }),
    ).rejects.toThrow();
    await expect(t.run((ctx) => assertSharedStorage(ctx, photo.storageId))).rejects.toThrow(
      /cannot be shared/,
    );
    await t.run(async (ctx) => {
      const session = await ctx.db.query("authSessions").first();
      await ctx.db.patch(session!._id, { revokedAt: Date.now() });
    });
    await expect(
      t.mutation(photosApi.reserve, { ...auth, credentialHash: "a".repeat(64) }),
    ).rejects.toThrow(/revoked/);
  });
  it("enforces active reservations and cancels before finalization", async () => {
    const t = await setup();
    const ids = [];
    for (let i = 0; i < 8; i++)
      ids.push(
        (await t.mutation(photosApi.reserve, { ...auth, credentialHash: "a".repeat(64) })).uploadId,
      );
    await expect(
      t.mutation(photosApi.reserve, { ...auth, credentialHash: "a".repeat(64) }),
    ).rejects.toThrow(/Eight/);
    await t.mutation(photosInternal.claim, { uploadId: ids[0]!, credentialHash: "a".repeat(64) });
    await t.mutation(photosApi.cancel, { ...auth, uploadId: ids[0]! });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["test"])));
    await expect(
      t.mutation(photosInternal.finalize, {
        uploadId: ids[0]!,
        storageId,
        format: "png",
        size: 4,
        width: 1,
        height: 1,
      }),
    ).rejects.toThrow(/cancelled/);
  });
  it("rechecks hidden/deleted visibility and feature flags on every read, including moderator access", async () => {
    const t = await setup();
    const photo = await ready(t);
    const { postId } = await t.mutation(api.newsfeed.createPost, {
      ...auth,
      requestId: "media",
      publicationMode: "client",
      text: "",
      photos: [{ uploadId: photo.uploadId, description: "Picture" }],
    });
    const credentialHash = await hash("read-token");
    await t.mutation(photosApi.authorizeRead, {
      ...auth,
      mediaId: photo.uploadId,
      moderation: false,
      credentialHash,
    });
    expect((await t.query(photosInternal.read, { credentialHash })).storageId).toBe(
      photo.storageId,
    );
    await t.run((ctx) => ctx.db.patch(postId, { visibility: "moderation_hidden" }));
    await expect(t.query(photosInternal.read, { credentialHash })).rejects.toThrow(/unavailable/);
    await expect(
      t.mutation(photosApi.authorizeRead, {
        ...auth,
        mediaId: photo.uploadId,
        moderation: true,
        credentialHash: "mod",
      }),
    ).rejects.toThrow();
    process.env.NEWSFEED_MODERATOR_WALLETS = auth.walletAddress;
    await t.mutation(photosApi.authorizeRead, {
      ...auth,
      mediaId: photo.uploadId,
      moderation: true,
      credentialHash: "mod",
    });
    expect((await t.query(photosInternal.read, { credentialHash: "mod" })).storageId).toBe(
      photo.storageId,
    );
    await t.run((ctx) => ctx.db.patch(postId, { visibility: "visible" }));
    process.env.NEWSFEED_PHOTOS_ENABLED = "false";
    await expect(t.query(photosInternal.read, { credentialHash })).rejects.toThrow();
    process.env.NEWSFEED_PHOTOS_ENABLED = "true";
    await t.mutation(api.newsfeed.deletePost, { ...auth, postId });
    await expect(t.query(photosInternal.read, { credentialHash: "mod" })).rejects.toThrow();
    await t.mutation(photosInternal.cleanup, {});
    expect(await t.run((ctx) => ctx.storage.get(photo.storageId))).toBeNull();
  });
});

it("expires unattached uploads and preserves finalized files after a lost response", async () => {
  const t = await setup();
  const photo = await ready(t);
  await t.mutation(photosInternal.discardUnassociated, { storageId: photo.storageId });
  expect(await t.run(async (ctx) => (await ctx.storage.get(photo.storageId)) !== null)).toBe(true);
  await t.run((ctx) => ctx.db.patch(photo.uploadId, { expiresAt: 0 }));
  await expect(
    t.mutation(api.newsfeed.createPost, {
      ...auth,
      text: "",
      publicationMode: "client",
      requestId: "expired",
      photos: [{ uploadId: photo.uploadId, description: "Expired" }],
    }),
  ).rejects.toThrow(/unavailable/);
  await t.mutation(photosInternal.cleanup, {});
  expect(await t.run((ctx) => ctx.storage.get(photo.storageId))).toBeNull();
});

it("rejects incomplete profiles, another authenticated member's upload, expired credentials and reservation bursts", async () => {
  const t = await setup();
  const photo = await ready(t);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      walletAddress: "GOTHER",
      name: "Other Member",
      onboardingCompletedAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("authSessions", {
      sessionId: "other-session",
      walletAddress: "GOTHER",
      walletType: "external_wallet",
      authMethod: "external_wallet",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600_000,
    });
  });
  await expect(
    t.mutation(api.newsfeed.createPost, {
      serviceSecret,
      sessionId: "other-session",
      walletAddress: "GOTHER",
      text: "",
      publicationMode: "client",
      requestId: "stolen",
      photos: [{ uploadId: photo.uploadId, description: "Stolen" }],
    }),
  ).rejects.toThrow(/unavailable/);
  const digest = await hash("expired");
  const { uploadId } = await t.mutation(photosApi.reserve, { ...auth, credentialHash: digest });
  await t.run((ctx) => ctx.db.patch(uploadId, { credentialExpiresAt: 0 }));
  await expect(
    t.mutation(photosInternal.claim, { uploadId, credentialHash: digest }),
  ).rejects.toThrow(/credential/);
  await t.mutation(photosApi.cancel, { ...auth, uploadId });
  for (let i = 0; i < 8; i++) {
    const reserved = await t.mutation(photosApi.reserve, { ...auth, credentialHash: digest });
    await t.mutation(photosApi.cancel, { ...auth, ...reserved });
  }
  await expect(t.mutation(photosApi.reserve, { ...auth, credentialHash: digest })).rejects.toThrow(
    /limit/,
  );
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", "GOTHER"))
      .unique();
    await ctx.db.patch(user!._id, { name: "" });
  });
  await expect(
    t.mutation(photosApi.reserve, {
      serviceSecret,
      sessionId: "other-session",
      walletAddress: "GOTHER",
      credentialHash: digest,
    }),
  ).rejects.toThrow(/named profile/);
});

it("blocks unapproved HTTP origins and credentials before receiving bytes", async () => {
  const t = await setup();
  process.env.NEWSFEED_APP_ORIGINS = "https://app.example.test";
  const denied = await t.fetch("/newsfeed/photos", {
    method: "POST",
    headers: { Origin: "https://evil.example.test" },
    body: "forged",
  });
  expect(denied.status).toBe(403);
  expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  const missing = await t.fetch("/newsfeed/photos", {
    method: "POST",
    headers: { Origin: "https://app.example.test" },
    body: "forged",
  });
  expect(missing.status).toBe(400);
  expect(missing.headers.get("Cache-Control")).toBe("private, no-store");
});

it("transfers and serves validated bytes through the authenticated HTTP path without trusting supplied MIME", async () => {
  const t = await setup();
  process.env.NEWSFEED_APP_ORIGINS = "https://app.example.test";
  const token = "http-upload-token";
  const { uploadId } = await t.mutation(photosApi.reserve, {
    ...auth,
    credentialHash: await hash(token),
  });
  const bytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVR4nGP4z8DwnwGM/zMwAAAf7gP9NRsAMwAAAABJRU5ErkJggg==",
    ),
    (c) => c.charCodeAt(0),
  );
  const response = await t.fetch(`/newsfeed/photos?uploadId=${uploadId}`, {
    method: "POST",
    headers: {
      Origin: "https://app.example.test",
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: bytes,
  });
  expect(response.status).toBe(200);
  const { postId } = await t.mutation(api.newsfeed.createPost, {
    ...auth,
    text: "",
    publicationMode: "freelancer",
    requestId: "http-photo",
    photos: [{ uploadId, description: "A red square" }],
  });
  await t.mutation(photosApi.authorizeRead, {
    ...auth,
    mediaId: uploadId,
    moderation: false,
    credentialHash: await hash("http-read-token"),
  });
  const get = () =>
    t.fetch("/newsfeed/photos", {
      headers: { Origin: "https://app.example.test", Authorization: "Bearer http-read-token" },
    });
  const media = await get();
  expect(media.status).toBe(200);
  expect(media.headers.get("Content-Type")).toBe("image/png");
  expect(new Uint8Array(await media.arrayBuffer())).toEqual(bytes);
  await t.mutation(api.newsfeed.deletePost, { ...auth, postId });
  expect((await get()).status).toBe(400);
});

it("reconciles aged marked orphans while preserving other domains and shared references", async () => {
  const t = await setup();
  const orphan = await t.run((ctx) =>
    ctx.storage.store(new Blob(["orphan"], { type: "application/x-highrable-newsfeed" })),
  );
  const otherDomain = await t.run((ctx) =>
    ctx.storage.store(new Blob(["other"], { type: "image/png" })),
  );
  const referenced = await t.run((ctx) =>
    ctx.storage.store(new Blob(["legacy"], { type: "application/x-highrable-newsfeed" })),
  );
  await t.run(async (ctx) => {
    const user = await ctx.db.query("users").first();
    await ctx.db.patch(user!._id, { avatarStorageId: referenced });
  });
  // convex-test 0.0.60 omits Blob.type in its storeBlob implementation.
  // Seed the system metadata that production Convex writes for marked blobs.
  await t.run(async (ctx) => {
    const fixtureDb = ctx.db as unknown as {
      patch(id: string, value: { contentType: string }): Promise<void>;
    };
    await fixtureDb.patch(orphan, { contentType: "application/x-highrable-newsfeed" });
    await fixtureDb.patch(referenced, { contentType: "application/x-highrable-newsfeed" });
  });
  vi.setSystemTime(Date.now() + 2 * 86_400_000);
  process.env.NEWSFEED_PHOTOS_ENABLED = "false";
  await t.mutation(photosInternal.cleanup, {});
  expect(await t.run((ctx) => ctx.db.system.get(orphan))).toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(otherDomain))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.system.get(referenced))).not.toBeNull();
});
