import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it, beforeAll } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";

import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../convexModules";

type BackendTest = TestConvex<typeof schema>;

const SERVICE_SECRET = "newsfeed-test-service-secret";
const MEMBER_WALLET = "GNEWSFEEDMEMBER";
const OTHER_WALLET = "GNEWSFEEDOTHER";
const MODERATOR_WALLET = "CNEWSFEEDMODERATOR";

beforeAll(() => {
  process.env.HIGHRABLE_AUTH_SERVICE_SECRET = SERVICE_SECRET;
  process.env.NEWSFEED_ENABLED = "true";
  process.env.NEWSFEED_TEXT_ENABLED = "true";
  process.env.NEWSFEED_MODERATOR_WALLETS = MODERATOR_WALLET;
});

type TSeededMember = {
  userId: Id<"users">;
  sessionId: string;
  walletAddress: string;
};

async function seedMember(
  t: BackendTest,
  walletAddress: string,
  sessionId: string,
): Promise<TSeededMember> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      walletAddress,
      walletType: walletAddress.startsWith("C") ? "passkey_smart_account" : "external_wallet",
      firstName: "Test",
      lastName: walletAddress === OTHER_WALLET ? "Other" : "Member",
      name: walletAddress === OTHER_WALLET ? "Test Other" : "Test Member",
      onboardingCompletedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("authSessions", {
      sessionId,
      walletAddress,
      walletType: walletAddress.startsWith("C") ? "passkey_smart_account" : "external_wallet",
      authMethod: walletAddress.startsWith("C") ? "passkey" : "external_wallet",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
    return { userId, sessionId, walletAddress };
  });
}

function memberArgs(member: TSeededMember) {
  return {
    serviceSecret: SERVICE_SECRET,
    sessionId: member.sessionId,
    walletAddress: member.walletAddress,
  };
}

describe("newsfeed text beta", () => {
  it("creates one post for an identical retry and rejects conflicting request reuse", async () => {
    const t = convexTest(schema, modules);
    const member = await seedMember(t, MEMBER_WALLET, "member-session");
    const first = await t.mutation(api.newsfeed.createPost, {
      ...memberArgs(member),
      requestId: "post-request-1",
      publicationMode: "freelancer",
      text: "Hello community",
    });
    const retry = await t.mutation(api.newsfeed.createPost, {
      ...memberArgs(member),
      requestId: "post-request-1",
      publicationMode: "freelancer",
      text: "Hello community",
    });

    expect(retry.postId).toBe(first.postId);
    expect(retry.duplicate).toBe(true);
    await expect(
      t.mutation(api.newsfeed.createPost, {
        ...memberArgs(member),
        requestId: "post-request-1",
        publicationMode: "client",
        text: "Changed payload",
      }),
    ).rejects.toThrow(/different payload/i);

    const page = await t.query(api.newsfeed.listPosts, {
      ...memberArgs(member),
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.author.publicationMode).toBe("freelancer");
  });

  it("keeps like membership and aggregate counts idempotent", async () => {
    const t = convexTest(schema, modules);
    const member = await seedMember(t, MEMBER_WALLET, "member-session");
    const created = await t.mutation(api.newsfeed.createPost, {
      ...memberArgs(member),
      requestId: "post-request-like",
      publicationMode: "client",
      text: "Like me",
    });

    const liked = await t.mutation(api.newsfeed.setPostLike, {
      ...memberArgs(member),
      postId: created.postId,
      liked: true,
    });
    const repeated = await t.mutation(api.newsfeed.setPostLike, {
      ...memberArgs(member),
      postId: created.postId,
      liked: true,
    });
    const unliked = await t.mutation(api.newsfeed.setPostLike, {
      ...memberArgs(member),
      postId: created.postId,
      liked: false,
    });

    expect(liked.likeCount).toBe(1);
    expect(repeated.likeCount).toBe(1);
    expect(unliked.likeCount).toBe(0);
  });

  it("hides content from ordinary members and keeps author deletion terminal", async () => {
    const t = convexTest(schema, modules);
    const author = await seedMember(t, MEMBER_WALLET, "author-session");
    const reporter = await seedMember(t, OTHER_WALLET, "reporter-session");
    const moderator = await seedMember(t, MODERATOR_WALLET, "moderator-session");
    const created = await t.mutation(api.newsfeed.createPost, {
      ...memberArgs(author),
      requestId: "post-request-moderation",
      publicationMode: "freelancer",
      text: "Needs review",
    });
    const report = await t.mutation(api.newsfeed.createReport, {
      ...memberArgs(reporter),
      requestId: "report-request-1",
      targetType: "post",
      targetId: created.postId,
      reason: "spam",
    });
    await t.mutation(api.newsfeed.applyModerationAction, {
      ...memberArgs(moderator),
      requestId: "moderation-request-1",
      targetType: "post",
      targetId: created.postId,
      action: "hide",
      reason: "Spam confirmed",
      reportId: report.reportId,
    });

    expect(
      await t.query(api.newsfeed.getPost, { ...memberArgs(reporter), postId: created.postId }),
    ).toBeNull();
    await expect(
      t.mutation(api.newsfeed.setPostLike, {
        ...memberArgs(reporter),
        postId: created.postId,
        liked: true,
      }),
    ).rejects.toThrow(/unavailable/i);

    await t.mutation(api.newsfeed.deletePost, { ...memberArgs(author), postId: created.postId });
    await expect(
      t.mutation(api.newsfeed.applyModerationAction, {
        ...memberArgs(moderator),
        requestId: "moderation-request-restore",
        targetType: "post",
        targetId: created.postId,
        action: "restore",
        reason: "Author deletion is terminal",
      }),
    ).rejects.toThrow(/cannot be restored/i);
  });
});
