import { env } from "@/core/config/env";
import { Asset } from "@stellar/stellar-sdk";

export interface IStablecoinConfig {
  readonly tokenContractId?: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly network: "local" | "testnet" | "mainnet" | "public";
}

export interface IStablecoinConfigValidationResult {
  readonly isValid: boolean;
  readonly message: string | null;
}

const DEFAULT_STABLECOIN_SYMBOL = "Mock USDC";
const DEFAULT_STABLECOIN_DECIMALS = 7;
const CLASSIC_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;
const CONTRACT_ACCOUNT_PATTERN = /^C[A-Z2-7]{55}$/;

function normalizeStablecoinConfigValue(value: string | undefined): string | undefined {
  const sanitized = value?.trim().toUpperCase();
  return sanitized && sanitized.length > 0 ? sanitized : undefined;
}

function normalizeStablecoinDecimals(rawValue: number | undefined): number {
  if (rawValue === undefined) {
    return DEFAULT_STABLECOIN_DECIMALS;
  }

  if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 18) {
    return DEFAULT_STABLECOIN_DECIMALS;
  }

  return rawValue;
}

export const stablecoinConfig: IStablecoinConfig = {
  tokenContractId: resolveStablecoinTokenContractId(env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID),
  symbol: env.NEXT_PUBLIC_STABLECOIN_SYMBOL ?? DEFAULT_STABLECOIN_SYMBOL,
  decimals: normalizeStablecoinDecimals(env.NEXT_PUBLIC_STABLECOIN_DECIMALS),
  network: env.NEXT_PUBLIC_STELLAR_NETWORK,
};

export function resolveStablecoinTokenContractId(value: string | undefined): string | undefined {
  const sanitizedValue = normalizeStablecoinConfigValue(value);
  if (!sanitizedValue) {
    return undefined;
  }

  if (CONTRACT_ACCOUNT_PATTERN.test(sanitizedValue)) {
    return sanitizedValue;
  }

  if (CLASSIC_ACCOUNT_PATTERN.test(sanitizedValue)) {
    const assetCode =
      env.NEXT_PUBLIC_USDC_ASSET_CODE ?? env.NEXT_PUBLIC_STABLECOIN_ASSET_CODE ?? "USDC";
    return new Asset(assetCode, sanitizedValue).contractId(
      env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    );
  }

  return sanitizedValue;
}

export function validateStablecoinConfig(
  config: IStablecoinConfig = stablecoinConfig,
): IStablecoinConfigValidationResult {
  if (!config.tokenContractId) {
    return {
      isValid: false,
      message:
        "Stablecoin token contract ID is missing. Set NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID.",
    };
  }

  if (!CONTRACT_ACCOUNT_PATTERN.test(config.tokenContractId)) {
    return {
      isValid: false,
      message:
        "Stablecoin token config must be a Soroban contract address beginning with C or a Stellar asset issuer beginning with G.",
    };
  }

  if (!Number.isInteger(config.decimals) || config.decimals < 0 || config.decimals > 18) {
    return {
      isValid: false,
      message: "Stablecoin decimals must be an integer between 0 and 18.",
    };
  }

  return {
    isValid: true,
    message: null,
  };
}

export function hasStablecoinConfig(config: IStablecoinConfig = stablecoinConfig): boolean {
  return validateStablecoinConfig(config).isValid;
}

export function getStablecoinConfigOrThrow(
  config: IStablecoinConfig = stablecoinConfig,
): IStablecoinConfig & { tokenContractId: string } {
  const validation = validateStablecoinConfig(config);
  if (!validation.isValid) {
    throw new Error(validation.message ?? "Stablecoin configuration is invalid.");
  }

  return {
    ...config,
    tokenContractId: config.tokenContractId!,
  };
}
