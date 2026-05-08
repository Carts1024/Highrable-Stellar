"use client";

import { usePasskeySmartAccountContext } from "@/core/wallet/context/passkey-smart-account-context";

export function usePasskeySmartAccount() {
  return usePasskeySmartAccountContext();
}
