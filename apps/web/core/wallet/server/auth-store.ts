import { randomUUID } from "crypto";

import { TStellarPublicKeySchema } from "@/core/wallet/validation";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type TChallengeRecord = {
  address: string;
  message: string;
  expiresAt: number;
};

const challengeStore = new Map<string, TChallengeRecord>();
const usedNonceStore = new Map<string, number>();

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
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost";

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

export function consumeChallenge(input: {
  address: string;
  message: string;
  nonce: string;
}): { valid: boolean; error?: string } {
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

  challengeStore.delete(input.nonce);
  usedNonceStore.set(input.nonce, now + SESSION_TTL_MS);

  return { valid: true };
}

export function createSessionToken(addressInput: string): {
  token: string;
  expiresAt: string;
} {
  const address = TStellarPublicKeySchema.parse(addressInput);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const tokenPayload = {
    sub: address,
    exp: expiresAtMs,
    iat: Date.now(),
    sid: randomUUID(),
  };

  const token = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
  return { token, expiresAt: new Date(expiresAtMs).toISOString() };
}
