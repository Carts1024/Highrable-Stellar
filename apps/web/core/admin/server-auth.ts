import { env } from "@/core/config/env";
import {
  AUTH_SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/core/wallet/server/auth-store";
import { TStellarPublicKeySchema } from "@/core/wallet/validation";

import type { NextRequest } from "next/server";

function getConfiguredAdminWalletAddress(): string | null {
  const configuredAddress = env.HIGHRABLE_ADMIN_WALLET_ADDRESS;
  if (!configuredAddress) {
    return null;
  }

  return TStellarPublicKeySchema.parse(configuredAddress).toUpperCase();
}

export class AdminAccessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAccessError";
    this.status = status;
  }
}

export interface IAdminRequestContext {
  readonly adminWallet: string;
  readonly adminApiSecret: string;
}

export function isConfiguredAdminWallet(walletAddress: string): boolean {
  const configuredAdminWallet = getConfiguredAdminWalletAddress();
  if (!configuredAdminWallet) {
    return false;
  }

  const normalizedWallet = TStellarPublicKeySchema.parse(walletAddress).toUpperCase();
  return normalizedWallet === configuredAdminWallet;
}

export function assertConfiguredAdminWallet(walletAddress: string): string {
  const normalizedWallet = TStellarPublicKeySchema.parse(walletAddress).toUpperCase();

  if (!isConfiguredAdminWallet(normalizedWallet)) {
    throw new AdminAccessError(
      "Admin access is restricted to the configured platform wallet.",
      403,
    );
  }

  return normalizedWallet;
}

export function assertAdminApiSecret(secret: string): string {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret) {
    throw new AdminAccessError("Admin API secret is not configured.", 500);
  }

  return normalizedSecret;
}

export function requireAdminRequestContext(request: NextRequest): IAdminRequestContext {
  const token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new AdminAccessError("Missing admin session cookie.", 401);
  }

  const verification = verifySessionToken(token);
  if (!verification.valid || !verification.session) {
    throw new AdminAccessError(verification.error ?? "Invalid session token.", 401);
  }

  const adminWallet = assertConfiguredAdminWallet(verification.session.sub);
  const adminApiSecret = assertAdminApiSecret(env.HIGHRABLE_ADMIN_CONVEX_SECRET ?? "");

  return {
    adminWallet,
    adminApiSecret,
  };
}
