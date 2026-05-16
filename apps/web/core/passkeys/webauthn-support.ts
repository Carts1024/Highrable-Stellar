"use client";

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean | null> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return null;
  }
}
