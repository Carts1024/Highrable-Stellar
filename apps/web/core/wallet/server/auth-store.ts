import { randomUUID } from "crypto";

import { env } from "@/core/config/env";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const AUTH_BROWSER_BINDING_COOKIE_NAME = "highrable_auth_browser";
export const AUTH_CHALLENGE_COOKIE_NAME = "highrable_auth_challenge";
export const AUTH_SESSION_COOKIE_NAME = "highrable_auth_session";

/** Opaque IDs are persisted in Convex; no bearer token is returned to the browser. */
export function createOpaqueId(): string {
  return randomUUID();
}

export function getClientAddress(request: { headers: Headers }): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function buildExternalChallengeMessage(input: {
  address: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}): string {
  const stellarNetwork =
    env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" || env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
      ? "stellar:pubnet"
      : "stellar:testnet";

  return [
    "Highrable Sign-In Request",
    `Domain: ${env.NEXT_PUBLIC_APP_DOMAIN}`,
    `Address: ${input.address}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${new Date(input.issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(input.expiresAt).toISOString()}`,
    `Network: ${stellarNetwork}`,
  ].join("\n");
}
