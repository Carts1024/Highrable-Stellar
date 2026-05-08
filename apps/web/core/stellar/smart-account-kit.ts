import {
  getValidatedSmartAccountConfig,
  SmartAccountConfigError,
} from "@/core/stellar/smart-account-config";

import type {
  ConnectWalletResult,
  CreateWalletResult,
  SmartAccountKit,
  TransactionResult,
} from "smart-account-kit";

type TSmartAccountKitModule = typeof import("smart-account-kit");

export type TPasskeySmartAccountSession = {
  smartAccountAddress: string;
  credentialId: string;
};

export type TCreatePasskeySmartAccountResult = TPasskeySmartAccountSession & {
  submitResult?: TransactionResult;
};

export type TReconnectPasskeySmartAccountResult = TPasskeySmartAccountSession;

let smartAccountKitPromise: Promise<SmartAccountKit> | null = null;

function assertClientRuntime(): void {
  if (typeof window === "undefined") {
    throw new Error("Passkey smart accounts can only be used in the browser.");
  }
}

function toPasskeySession(
  result: CreateWalletResult | ConnectWalletResult,
): TPasskeySmartAccountSession {
  return {
    smartAccountAddress: result.contractId.trim().toUpperCase(),
    credentialId: result.credentialId.trim(),
  };
}

async function createSmartAccountKit(): Promise<SmartAccountKit> {
  assertClientRuntime();

  const config = getValidatedSmartAccountConfig();
  const smartAccountModule: TSmartAccountKitModule = await import("smart-account-kit");
  const storage =
    "indexedDB" in window
      ? new smartAccountModule.IndexedDBStorage("highrable-passkey-smart-accounts")
      : new smartAccountModule.LocalStorageAdapter("highrable-passkey-smart-accounts");

  return new smartAccountModule.SmartAccountKit({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    accountWasmHash: config.accountWasmHash,
    webauthnVerifierAddress: config.webauthnVerifierAddress,
    storage,
    rpName: config.rpName,
  });
}

export function isSmartAccountConfigError(error: unknown): error is SmartAccountConfigError {
  return error instanceof SmartAccountConfigError;
}

export async function getSmartAccountKit(): Promise<SmartAccountKit> {
  if (!smartAccountKitPromise) {
    smartAccountKitPromise = createSmartAccountKit();
  }

  try {
    return await smartAccountKitPromise;
  } catch (error) {
    smartAccountKitPromise = null;
    throw error;
  }
}

export async function createPasskeySmartAccount(): Promise<TCreatePasskeySmartAccountResult> {
  const kit = await getSmartAccountKit();
  const result = await kit.createWallet("Highrable", "Highrable user", {
    autoSubmit: true,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  return {
    ...toPasskeySession(result),
    submitResult: result.submitResult,
  };
}

export async function reconnectPasskeySmartAccount(): Promise<TReconnectPasskeySmartAccountResult> {
  const kit = await getSmartAccountKit();
  const result = await kit.connectWallet({ prompt: true });

  if (!result) {
    throw new Error("No passkey smart account session was found.");
  }

  return toPasskeySession(result);
}

export async function refreshPasskeySmartAccountSession(): Promise<TPasskeySmartAccountSession | null> {
  const kit = await getSmartAccountKit();
  const result = await kit.connectWallet();
  return result ? toPasskeySession(result) : null;
}

export async function disconnectPasskeySmartAccount(): Promise<void> {
  const kit = await getSmartAccountKit();
  await kit.disconnect();
}
