import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { beforeEach, describe, expect, it } from "vitest";

import schema from "../../convex/schema";
import { modules } from "../convexModules";

const SERVICE_SECRET = "test-member-service-secret";
const WALLET_ADDRESS = `G${"B".repeat(55)}`;

const createChallengeRef = makeFunctionReference<
  "mutation",
  {
    serviceSecret: string;
    challengeId: string;
    nonce: string;
    message: string;
    walletAddress: string;
    walletType: "external_wallet";
    authMethod: "external_wallet";
    browserBinding: string;
    expiresAt: number;
  },
  { challengeId: string; expiresAt: number }
>("auth/mutations:createChallenge");

const consumeChallengeRef = makeFunctionReference<
  "mutation",
  {
    serviceSecret: string;
    challengeId: string;
    browserBinding: string;
    walletAddress: string;
    walletType: "external_wallet";
    authMethod: "external_wallet";
    nonce: string;
    sessionId: string;
  },
  { sessionId: string; walletAddress: string; expiresAt: number }
>("auth/mutations:consumeChallengeAndCreateSession");

const getSessionRef = makeFunctionReference<
  "query",
  { serviceSecret: string; sessionId: string },
  {
    sessionId: string;
    walletAddress: string;
    walletType: "external_wallet";
    authMethod: "external_wallet";
    createdAt: number;
    expiresAt: number;
    profile: null;
  } | null
>("auth/queries:getSession");

const revokeSessionRef = makeFunctionReference<
  "mutation",
  { serviceSecret: string; sessionId: string },
  boolean
>("auth/mutations:revokeSession");

const consumeRateLimitRef = makeFunctionReference<
  "mutation",
  { serviceSecret: string; key: string; limit: number; windowMs: number },
  { allowed: boolean; remaining: number }
>("auth/mutations:consumeRateLimit");

describe("persisted authentication boundary", () => {
  beforeEach(() => {
    process.env.HIGHRABLE_AUTH_SERVICE_SECRET = SERVICE_SECRET;
  });

  it("atomically consumes a challenge and rejects replay", async () => {
    const t = convexTest(schema, modules);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await t.mutation(createChallengeRef, {
      serviceSecret: SERVICE_SECRET,
      challengeId: "challenge-1",
      nonce: "nonce-1",
      message: "Highrable Sign-In Request",
      walletAddress: WALLET_ADDRESS,
      walletType: "external_wallet",
      authMethod: "external_wallet",
      browserBinding: "browser-1",
      expiresAt,
    });

    const session = await t.mutation(consumeChallengeRef, {
      serviceSecret: SERVICE_SECRET,
      challengeId: "challenge-1",
      browserBinding: "browser-1",
      walletAddress: WALLET_ADDRESS,
      walletType: "external_wallet",
      authMethod: "external_wallet",
      nonce: "nonce-1",
      sessionId: "session-1",
    });

    expect(session.walletAddress).toBe(WALLET_ADDRESS);
    await expect(
      t.mutation(consumeChallengeRef, {
        serviceSecret: SERVICE_SECRET,
        challengeId: "challenge-1",
        browserBinding: "browser-1",
        walletAddress: WALLET_ADDRESS,
        walletType: "external_wallet",
        authMethod: "external_wallet",
        nonce: "nonce-1",
        sessionId: "session-2",
      }),
    ).rejects.toThrow(/already been used/);

    await expect(
      t.query(getSessionRef, { serviceSecret: SERVICE_SECRET, sessionId: "session-1" }),
    ).resolves.toMatchObject({ walletAddress: WALLET_ADDRESS });

    await expect(
      t.mutation(revokeSessionRef, { serviceSecret: SERVICE_SECRET, sessionId: "session-1" }),
    ).resolves.toBe(true);
    await expect(
      t.query(getSessionRef, { serviceSecret: SERVICE_SECRET, sessionId: "session-1" }),
    ).resolves.toBeNull();
  });

  it("persists throttling decisions and rejects an invalid service secret", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(createChallengeRef, {
        serviceSecret: "wrong-secret",
        challengeId: "challenge-invalid-secret",
        nonce: "nonce-invalid-secret",
        message: "Highrable Sign-In Request",
        walletAddress: WALLET_ADDRESS,
        walletType: "external_wallet",
        authMethod: "external_wallet",
        browserBinding: "browser-invalid-secret",
        expiresAt: Date.now() + 5 * 60 * 1000,
      }),
    ).rejects.toThrow(/Invalid member service authentication/);

    await expect(
      t.mutation(consumeRateLimitRef, {
        serviceSecret: SERVICE_SECRET,
        key: "verify:test-client",
        limit: 2,
        windowMs: 60_000,
      }),
    ).resolves.toMatchObject({ allowed: true });
    await t.mutation(consumeRateLimitRef, {
      serviceSecret: SERVICE_SECRET,
      key: "verify:test-client",
      limit: 2,
      windowMs: 60_000,
    });
    await expect(
      t.mutation(consumeRateLimitRef, {
        serviceSecret: SERVICE_SECRET,
        key: "verify:test-client",
        limit: 2,
        windowMs: 60_000,
      }),
    ).resolves.toMatchObject({ allowed: false, remaining: 0 });
  });
});
