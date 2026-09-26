import type { NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE_NAME, verifySessionToken } from "./auth-store";

export class WalletRequestAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "WalletRequestAuthError";
    this.status = status;
  }
}

export function requireWalletRequestContext(request: NextRequest): {
  walletAddress: string;
} {
  const token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new WalletRequestAuthError("Wallet authentication is required.");
  }

  const verification = verifySessionToken(token);
  if (!verification.valid || !verification.session) {
    throw new WalletRequestAuthError(verification.error ?? "Invalid wallet session.");
  }

  return { walletAddress: verification.session.sub };
}
