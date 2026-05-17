import { env } from "@/core/config/env";

export const SMART_ACCOUNT_CONFIG_MISSING_MESSAGE =
  "Passkey smart account configuration is missing. Add the required smart account environment variables.";

export const SMART_ACCOUNT_KIT_VERSION = "0.2.10";
export const SMART_ACCOUNT_KIT_TESTNET_DEFAULTS = {
  accountWasmHash: "3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c",
  webauthnVerifierAddress: "CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH",
} as const;
export const KNOWN_INCOMPATIBLE_SMART_ACCOUNT_WASM_HASHES = new Set([
  "8537b8166c0078440a5324c12f6db48d6340d157c306a54c5ea81405abcc2611",
]);

export interface ISmartAccountConfig {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly accountWasmHash: string;
  readonly webauthnVerifierAddress: string;
  readonly rpId: string;
  readonly rpName: string;
  readonly relayerUrl: string | null;
}

export class PasskeyConfigError extends Error {
  public constructor(message = SMART_ACCOUNT_CONFIG_MISSING_MESSAGE) {
    super(message);
    this.name = "PasskeyConfigError";
  }
}

export class PasskeySmartAccountCompatibilityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PasskeySmartAccountCompatibilityError";
  }
}

function readOptionalValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeWasmHash(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeContractAddress(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeRpId(value: string): string {
  const trimmed = value.trim();

  try {
    return new URL(trimmed).hostname;
  } catch {
    return (
      trimmed
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        ?.split(":")[0] ?? trimmed
    );
  }
}

export function hasSmartAccountConfig(): boolean {
  return (
    readOptionalValue(env.NEXT_PUBLIC_STELLAR_RPC_URL) !== null &&
    readOptionalValue(env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE) !== null &&
    readOptionalValue(env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH) !== null &&
    readOptionalValue(env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID) !== null
  );
}

export function getSmartAccountConfig(): ISmartAccountConfig | null {
  const rpcUrl = readOptionalValue(env.NEXT_PUBLIC_STELLAR_RPC_URL);
  const networkPassphrase = readOptionalValue(env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE);
  const accountWasmHash = readOptionalValue(env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH);
  const webauthnVerifierAddress = readOptionalValue(env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID);

  if (!rpcUrl || !networkPassphrase || !accountWasmHash || !webauthnVerifierAddress) {
    return null;
  }

  return {
    rpcUrl,
    networkPassphrase,
    accountWasmHash: normalizeWasmHash(accountWasmHash),
    webauthnVerifierAddress: normalizeContractAddress(webauthnVerifierAddress),
    rpId: normalizeRpId(env.NEXT_PUBLIC_APP_DOMAIN),
    rpName: readOptionalValue(env.NEXT_PUBLIC_PASSKEY_RP_NAME) ?? "Highrable",
    relayerUrl: readOptionalValue(env.NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL),
  };
}

export function getSmartAccountConfigOrThrow(): ISmartAccountConfig {
  const config = getSmartAccountConfig();

  if (!config) {
    throw new PasskeyConfigError();
  }

  return config;
}

export function assertSmartAccountConfigCanDeployCompatibleAccount(): void {
  const config = getSmartAccountConfigOrThrow();

  if (KNOWN_INCOMPATIBLE_SMART_ACCOUNT_WASM_HASHES.has(config.accountWasmHash)) {
    throw new PasskeySmartAccountCompatibilityError(
      `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH is a known incompatible smart account artifact for smart-account-kit ${SMART_ACCOUNT_KIT_VERSION}. Use ${SMART_ACCOUNT_KIT_TESTNET_DEFAULTS.accountWasmHash}, restart the web app so the new environment is loaded, clear the old passkey session, then create a new passkey smart account.`,
    );
  }
}
