"use client";

import { TChallengeRequestSchema, TVerifyRequestSchema } from "@/core/wallet/validation";

import type { IWalletAuthService, TAuthChallenge, TAuthSession } from "@/core/wallet/types";

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Authentication endpoint returned ${response.status} ${response.statusText || "non-JSON response"}. Restart the web server and retry.`,
    );
  }

  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Authentication request failed");
  }

  if (!data) {
    throw new Error("Authentication endpoint returned an invalid JSON response.");
  }

  return data;
}

export class StellarAuthService implements IWalletAuthService {
  public async createChallenge(address: string): Promise<TAuthChallenge> {
    const payload = TChallengeRequestSchema.parse({ address });

    const response = await fetch("/api/auth/stellar/challenge", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return parseResponse<TAuthChallenge>(response);
  }

  public async verifySignature(input: {
    address: string;
    signature: string;
    message: string;
    nonce: string;
  }): Promise<TAuthSession> {
    const payload = TVerifyRequestSchema.parse(input);

    const response = await fetch("/api/auth/stellar/verify", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return parseResponse<TAuthSession>(response);
  }
}
