import { env } from "@/core/config/env";

export const SMART_ACCOUNT_CONFIG_MISSING_MESSAGE =
  "Passkey smart account configuration is missing. Add the required smart account environment variables.";

export interface ISmartAccountConfig {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly accountWasmHash: string;
  readonly webauthnVerifierAddress: string;
  readonly rpName: string;
}

export class PasskeyConfigError extends Error {
  public constructor(message = SMART_ACCOUNT_CONFIG_MISSING_MESSAGE) {
    super(message);
    this.name = "PasskeyConfigError";
  }
}

function readOptionalValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
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
    accountWasmHash,
    webauthnVerifierAddress,
    rpName: readOptionalValue(env.NEXT_PUBLIC_PASSKEY_RP_NAME) ?? "Highrable",
  };
}

export function getSmartAccountConfigOrThrow(): ISmartAccountConfig {
  const config = getSmartAccountConfig();

  if (!config) {
    throw new PasskeyConfigError();
  }

  return config;
}
