import { env } from "@/core/config/env";
import { getPersistedSessionFromRequest } from "@/core/wallet/server/persisted-session";
import { assertSameOrigin } from "@/core/wallet/server/same-origin";

import type { NextRequest } from "next/server";

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

export function assertAdminApiSecret(secret: string): string {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret) {
    throw new AdminAccessError("Admin API secret is not configured.", 500);
  }

  return normalizedSecret;
}

export async function requireAdminRequestContext(
  request: NextRequest,
): Promise<IAdminRequestContext> {
  assertSameOrigin(request);
  let persisted;
  try {
    persisted = await getPersistedSessionFromRequest(request);
  } catch {
    throw new AdminAccessError("Admin session could not be verified.", 503);
  }
  if (!persisted) {
    throw new AdminAccessError("Missing or expired admin session cookie.", 401);
  }
  if (persisted.session.walletType !== "external_wallet") {
    throw new AdminAccessError("Admin access requires an external wallet session.", 403);
  }

  return {
    adminWallet: persisted.session.walletAddress.toUpperCase(),
    adminApiSecret: assertAdminApiSecret(env.HIGHRABLE_ADMIN_CONVEX_SECRET ?? ""),
  };
}
