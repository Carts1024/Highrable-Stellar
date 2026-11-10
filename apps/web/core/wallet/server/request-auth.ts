import type { NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE_NAME } from "./auth-store";
import { getPersistedSessionFromRequest } from "./persisted-session";
import { assertSameOrigin } from "./same-origin";

export class WalletRequestAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "WalletRequestAuthError";
    this.status = status;
  }
}

export async function requireWalletRequestContext(request: NextRequest): Promise<{
  sessionId: string;
  walletAddress: string;
  walletType: "external_wallet" | "passkey_smart_account";
  authMethod: "external_wallet" | "passkey";
  profile: NonNullable<
    Awaited<ReturnType<typeof getPersistedSessionFromRequest>>
  >["session"]["profile"];
}> {
  assertSameOrigin(request);
  const sessionId = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionId) {
    throw new WalletRequestAuthError("Wallet authentication is required.");
  }

  let persisted;
  try {
    persisted = await getPersistedSessionFromRequest(request);
  } catch {
    throw new WalletRequestAuthError("Wallet authentication could not be verified.", 503);
  }

  if (!persisted) {
    throw new WalletRequestAuthError("Wallet session has expired or was revoked.");
  }

  return {
    sessionId: persisted.sessionId,
    walletAddress: persisted.session.walletAddress,
    walletType: persisted.session.walletType,
    authMethod: persisted.session.authMethod,
    profile: persisted.session.profile,
  };
}
