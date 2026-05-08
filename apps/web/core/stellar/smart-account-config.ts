import { z } from "zod";

const DEFAULT_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const DEFAULT_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";

const TOptionalEnvStringSchema = z
  .string()
  .optional()
  .transform((value) => {
    const trimmedValue = value?.trim();
    return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
  });

const TSmartAccountEnvSchema = z.object({
  rpcUrl: TOptionalEnvStringSchema,
  networkPassphrase: TOptionalEnvStringSchema,
  accountWasmHash: TOptionalEnvStringSchema,
  webauthnVerifierAddress: TOptionalEnvStringSchema,
});

export type TSmartAccountConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  accountWasmHash?: string;
  webauthnVerifierAddress?: string;
  rpName: string;
};

export type TValidatedSmartAccountConfig = TSmartAccountConfig & {
  accountWasmHash: string;
  webauthnVerifierAddress: string;
};

export class SmartAccountConfigError extends Error {
  public readonly missingKeys: string[];

  public constructor(missingKeys: string[]) {
    super("Passkey smart account config is missing.");
    this.name = "SmartAccountConfigError";
    this.missingKeys = missingKeys;
  }
}

export const smartAccountConfig: TSmartAccountConfig = (() => {
  const parsedEnv = TSmartAccountEnvSchema.parse({
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
    networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    accountWasmHash: process.env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH,
    webauthnVerifierAddress: process.env.NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID,
  });

  return {
    rpcUrl: parsedEnv.rpcUrl ?? DEFAULT_TESTNET_RPC_URL,
    networkPassphrase: parsedEnv.networkPassphrase ?? DEFAULT_TESTNET_PASSPHRASE,
    accountWasmHash: parsedEnv.accountWasmHash,
    webauthnVerifierAddress: parsedEnv.webauthnVerifierAddress,
    rpName: "Highrable",
  };
})();

export function getSmartAccountConfig(): TSmartAccountConfig {
  return smartAccountConfig;
}

export function getValidatedSmartAccountConfig(): TValidatedSmartAccountConfig {
  const missingKeys: string[] = [];
  const { accountWasmHash, webauthnVerifierAddress } = smartAccountConfig;

  if (!accountWasmHash) {
    missingKeys.push("NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH");
  }

  if (!webauthnVerifierAddress) {
    missingKeys.push("NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID");
  }

  if (missingKeys.length > 0) {
    throw new SmartAccountConfigError(missingKeys);
  }

  if (!accountWasmHash || !webauthnVerifierAddress) {
    throw new SmartAccountConfigError([
      "NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH",
      "NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID",
    ]);
  }

  return {
    ...smartAccountConfig,
    accountWasmHash,
    webauthnVerifierAddress,
  };
}
