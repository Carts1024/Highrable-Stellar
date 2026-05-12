import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { env } from "@/core/config/env";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TOKEN_VERSION = 1;
const AUTH_SESSION_COOKIE_NAME = "highrable_auth_session";
const DEFAULT_DEVELOPMENT_SESSION_SECRET = "highrable-dev-session-secret";

type TChallengeRecord = {
  address: string;
  message: string;
  expiresAt: number;
};

export type TSessionTokenPayload = {
  sub: string;
  exp: number;
  iat: number;
  sid: string;
  ver: number;
};

const challengeStore = new Map<string, TChallengeRecord>();
const usedNonceStore = new Map<string, number>();
let hasWarnedAboutDevelopmentSecret = false;

function cleanupExpired(now: number): void {
  for (const [nonce, challenge] of challengeStore.entries()) {
    if (challenge.expiresAt <= now) {
      challengeStore.delete(nonce);
    }
  }

  for (const [nonce, expiresAt] of usedNonceStore.entries()) {
    if (expiresAt <= now) {
      usedNonceStore.delete(nonce);
    }
  }
}

function getSessionSecret(): string {
  const envSecret = env.WALLET_SESSION_SECRET;

  if (envSecret) {
    return envSecret;
  }

  if (env.NODE_ENV === "production") {
    throw new Error("WALLET_SESSION_SECRET must be set in production.");
  }

  if (!hasWarnedAboutDevelopmentSecret) {
    hasWarnedAboutDevelopmentSecret = true;
    console.warn(
      "WALLET_SESSION_SECRET is not set. Falling back to a development-only session secret.",
    );
  }

  return DEFAULT_DEVELOPMENT_SESSION_SECRET;
}

function signTokenPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

function parseTokenPart(tokenPart: string): string | null {
  try {
    return Buffer.from(tokenPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function createChallenge(addressInput: string): {
  nonce: string;
  message: string;
  expiresAt: string;
} {
  const now = Date.now();
  cleanupExpired(now);

  const address = TStellarPublicKeySchema.parse(addressInput);
  const nonce = randomUUID();
  const expiresAt = now + CHALLENGE_TTL_MS;
  const domain = env.NEXT_PUBLIC_APP_DOMAIN;

  const message = [
    "Highrable Sign-In Request",
    `Domain: ${domain}`,
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(now).toISOString()}`,
    `Expiration Time: ${new Date(expiresAt).toISOString()}`,
    "Network: stellar:testnet",
  ].join("\n");

  challengeStore.set(nonce, { address, message, expiresAt });

  return { nonce, message, expiresAt: new Date(expiresAt).toISOString() };
}

export function validateChallenge(input: { address: string; message: string; nonce: string }): {
  valid: boolean;
  error?: string;
} {
  const now = Date.now();
  cleanupExpired(now);

  const record = challengeStore.get(input.nonce);
  if (!record) {
    return { valid: false, error: "Challenge not found or expired." };
  }

  if (record.expiresAt <= now) {
    challengeStore.delete(input.nonce);
    return { valid: false, error: "Challenge has expired." };
  }

  if (usedNonceStore.has(input.nonce)) {
    return { valid: false, error: "Challenge nonce has already been used." };
  }

  if (record.address !== input.address || record.message !== input.message) {
    return { valid: false, error: "Challenge payload mismatch." };
  }

  return { valid: true };
}

export function consumeChallenge(nonceInput: string): { valid: boolean; error?: string } {
  const now = Date.now();
  cleanupExpired(now);

  const nonce = nonceInput.trim();
  const record = challengeStore.get(nonce);

  if (!record) {
    return { valid: false, error: "Challenge not found or expired." };
  }

  if (record.expiresAt <= now) {
    challengeStore.delete(nonce);
    return { valid: false, error: "Challenge has expired." };
  }

  if (usedNonceStore.has(nonce)) {
    return { valid: false, error: "Challenge nonce has already been used." };
  }

  challengeStore.delete(nonce);
  usedNonceStore.set(nonce, now + SESSION_TTL_MS);

  return { valid: true };
}

export function createSessionToken(addressInput: string): {
  token: string;
  expiresAt: string;
} {
  const address = TStellarPublicKeySchema.parse(addressInput);
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + SESSION_TTL_MS;
  const tokenPayload: TSessionTokenPayload = {
    sub: address,
    exp: expiresAtMs,
    iat: issuedAtMs,
    sid: randomUUID(),
    ver: SESSION_TOKEN_VERSION,
  };

  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
  const signature = signTokenPayload(encodedPayload);
  const token = `${encodedPayload}.${signature}`;
  return { token, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function verifySessionToken(tokenInput: string): {
  valid: boolean;
  session?: TSessionTokenPayload;
  error?: string;
} {
  const token = tokenInput.trim();
  const [encodedPayload, encodedSignature, ...rest] = token.split(".");

  if (!encodedPayload || !encodedSignature || rest.length > 0) {
    return { valid: false, error: "Invalid session token format." };
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedSignatureBuffer = Buffer.from(encodedSignature, "utf8");

  if (
    expectedSignatureBuffer.length !== receivedSignatureBuffer.length ||
    !timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer)
  ) {
    return { valid: false, error: "Invalid session token signature." };
  }

  const rawPayload = parseTokenPart(encodedPayload);

  if (!rawPayload) {
    return { valid: false, error: "Invalid session token payload encoding." };
  }

  try {
    const parsedPayload = JSON.parse(rawPayload) as Partial<TSessionTokenPayload>;

    if (
      typeof parsedPayload.sub !== "string" ||
      typeof parsedPayload.exp !== "number" ||
      typeof parsedPayload.iat !== "number" ||
      typeof parsedPayload.sid !== "string" ||
      parsedPayload.ver !== SESSION_TOKEN_VERSION
    ) {
      return { valid: false, error: "Invalid session token payload." };
    }

    const address = TStellarPublicKeySchema.parse(parsedPayload.sub);

    if (parsedPayload.exp <= Date.now()) {
      return { valid: false, error: "Session token has expired." };
    }

    return {
      valid: true,
      session: {
        sub: address,
        exp: parsedPayload.exp,
        iat: parsedPayload.iat,
        sid: parsedPayload.sid,
        ver: parsedPayload.ver,
      },
    };
  } catch {
    return { valid: false, error: "Invalid session token payload." };
  }
}

export { AUTH_SESSION_COOKIE_NAME };
