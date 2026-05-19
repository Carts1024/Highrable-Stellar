import { env } from "@/core/config/env";

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
  tokenContractId: env.NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID,
  symbol: env.NEXT_PUBLIC_STABLECOIN_SYMBOL ?? DEFAULT_STABLECOIN_SYMBOL,
  decimals: normalizeStablecoinDecimals(env.NEXT_PUBLIC_STABLECOIN_DECIMALS),
  network: env.NEXT_PUBLIC_STELLAR_NETWORK,
};

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
