import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { env } from "@/core/config/env";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TOKEN_VERSION = 1;
const AUTH_CHALLENGE_COOKIE_NAME = "highrable_auth_challenge";
const AUTH_SESSION_COOKIE_NAME = "highrable_auth_session";
const DEFAULT_DEVELOPMENT_SESSION_SECRET = "highrable-dev-session-secret";

type TChallengeRecord = {
  address: string;
  message: string;
  nonce: string;
  expiresAt: number;
  issuedAt: number;
};

export type TSessionTokenPayload = {
  sub: string;
  exp: number;
  iat: number;
  sid: string;
  ver: number;
};

const usedNonceStore = new Map<string, number>();
let hasWarnedAboutDevelopmentSecret = false;

function cleanupExpired(now: number): void {
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

function signaturesMatch(expectedSignature: string, receivedSignature: string): boolean {
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedSignatureBuffer = Buffer.from(receivedSignature, "utf8");

  return (
    expectedSignatureBuffer.length === receivedSignatureBuffer.length &&
    timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer)
  );
}

function parseTokenPart(tokenPart: string): string | null {
  try {
    return Buffer.from(tokenPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function buildChallengeMessage(input: {
  address: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}): string {
  return [
    "Highrable Sign-In Request",
    `Domain: ${env.NEXT_PUBLIC_APP_DOMAIN}`,
    `Address: ${input.address}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${new Date(input.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(input.expiresAt).toISOString()}`,
    "Network: stellar:testnet",
  ].join("\n");
}

function createSignedChallengeToken(payload: TChallengeRecord): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSignedChallengeToken(tokenInput: string): TChallengeRecord | null {
  const token = tokenInput.trim();
  const [encodedPayload, encodedSignature, ...rest] = token.split(".");
  if (!encodedPayload || !encodedSignature || rest.length > 0) {
    return null;
  }

  if (!signaturesMatch(signTokenPayload(encodedPayload), encodedSignature)) {
    return null;
  }

  const rawPayload = parseTokenPart(encodedPayload);
  if (!rawPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(rawPayload) as Partial<TChallengeRecord>;
    if (
      typeof payload.address !== "string" ||
      typeof payload.message !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.expiresAt !== "number" ||
      typeof payload.issuedAt !== "number"
    ) {
      return null;
    }

    return {
      address: TStellarPublicKeySchema.parse(payload.address),
      message: payload.message,
      nonce: payload.nonce,
      expiresAt: payload.expiresAt,
      issuedAt: payload.issuedAt,
    };
  } catch {
    return null;
  }
}

export function createChallenge(addressInput: string): {
  nonce: string;
  message: string;
  expiresAt: string;
  challengeToken: string;
} {
  const now = Date.now();
  cleanupExpired(now);

  const address = TStellarPublicKeySchema.parse(addressInput);
  const issuedAt = now;
  const expiresAt = now + CHALLENGE_TTL_MS;
  const nonce = randomUUID();
  const message = buildChallengeMessage({ address, nonce, issuedAt, expiresAt });
  const challengeToken = createSignedChallengeToken({
    address,
    message,
    nonce,
    expiresAt,
    issuedAt,
  });

  return {
    nonce,
    message,
    expiresAt: new Date(expiresAt).toISOString(),
    challengeToken,
  };
}

export function validateChallenge(input: {
  address: string;
  message: string;
  nonce: string;
  challengeToken: string;
}): {
  valid: boolean;
  error?: string;
} {
  const now = Date.now();
  cleanupExpired(now);

  const challenge = parseSignedChallengeToken(input.challengeToken);
  if (!challenge) {
    return { valid: false, error: "Challenge not found or expired." };
  }

  if (challenge.expiresAt <= now) {
    return { valid: false, error: "Challenge has expired." };
  }

  if (usedNonceStore.has(input.nonce)) {
    return { valid: false, error: "Challenge nonce has already been used." };
  }

  const address = TStellarPublicKeySchema.parse(input.address);
  const expectedMessage = buildChallengeMessage({
    address: challenge.address,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
  });

  if (
    challenge.address !== address ||
    challenge.nonce !== input.nonce ||
    challenge.message !== expectedMessage ||
    input.message !== expectedMessage ||
    challenge.message !== input.message
  ) {
    return { valid: false, error: "Challenge payload mismatch." };
  }

  return { valid: true };
}

export function consumeChallenge(input: { nonce: string; challengeToken: string }): {
  valid: boolean;
  error?: string;
} {
  const now = Date.now();
  cleanupExpired(now);

  const nonce = input.nonce.trim();
  const challenge = parseSignedChallengeToken(input.challengeToken);

  if (!challenge || challenge.nonce !== nonce) {
    return { valid: false, error: "Challenge not found or expired." };
  }

  if (challenge.expiresAt <= now) {
    return { valid: false, error: "Challenge has expired." };
  }

  if (usedNonceStore.has(nonce)) {
    return { valid: false, error: "Challenge nonce has already been used." };
  }

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
  if (!signaturesMatch(expectedSignature, encodedSignature)) {
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

export { AUTH_CHALLENGE_COOKIE_NAME, AUTH_SESSION_COOKIE_NAME, CHALLENGE_TTL_MS };
