"use client";

import { startAuthentication } from "@simplewebauthn/browser";

import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import type { TAuthSession } from "@/core/wallet/types";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(body?.error ?? "Passkey authentication failed.");
  }
  return body;
}

export async function authenticatePasskeySession(
  address: string,
  credentialId: string,
): Promise<TAuthSession> {
  const optionsResponse = await fetch("/api/auth/passkey/options", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, credentialId }),
  });
  const options = await readJson<{ options: PublicKeyCredentialRequestOptionsJSON }>(optionsResponse);
  const assertion: AuthenticationResponseJSON = await startAuthentication({
    optionsJSON: options.options,
  });
  const verifyResponse = await fetch("/api/auth/passkey/verify", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, credentialId, response: assertion }),
  });
  return await readJson<TAuthSession>(verifyResponse);
}
