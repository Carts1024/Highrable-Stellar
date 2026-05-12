"use client";

import { TChallengeRequestSchema, TVerifyRequestSchema } from "@/core/wallet/validation";

import type { IWalletAuthService, TAuthChallenge, TAuthSession } from "@/core/wallet/types";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Authentication request failed");
  }

  return (await response.json()) as T;
}

export class StellarAuthService implements IWalletAuthService {
  public async createChallenge(address: string): Promise<TAuthChallenge> {
    const payload = TChallengeRequestSchema.parse({ address });

    const response = await fetch("/api/auth/stellar/challenge", {
      method: "POST",
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return parseResponse<TAuthSession>(response);
  }
}
