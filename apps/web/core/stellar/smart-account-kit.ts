"use client";

import {
  getSmartAccountConfigOrThrow,
  PasskeyConfigError,
} from "@/core/stellar/smart-account-config";
import { IndexedDBStorage, LocalStorageAdapter, SmartAccountKit } from "smart-account-kit";

import type { StorageAdapter } from "smart-account-kit";

type TSmartAccountKit = InstanceType<typeof SmartAccountKit>;

let smartAccountKit: TSmartAccountKit | null = null;

function createStorage(): StorageAdapter {
  if (typeof window === "undefined") {
    throw new PasskeyConfigError("Passkey smart accounts can only be initialized in the browser.");
  }

  if ("indexedDB" in window) {
    return new IndexedDBStorage("highrable-passkey-smart-accounts");
  }

  return new LocalStorageAdapter("highrable-passkey-smart-accounts");
}

export function getSmartAccountKit(): TSmartAccountKit {
  if (typeof window === "undefined") {
    throw new PasskeyConfigError("Passkey smart accounts can only be initialized in the browser.");
  }

  if (smartAccountKit) {
    return smartAccountKit;
  }

  const config = getSmartAccountConfigOrThrow();

  smartAccountKit = new SmartAccountKit({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    accountWasmHash: config.accountWasmHash,
    webauthnVerifierAddress: config.webauthnVerifierAddress,
    rpName: config.rpName,
    storage: createStorage(),
  });

  return smartAccountKit;
}
